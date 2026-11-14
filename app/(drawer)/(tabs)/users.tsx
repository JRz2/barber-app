import { useAuth } from '@/src/features/auth/hooks/useAuth';
import { useTenants } from '@/src/hooks/useTenants';
import { supabase } from '@/src/lib/supabase';
import { FontAwesome } from '@expo/vector-icons';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { jwtDecode } from 'jwt-decode';
import { memo, useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Image, KeyboardAvoidingView, Modal, Platform, RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

type UserData = {
    id: string;
    full_name: string;
    email: string;
    role: string;
    avatar_url?: string | null;
    signedUrl?: string;
    tenant_id?: string | null;
    tenant_name?: string | null;
};

const PAGE_SIZE = 10;

const renderInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
};

const UserAvatar = memo(({ url, fullName }: { url?: string, fullName: string }) => {
    if (url) return <Image source={{ uri: url }} style={{ width: 48, height: 48, borderRadius: 24, marginRight: 16 }} />;
    return (
        <View className="w-12 h-12 bg-zinc-900 rounded-full items-center justify-center mr-4">
            <Text className="text-white font-bold text-sm">{renderInitials(fullName)}</Text>
        </View>
    );
});

export default function UsersScreen() {
    const { session } = useAuth();
    const queryClient = useQueryClient();
    const { tenants } = useTenants();
    const [refreshing, setRefreshing] = useState(false);

    let currentUserRole = '';
    if (session?.access_token) {
        try {
            const decoded: any = jwtDecode(session.access_token);
            currentUserRole = decoded.user_role || '';
        } catch (e) { }
    }
    const isSuperAdmin = currentUserRole === 'SUPER_ADMIN';

    const [isEditing, setIsEditing] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [isTenantSelectVisible, setIsTenantSelectVisible] = useState(false);

    const [isResetModalVisible, setIsResetModalVisible] = useState(false);
    const [resetPasswordValue, setResetPasswordValue] = useState('');
    const [userToResetName, setUserToResetName] = useState('');

    const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState<'ADMIN' | 'ENCARGADO'>('ENCARGADO');
    const [selectedImageBase64, setSelectedImageBase64] = useState<string | null>(null);
    const [selectedImageExt, setSelectedImageExt] = useState<string>('jpg');
    const [currentAvatarUrl, setCurrentAvatarUrl] = useState<string | null>(null);
    const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);

    const selectedTenant = tenants.find(t => t.id === selectedTenantId);
    const selectedTenantName = selectedTenant ? selectedTenant.name : 'Ninguno';

    const showFeedback = (type: 'success' | 'error', text: string) => {
        setFeedbackMessage({ type, text });
        setTimeout(() => setFeedbackMessage(null), 4000);
    };

    const {
        data: infiniteData,
        isLoading,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        refetch
    } = useInfiniteQuery({
        queryKey: ['users'],
        queryFn: async ({ pageParam = 0 }) => {
            const from = pageParam * PAGE_SIZE;
            const to = from + PAGE_SIZE - 1;

            const { data, error } = await supabase
                .from('v_users_with_roles')
                .select('id, full_name, email, role, avatar_url, tenant_id, tenant_name') // 🆕 Agregado tenant_name
                .order('role_order', { ascending: true })
                .order('full_name', { ascending: true })
                .range(from, to);

            if (error) throw error;

            const formattedUsers = await Promise.all(data.map(async (profile: any) => {
                let signedUrl = null;
                if (profile.avatar_url) {
                    const { data: urlData } = await supabase.storage.from('avatars').createSignedUrl(profile.avatar_url, 3600);
                    signedUrl = urlData?.signedUrl;
                }
                return {
                    ...profile,
                    full_name: profile.full_name || 'Sin nombre',
                    email: profile.email || 'Sin correo',
                    role: profile.role || 'SIN ROL',
                    signedUrl,
                };
            }));

            return formattedUsers;
        },
        initialPageParam: 0,
        getNextPageParam: (lastPage, allPages) => {
            if (lastPage.length < PAGE_SIZE) return undefined;
            return allPages.length;
        },
    });

    const users = infiniteData?.pages.flat() || [];

    const saveMutation = useMutation({
        mutationFn: async (data: any) => {
            let savedUserId = selectedUserId;

            if (isEditing && selectedUserId) {
                const { error } = await supabase.functions.invoke('manage-user', {
                    body: { action: 'update', userId: selectedUserId, full_name: data.fullName, email: data.email, role: data.role, tenant_id: data.tenant_id },
                });
                if (error) throw error;
            } else {
                const { data: res, error } = await supabase.functions.invoke('create-user', {
                    body: { email: data.email, password: data.password, full_name: data.fullName, role: data.role, tenant_id: data.tenant_id },
                });
                if (error) throw error;
                savedUserId = res.user_id;
            }

            if (selectedImageBase64 && savedUserId) {
                const { error } = await supabase.functions.invoke('upload-avatar', {
                    body: { userId: savedUserId, base64: selectedImageBase64, ext: selectedImageExt },
                });
                if (error) throw error;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            setIsModalVisible(false);
            resetForm();
            showFeedback('success', isEditing ? 'Usuario actualizado' : 'Usuario creado');
        },
        onError: (err: any) => showFeedback('error', err.message || 'Error al guardar'),
    });

    const deleteMutation = useMutation({
        mutationFn: async (userId: string) => {
            const { error } = await supabase.functions.invoke('manage-user', { body: { action: 'delete', userId } });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            showFeedback('success', 'Usuario eliminado');
        },
        onError: (err: any) => showFeedback('error', err.message || 'Error al eliminar'),
    });

    const resetPasswordMutation = useMutation({
        mutationFn: async ({ userId, newPassword }: { userId: string, newPassword: string }) => {
            const { data, error } = await supabase.functions.invoke('manage-user', {
                body: { action: 'reset_password', userId, newPassword }
            });
            if (error) throw error;
            if (data.error) throw new Error(data.error);
        },
        onSuccess: () => {
            setIsResetModalVisible(false);
            setResetPasswordValue('');
            showFeedback('success', 'Contraseña restablecida correctamente');
        },
        onError: (err: any) => showFeedback('error', err.message || 'Error al restablecer contraseña'),
    });

    const openEditModal = (user: UserData) => {
        setIsEditing(true);
        setSelectedUserId(user.id);
        setFullName(user.full_name);
        setEmail(user.email);
        setPassword('');
        setRole(user.role as 'ADMIN' | 'ENCARGADO');
        setSelectedImageBase64(null);
        setCurrentAvatarUrl(user.signedUrl || null);
        setSelectedTenantId(user.tenant_id || null);
        setIsModalVisible(true);
    };

    const openResetModal = (user: UserData) => {
        setSelectedUserId(user.id);
        setUserToResetName(user.full_name);
        setResetPasswordValue('');
        setIsResetModalVisible(true);
    };

    const resetForm = () => {
        setIsEditing(false);
        setSelectedUserId(null);
        setFullName('');
        setEmail('');
        setPassword('');
        setRole('ENCARGADO');
        setSelectedImageBase64(null);
        setCurrentAvatarUrl(null);
        setSelectedTenantId(null);
    };

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.5,
            base64: true,
        });
        if (!result.canceled && result.assets[0].base64) {
            setSelectedImageBase64(result.assets[0].base64);
            setSelectedImageExt(result.assets[0].uri.split('.').pop() || 'jpg');
        }
    };

    const handleSaveUser = () => {
        if (!fullName || !email || (!isEditing && !password)) {
            showFeedback('error', 'Todos los campos son obligatorios');
            return;
        }
        saveMutation.mutate({ fullName, email, password, role, tenant_id: selectedTenantId });
    };

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        refetch().finally(() => setRefreshing(false));
    }, [refetch]);

    const renderItem = useCallback(({ item }: { item: UserData }) => (
        <View className="bg-white p-5 rounded-[28px] mb-4 shadow-md shadow-zinc-300/50 border border-zinc-100 flex-row justify-between items-center">
            <View className="flex-row items-center flex-1">
                <UserAvatar url={item.signedUrl} fullName={item.full_name} />
                <View className="flex-1">
                    <Text className="text-zinc-900 font-bold text-lg">{item.full_name}</Text>
                    <Text className="text-zinc-500 text-sm">{item.email}</Text>
                    {/* NEGOCIO ASOCIADO */}
                    <View className="flex-row items-center mt-1">
                        <FontAwesome name="building" size={10} color="#a1a1aa" />
                        <Text className="text-zinc-400 text-xs ml-1">
                            {item.tenant_name || 'Sin negocio'}
                        </Text>
                    </View>
                </View>
            </View>
            <View className="flex-row items-center space-x-3">
                <View className={`px-3 py-1.5 rounded-full ${item.role === 'SUPER_ADMIN' ? 'bg-amber-100' : item.role === 'ADMIN' ? 'bg-blue-100' : 'bg-emerald-100'}`}>
                    <Text className={`text-[10px] uppercase font-bold tracking-wider ${item.role === 'SUPER_ADMIN' ? 'text-amber-700' : item.role === 'ADMIN' ? 'text-blue-700' : 'text-emerald-700'}`}>{item.role}</Text>
                </View>

                {isSuperAdmin && (
                    <TouchableOpacity onPress={() => openResetModal(item)} className="p-2 bg-amber-50 rounded-full border border-amber-200">
                        <FontAwesome name="key" size={16} color="#f59e0b" />
                    </TouchableOpacity>
                )}

                <TouchableOpacity onPress={() => openEditModal(item)} className="p-2 bg-zinc-50 rounded-full border border-zinc-200"><FontAwesome name="pencil" size={16} color="#3b82f6" /></TouchableOpacity>
                <TouchableOpacity onPress={() => window.confirm(`¿Eliminar a ${item.full_name}?`) && deleteMutation.mutate(item.id)} className="p-2 bg-zinc-50 rounded-full border border-zinc-200"><FontAwesome name="trash" size={16} color="#ef4444" /></TouchableOpacity>
            </View>
        </View>
    ), [deleteMutation, isSuperAdmin]);

    return (
        <LinearGradient colors={['#E0F2FE', '#F3E8FF', '#ffffff']} style={{ flex: 1 }}>
            <View style={{ flex: 1, paddingTop: 64, paddingHorizontal: 24 }}>
                {feedbackMessage && (
                    <View className={`absolute top-16 left-6 right-6 p-4 rounded-2xl z-50 ${feedbackMessage.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`}>
                        <Text className="text-white text-center font-bold">{feedbackMessage.text}</Text>
                    </View>
                )}
                <View className="flex-row justify-between items-center mb-6">
                    <Text className="text-3xl font-extrabold text-zinc-900">Equipo</Text>
                </View>

                {isLoading ? (
                    <ActivityIndicator size="large" color="#0f172a" className="mt-10" />
                ) : (
                    <FlatList
                        data={users}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={{ paddingBottom: 120 }}
                        showsVerticalScrollIndicator={false}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0f172a" />}
                        onEndReached={() => hasNextPage && fetchNextPage()}
                        onEndReachedThreshold={0.5}
                        renderItem={renderItem}
                        ListFooterComponent={isFetchingNextPage ? <ActivityIndicator color="#0f172a" size="small" style={{ marginVertical: 20 }} /> : undefined}
                        ListEmptyComponent={() => (
                            <View className="items-center justify-center mt-20">
                                <FontAwesome name="users" size={40} color="#94a3b8" />
                                <Text className="text-zinc-500 text-center mt-4 font-medium">No hay usuarios registrados.</Text>
                            </View>
                        )}
                    />
                )}

                <TouchableOpacity style={{ position: 'absolute', bottom: 110, right: 24, shadowColor: '#0f172a', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 10 }} onPress={() => { resetForm(); setIsModalVisible(true); }}>
                    <LinearGradient colors={['#334155', '#0f172a']} style={{ width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' }}>
                        <FontAwesome name="plus" size={24} color="#ffffff" />
                    </LinearGradient>
                </TouchableOpacity>

                {/* MODAL DE EDITAR/CREAR USUARIO */}
                <Modal visible={isModalVisible} animationType="slide" transparent={true}>
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 justify-end bg-black/50">
                        <View className="bg-white rounded-t-[40px] p-8 shadow-2xl">
                            <View className="w-12 h-1.5 bg-zinc-200 rounded-full self-center mb-6" />
                            <View className="flex-row justify-between items-center mb-6">
                                <Text className="text-3xl font-extrabold text-zinc-900">{isEditing ? 'Editar' : 'Nuevo'}</Text>
                                <TouchableOpacity onPress={() => { setIsModalVisible(false); resetForm(); }} className="bg-zinc-100 w-10 h-10 rounded-full items-center justify-center"><FontAwesome name="close" size={18} color="#52525b" /></TouchableOpacity>
                            </View>
                            <View className="items-center mb-6">
                                <TouchableOpacity onPress={pickImage} className="w-24 h-24 bg-zinc-100 rounded-full items-center justify-center border-2 border-dashed border-zinc-300 overflow-hidden">
                                    {selectedImageBase64 ? <Image source={{ uri: `data:image/${selectedImageExt};base64,${selectedImageBase64}` }} style={{ width: 96, height: 96, borderRadius: 48 }} /> : currentAvatarUrl ? <Image source={{ uri: currentAvatarUrl }} style={{ width: 96, height: 96, borderRadius: 48 }} /> : <FontAwesome name="camera" size={24} color="#a1a1aa" />}
                                </TouchableOpacity>
                                <Text className="text-zinc-400 text-xs mt-2">{selectedImageBase64 || currentAvatarUrl ? 'Toca para cambiar foto' : 'Toca para subir foto'}</Text>
                            </View>
                            <Text className="text-zinc-500 mb-2 text-xs font-bold uppercase tracking-wider">Nombre Completo</Text>
                            <TextInput className="bg-zinc-50 text-zinc-900 rounded-2xl px-5 py-4 mb-5 border border-zinc-200 font-medium" placeholder="Ej. Carlos Ruiz" placeholderTextColor="#a1a1aa" value={fullName} onChangeText={setFullName} />
                            <Text className="text-zinc-500 mb-2 text-xs font-bold uppercase tracking-wider">Correo Electrónico</Text>
                            <TextInput className="bg-zinc-50 text-zinc-900 rounded-2xl px-5 py-4 mb-5 border border-zinc-200 font-medium" placeholder="carlos@barberia.com" placeholderTextColor="#a1a1aa" keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />

                            {!isEditing && (
                                <>
                                    <Text className="text-zinc-500 mb-2 text-xs font-bold uppercase tracking-wider">Contraseña Provisional</Text>
                                    <TextInput className="bg-zinc-50 text-zinc-900 rounded-2xl px-5 py-4 mb-5 border border-zinc-200 font-medium" placeholder="••••••••" placeholderTextColor="#a1a1aa" secureTextEntry value={password} onChangeText={setPassword} />
                                </>
                            )}

                            <Text className="text-zinc-500 mb-2 text-xs font-bold uppercase tracking-wider">Asignar Rol</Text>
                            <View className="flex-row space-x-4 mb-5">
                                <TouchableOpacity className={`flex-1 py-4 rounded-2xl border-2 ${role === 'ADMIN' ? 'bg-zinc-900 border-zinc-900' : 'bg-white border-zinc-200'}`} onPress={() => setRole('ADMIN')}>
                                    <Text className={`text-center font-bold ${role === 'ADMIN' ? 'text-white' : 'text-zinc-500'}`}>ADMIN</Text>
                                </TouchableOpacity>
                                <TouchableOpacity className={`flex-1 py-4 rounded-2xl border-2 ${role === 'ENCARGADO' ? 'bg-zinc-900 border-zinc-900' : 'bg-white border-zinc-200'}`} onPress={() => setRole('ENCARGADO')}>
                                    <Text className={`text-center font-bold ${role === 'ENCARGADO' ? 'text-white' : 'text-zinc-500'}`}>ENCARGADO</Text>
                                </TouchableOpacity>
                            </View>

                            <Text className="text-zinc-500 mb-2 text-xs font-bold uppercase tracking-wider">Negocio Asociado (Opcional)</Text>
                            <TouchableOpacity
                                onPress={() => setIsTenantSelectVisible(true)}
                                className="bg-zinc-50 border border-zinc-200 rounded-2xl px-5 py-4 mb-8 flex-row items-center justify-between"
                            >
                                <View className="flex-row items-center flex-1">
                                    {selectedTenant?.signedUrl ? (
                                        <Image source={{ uri: selectedTenant.signedUrl }} style={{ width: 20, height: 20, borderRadius: 10, marginRight: 12 }} />
                                    ) : (
                                        <FontAwesome name="building" size={16} color="#71717a" style={{ marginRight: 12 }} />
                                    )}
                                    <Text className={`font-medium ${selectedTenantId ? 'text-zinc-900' : 'text-zinc-400'}`}>
                                        {selectedTenantName}
                                    </Text>
                                </View>
                                <FontAwesome name="chevron-down" size={14} color="#a1a1aa" />
                            </TouchableOpacity>

                            <TouchableOpacity onPress={handleSaveUser} disabled={saveMutation.isPending} className="w-full rounded-2xl overflow-hidden shadow-lg shadow-zinc-400">
                                <LinearGradient colors={['#334155', '#0f172a']} style={{ paddingVertical: 18, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}>
                                    {saveMutation.isPending ? <ActivityIndicator color="#ffffff" /> : <><Text className="text-white font-bold text-lg mr-2">{isEditing ? 'Guardar Cambios' : 'Crear Usuario'}</Text><FontAwesome name="check" size={16} color="#ffffff" /></>}
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </KeyboardAvoidingView>
                </Modal>

                {/* MODAL SELECTOR DE NEGOCIOS */}
                <Modal visible={isTenantSelectVisible} animationType="slide" transparent={true}>
                    <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={() => setIsTenantSelectVisible(false)} activeOpacity={1}>
                        <View className="bg-white rounded-t-[40px] p-8 pb-12 shadow-2xl mt-auto">
                            <View className="w-12 h-1.5 bg-zinc-200 rounded-full self-center mb-8" />
                            <Text className="text-2xl font-extrabold text-zinc-900 mb-6 text-center">Seleccionar Negocio</Text>

                            <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
                                <TouchableOpacity
                                    onPress={() => {
                                        setSelectedTenantId(null);
                                        setIsTenantSelectVisible(false);
                                    }}
                                    className={`flex-row items-center p-4 rounded-xl mb-2 ${!selectedTenantId ? 'bg-zinc-100 border border-zinc-300' : 'bg-white border border-zinc-100'}`}
                                >
                                    <View className="w-10 h-10 bg-zinc-200 rounded-full items-center justify-center mr-4">
                                        <FontAwesome name="ban" size={16} color="#71717a" />
                                    </View>
                                    <Text className="text-zinc-900 font-bold text-base">Ninguno</Text>
                                    {!selectedTenantId && <FontAwesome name="check" size={16} color="#0f172a" style={{ marginLeft: 'auto' }} />}
                                </TouchableOpacity>

                                {tenants.map((tenant) => (
                                    <TouchableOpacity
                                        key={tenant.id}
                                        onPress={() => {
                                            setSelectedTenantId(tenant.id);
                                            setIsTenantSelectVisible(false);
                                        }}
                                        className={`flex-row items-center p-4 rounded-xl mb-2 ${selectedTenantId === tenant.id ? 'bg-zinc-100 border border-zinc-300' : 'bg-white border border-zinc-100'}`}
                                    >
                                        {tenant.signedUrl ? (
                                            <Image source={{ uri: tenant.signedUrl }} style={{ width: 40, height: 40, borderRadius: 20, marginRight: 16 }} />
                                        ) : (
                                            <View className="w-10 h-10 bg-amber-100 rounded-full items-center justify-center mr-4">
                                                <FontAwesome name="building" size={16} color="#f59e0b" />
                                            </View>
                                        )}
                                        <Text className="text-zinc-900 font-bold text-base">{tenant.name}</Text>
                                        {selectedTenantId === tenant.id && <FontAwesome name="check" size={16} color="#0f172a" style={{ marginLeft: 'auto' }} />}
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    </TouchableOpacity>
                </Modal>

                {/* MODAL DE RESTABLECER CONTRASEÑA */}
                <Modal visible={isResetModalVisible} animationType="slide" transparent={true}>
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 justify-end bg-black/50">
                        <View className="bg-white rounded-t-[40px] p-8 shadow-2xl">
                            <View className="w-12 h-1.5 bg-zinc-200 rounded-full self-center mb-6" />
                            <View className="flex-row justify-between items-center mb-6">
                                <Text className="text-2xl font-extrabold text-zinc-900">Restablecer Contraseña</Text>
                                <TouchableOpacity onPress={() => setIsResetModalVisible(false)} className="bg-zinc-100 w-10 h-10 rounded-full items-center justify-center"><FontAwesome name="close" size={18} color="#52525b" /></TouchableOpacity>
                            </View>

                            <Text className="text-zinc-500 mb-4 text-sm">
                                Ingresa la nueva contraseña para <Text className="font-bold text-zinc-900">{userToResetName}</Text>.
                            </Text>

                            <Text className="text-zinc-500 mb-2 text-xs font-bold uppercase tracking-wider">Nueva Contraseña</Text>
                            <View className="flex-row items-center bg-zinc-50 border border-zinc-200 rounded-2xl px-5 py-4 mb-6">
                                <FontAwesome name="key" size={16} color="#a1a1aa" />
                                <TextInput
                                    className="flex-1 text-zinc-900 ml-3 font-medium outline-none"
                                    value={resetPasswordValue}
                                    onChangeText={setResetPasswordValue}
                                    placeholder="Mínimo 6 caracteres"
                                    placeholderTextColor="#a1a1aa"
                                    secureTextEntry
                                />
                            </View>

                            <TouchableOpacity
                                onPress={() => {
                                    if (resetPasswordValue.length < 6) {
                                        showFeedback('error', 'La contraseña debe tener al menos 6 caracteres');
                                        return;
                                    }
                                    resetPasswordMutation.mutate({ userId: selectedUserId!, newPassword: resetPasswordValue });
                                }}
                                disabled={resetPasswordMutation.isPending}
                                className="w-full rounded-2xl overflow-hidden shadow-lg shadow-amber-500/30"
                            >
                                <LinearGradient colors={['#f59e0b', '#d97706']} style={{ paddingVertical: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}>
                                    {resetPasswordMutation.isPending ? <ActivityIndicator color="#ffffff" /> : <Text className="text-white font-bold text-lg">Actualizar Contraseña</Text>}
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </KeyboardAvoidingView>
                </Modal>

            </View>
        </LinearGradient>
    );
}