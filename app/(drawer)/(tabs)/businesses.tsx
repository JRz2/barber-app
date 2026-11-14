import { useAuth } from '@/src/features/auth/hooks/useAuth';
import { Tenant, useTenants } from '@/src/hooks/useTenants';
import { FontAwesome } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { jwtDecode } from 'jwt-decode';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Image, KeyboardAvoidingView, Modal, Platform, RefreshControl, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function BusinessesScreen() {
    const { session } = useAuth();
    const { tenants, isLoading, refetch, createTenant, updateTenant, deleteTenant, isCreating, isUpdating, isDeleting } = useTenants();

    // Verificar rol SUPER_ADMIN
    let currentUserRole = '';
    if (session?.access_token) {
        try {
            const decoded: any = jwtDecode(session.access_token);
            currentUserRole = decoded.user_role || '';
        } catch (e) { }
    }
    if (currentUserRole !== 'SUPER_ADMIN') return null;

    const [refreshing, setRefreshing] = useState(false);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
    const [currentLogoUrl, setCurrentLogoUrl] = useState<string | null>(null);
    const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Form fields
    const [name, setName] = useState('');
    const [address, setAddress] = useState('');
    const [phone, setPhone] = useState('');
    const [logoBase64, setLogoBase64] = useState<string | null>(null);
    const [logoExt, setLogoExt] = useState<string>('jpg');

    const showFeedback = (type: 'success' | 'error', text: string) => {
        setFeedbackMessage({ type, text });
        setTimeout(() => setFeedbackMessage(null), 4000);
    };

    const openCreateModal = () => {
        setIsEditing(false);
        setSelectedTenantId(null);
        setName('');
        setAddress('');
        setPhone('');
        setLogoBase64(null);
        setCurrentLogoUrl(null);
        setIsModalVisible(true);
    };

    const openEditModal = (tenant: Tenant) => {
        setIsEditing(true);
        setSelectedTenantId(tenant.id);
        setName(tenant.name);
        setAddress(tenant.address || '');
        setPhone(tenant.phone || '');
        setLogoBase64(null);
        setCurrentLogoUrl(tenant.signedUrl || null);
        setIsModalVisible(true);
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
            setLogoBase64(result.assets[0].base64);
            setLogoExt(result.assets[0].uri.split('.').pop() || 'jpg');
        }
    };

    const handleSave = async () => {
        if (!name.trim()) {
            showFeedback('error', 'El nombre del negocio es obligatorio');
            return;
        }

        try {
            if (isEditing && selectedTenantId) {
                await updateTenant({
                    id: selectedTenantId,
                    name,
                    address,
                    phone,
                    logoBase64: logoBase64 || undefined,
                    logoExt: logoBase64 ? logoExt : undefined,
                });
                showFeedback('success', 'Negocio actualizado correctamente');
            } else {
                await createTenant({
                    name,
                    address,
                    phone,
                    logoBase64: logoBase64 || undefined,
                    logoExt: logoBase64 ? logoExt : undefined,
                });
                showFeedback('success', 'Negocio creado correctamente');
            }
            setIsModalVisible(false);
        } catch (error: any) {
            showFeedback('error', error.message || 'Error al guardar el negocio');
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (!window.confirm(`¿Eliminar el negocio "${name}"? Los usuarios quedarán sin negocio asignado.`)) return;
        try {
            await deleteTenant(id);
            showFeedback('success', 'Negocio eliminado');
        } catch (error: any) {
            showFeedback('error', error.message || 'Error al eliminar');
        }
    };

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        refetch().finally(() => setRefreshing(false));
    }, [refetch]);

    const renderItem = ({ item }: { item: Tenant }) => (
        <View className="bg-white p-5 rounded-[28px] mb-4 shadow-md shadow-zinc-300/50 border border-zinc-100 flex-row justify-between items-center">
            <View className="flex-row items-center flex-1">
                {item.signedUrl ? (
                    <Image source={{ uri: item.signedUrl }} style={{ width: 56, height: 56, borderRadius: 28, marginRight: 16 }} />
                ) : (
                    <View className="w-14 h-14 bg-amber-100 rounded-full items-center justify-center mr-4">
                        <FontAwesome name="building" size={24} color="#f59e0b" />
                    </View>
                )}
                <View className="flex-1">
                    <Text className="text-zinc-900 font-bold text-lg">{item.name}</Text>
                    <Text className="text-zinc-500 text-sm">{item.address || 'Sin dirección'}</Text>
                </View>
            </View>
            <View className="flex-row items-center space-x-2">
                <TouchableOpacity onPress={() => openEditModal(item)} className="p-2 bg-zinc-50 rounded-full border border-zinc-200">
                    <FontAwesome name="pencil" size={16} color="#3b82f6" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(item.id, item.name)} className="p-2 bg-zinc-50 rounded-full border border-zinc-200">
                    <FontAwesome name="trash" size={16} color="#ef4444" />
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <LinearGradient colors={['#E0F2FE', '#F3E8FF', '#ffffff']} style={{ flex: 1 }}>
            <View style={{ flex: 1, paddingTop: 64, paddingHorizontal: 24 }}>
                {feedbackMessage && (
                    <View className={`absolute top-16 left-6 right-6 p-4 rounded-2xl z-50 ${feedbackMessage.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`}>
                        <Text className="text-white text-center font-bold">{feedbackMessage.text}</Text>
                    </View>
                )}
                <View className="flex-row justify-between items-center mb-6">
                    <Text className="text-3xl font-extrabold text-zinc-900">Negocios</Text>
                </View>

                {isLoading ? (
                    <ActivityIndicator size="large" color="#0f172a" className="mt-10" />
                ) : (
                    <FlatList
                        data={tenants}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={{ paddingBottom: 120 }}
                        showsVerticalScrollIndicator={false}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0f172a" />}
                        renderItem={renderItem}
                        ListEmptyComponent={() => (
                            <View className="items-center justify-center mt-20">
                                <FontAwesome name="building" size={40} color="#94a3b8" />
                                <Text className="text-zinc-500 text-center mt-4 font-medium">No hay negocios registrados.</Text>
                            </View>
                        )}
                    />
                )}

                <TouchableOpacity
                    style={{ position: 'absolute', bottom: 110, right: 24, shadowColor: '#0f172a', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 10 }}
                    onPress={openCreateModal}
                >
                    <LinearGradient colors={['#334155', '#0f172a']} style={{ width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' }}>
                        <FontAwesome name="plus" size={24} color="#ffffff" />
                    </LinearGradient>
                </TouchableOpacity>

                <Modal visible={isModalVisible} animationType="slide" transparent={true}>
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 justify-end bg-black/50">
                        <View className="bg-white rounded-t-[40px] p-8 shadow-2xl">
                            <View className="w-12 h-1.5 bg-zinc-200 rounded-full self-center mb-6" />
                            <View className="flex-row justify-between items-center mb-6">
                                <Text className="text-3xl font-extrabold text-zinc-900">{isEditing ? 'Editar Negocio' : 'Nuevo Negocio'}</Text>
                                <TouchableOpacity onPress={() => setIsModalVisible(false)} className="bg-zinc-100 w-10 h-10 rounded-full items-center justify-center">
                                    <FontAwesome name="close" size={18} color="#52525b" />
                                </TouchableOpacity>
                            </View>

                            <View className="items-center mb-6">
                                <TouchableOpacity onPress={pickImage} className="w-24 h-24 bg-zinc-100 rounded-full items-center justify-center border-2 border-dashed border-zinc-300 overflow-hidden">
                                    {logoBase64 ? (
                                        <Image source={{ uri: `data:image/${logoExt};base64,${logoBase64}` }} style={{ width: 96, height: 96, borderRadius: 48 }} />
                                    ) : currentLogoUrl ? (
                                        <Image source={{ uri: currentLogoUrl }} style={{ width: 96, height: 96, borderRadius: 48 }} />
                                    ) : (
                                        <FontAwesome name="camera" size={24} color="#a1a1aa" />
                                    )}
                                </TouchableOpacity>
                                <Text className="text-zinc-400 text-xs mt-2">{logoBase64 || currentLogoUrl ? 'Toca para cambiar logo' : 'Toca para subir logo'}</Text>
                            </View>

                            <Text className="text-zinc-500 mb-2 text-xs font-bold uppercase tracking-wider">Nombre del Negocio</Text>
                            <TextInput className="bg-zinc-50 text-zinc-900 rounded-2xl px-5 py-4 mb-5 border border-zinc-200 font-medium" placeholder="Ej. Barbería El Rey" placeholderTextColor="#a1a1aa" value={name} onChangeText={setName} />

                            <Text className="text-zinc-500 mb-2 text-xs font-bold uppercase tracking-wider">Dirección</Text>
                            <TextInput className="bg-zinc-50 text-zinc-900 rounded-2xl px-5 py-4 mb-5 border border-zinc-200 font-medium" placeholder="Ej. Av. Principal 123" placeholderTextColor="#a1a1aa" value={address} onChangeText={setAddress} />

                            <Text className="text-zinc-500 mb-2 text-xs font-bold uppercase tracking-wider">Teléfono</Text>
                            <TextInput className="bg-zinc-50 text-zinc-900 rounded-2xl px-5 py-4 mb-8 border border-zinc-200 font-medium" placeholder="Ej. +591 12345678" placeholderTextColor="#a1a1aa" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />

                            <TouchableOpacity onPress={handleSave} disabled={isCreating || isUpdating} className="w-full rounded-2xl overflow-hidden shadow-lg shadow-zinc-400">
                                <LinearGradient colors={['#334155', '#0f172a']} style={{ paddingVertical: 18, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}>
                                    {isCreating || isUpdating ? <ActivityIndicator color="#ffffff" /> : <><Text className="text-white font-bold text-lg mr-2">{isEditing ? 'Guardar Cambios' : 'Crear Negocio'}</Text><FontAwesome name="check" size={16} color="#ffffff" /></>}
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </KeyboardAvoidingView>
                </Modal>
            </View>
        </LinearGradient>
    );
}