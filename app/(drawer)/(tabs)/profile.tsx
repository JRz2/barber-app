import { Toast } from '@/components/Toast';
import { useAuth } from '@/src/features/auth/hooks/useAuth';
import { useUserProfile } from '@/src/hooks/useUserProfile';
import { supabase } from '@/src/lib/supabase';
import { FontAwesome } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { decode } from 'base64-arraybuffer';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Modal, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function ProfileScreen() {
    const { session, signOut } = useAuth();
    const { data: profile, isLoading: isLoadingProfile } = useUserProfile();
    const queryClient = useQueryClient();

    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

    const [isLoading, setIsLoading] = useState(false);
    const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const [isOptionsModalVisible, setIsOptionsModalVisible] = useState(false);
    const [isPasswordModalVisible, setIsPasswordModalVisible] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
    const [passwordFeedback, setPasswordFeedback] = useState<{ type: 'error' | 'success', text: string } | null>(null);

    // Sincronizar los datos del caché local con el formulario
    useEffect(() => {
        if (profile) {
            setFullName(profile.fullName);
            setAvatarUrl(profile.avatarUrl);
        }
        if (session?.user) {
            setEmail(session.user.email || '');
        }
    }, [profile, session]);

    const showFeedback = (type: 'success' | 'error', text: string) => {
        setFeedbackMessage({ type, text });
    };

    // MUTACIÓN PARA ACTUALIZAR EL NOMBRE
    const updateProfileMutation = useMutation({
        mutationFn: async (newName: string) => {
            // 1. Actualizar Auth
            const { error: authError } = await supabase.auth.updateUser({ data: { full_name: newName } });
            if (authError) throw authError;

            // 2. Actualizar tabla profiles y verificar que se actualizó
            const { data, error: dbError } = await supabase
                .from('profiles')
                .update({ full_name: newName })
                .eq('id', session!.user.id)
                .select();

            if (dbError) throw dbError;

            if (!data || data.length === 0) {
                throw new Error('No se pudo actualizar. Verifica los permisos (RLS).');
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['userProfile'] });
            queryClient.invalidateQueries({ queryKey: ['users'] });
            showFeedback('success', 'Perfil actualizado correctamente');
        },
        onError: (error: any) => {
            showFeedback('error', error.message || 'Error al actualizar perfil');
        },
    });

    const updateAvatarMutation = useMutation({
        mutationFn: async (imageData: { base64: string, ext: string }) => {
            const filePath = `${session!.user.id}/avatar.${imageData.ext}`;

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, decode(imageData.base64), { contentType: `image/${imageData.ext}`, upsert: true });
            if (uploadError) throw uploadError;

            const { error: dbError } = await supabase.from('profiles').update({ avatar_url: filePath }).eq('id', session!.user.id);
            if (dbError) throw dbError;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['userProfile'] });
            queryClient.invalidateQueries({ queryKey: ['users'] });
            showFeedback('success', 'Foto actualizada correctamente');
        },
        onError: (error: any) => showFeedback('error', error.message || 'Error al subir la imagen'),
    });

    const uploadImage = (result: ImagePicker.ImagePickerResult) => {
        if (result.canceled || !result.assets[0].base64) return;
        const ext = result.assets[0].uri.split('.').pop() || 'jpg';
        updateAvatarMutation.mutate({ base64: result.assets[0].base64, ext });
    };

    const takePhoto = async () => {
        setIsOptionsModalVisible(false);
        const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
        if (!permissionResult.granted) { showFeedback('error', 'Se necesitan permisos para la cámara'); return; }
        const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.5, base64: true });
        uploadImage(result);
    };

    const pickFromGallery = async () => {
        setIsOptionsModalVisible(false);
        const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.5, base64: true });
        uploadImage(result);
    };

    const handleSaveProfile = () => {
        if (!fullName.trim()) { showFeedback('error', 'El nombre no puede estar vacío'); return; }
        updateProfileMutation.mutate(fullName);
    };

    const handleUpdatePassword = async () => {
        setPasswordFeedback(null);
        if (!currentPassword || !newPassword || !confirmPassword) { setPasswordFeedback({ type: 'error', text: 'Todos los campos son obligatorios' }); return; }
        if (newPassword.length < 6) { setPasswordFeedback({ type: 'error', text: 'La nueva contraseña debe tener al menos 6 caracteres' }); return; }
        if (newPassword !== confirmPassword) { setPasswordFeedback({ type: 'error', text: 'Las contraseñas nuevas no coinciden' }); return; }
        if (newPassword === currentPassword) { setPasswordFeedback({ type: 'error', text: 'La nueva contraseña no puede ser igual a la actual' }); return; }

        setIsUpdatingPassword(true);
        try {
            const { error: authError } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
            if (authError) throw new Error('La contraseña actual es incorrecta');
            const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
            if (updateError) {
                if (updateError.message.includes('different from the old password')) throw new Error('La nueva contraseña no puede ser igual a la actual');
                throw updateError;
            }
            setIsPasswordModalVisible(false);
            setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setPasswordFeedback(null);
            setTimeout(() => showFeedback('success', '¡Contraseña actualizada con éxito!'), 350);
        } catch (error: any) {
            setPasswordFeedback({ type: 'error', text: error.message || 'Error al cambiar contraseña' });
        } finally { setIsUpdatingPassword(false); }
    };

    const initials = fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'US';

    return (
        <LinearGradient colors={['#E0F2FE', '#F3E8FF', '#ffffff']} style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
                <View className="pt-16 pb-6 items-center relative">
                    <TouchableOpacity onPress={signOut} className="absolute top-16 left-6 bg-white/60 w-10 h-10 rounded-full items-center justify-center border border-white shadow-sm"><FontAwesome name="sign-out" size={18} color="#ef4444" /></TouchableOpacity>
                    <Text className="text-3xl font-extrabold text-zinc-900">Mi Perfil</Text>
                    <Text className="text-zinc-500 font-medium">Gestiona tu información personal</Text>
                </View>

                <View className="items-center mb-8">
                    <View className="relative">
                        <View className="w-32 h-32 rounded-full border-4 border-white shadow-xl bg-zinc-200 items-center justify-center overflow-hidden">
                            {avatarUrl ? <Image source={{ uri: avatarUrl }} style={{ width: '100%', height: '100%' }} /> : <Text className="text-4xl font-bold text-zinc-500">{initials}</Text>}
                        </View>
                        <TouchableOpacity onPress={() => setIsOptionsModalVisible(true)} className="absolute bottom-0 right-0 bg-zinc-900 w-10 h-10 rounded-full items-center justify-center border-2 border-white shadow-md">
                            {updateAvatarMutation.isPending ? <ActivityIndicator color="#fff" size="small" /> : <FontAwesome name="camera" size={16} color="#ffffff" />}
                        </TouchableOpacity>
                    </View>
                </View>

                <View className="px-6 space-y-4">
                    <View className="bg-white p-6 rounded-[28px] shadow-sm border border-zinc-100">
                        <Text className="text-zinc-500 mb-2 text-xs font-bold uppercase tracking-wider">Correo Electrónico</Text>
                        <View className="flex-row items-center bg-zinc-100 rounded-xl px-4 py-3 mb-5"><FontAwesome name="envelope" size={16} color="#a1a1aa" /><Text className="text-zinc-500 ml-3 font-medium">{email}</Text><FontAwesome name="lock" size={14} color="#a1a1aa" className="ml-auto" /></View>
                        <Text className="text-zinc-500 mb-2 text-xs font-bold uppercase tracking-wider">Nombre Completo</Text>
                        <View className="flex-row items-center bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 mb-4"><FontAwesome name="user" size={16} color="#71717a" /><TextInput className="flex-1 text-zinc-900 ml-3 font-medium outline-none" value={fullName} onChangeText={setFullName} placeholder="Tu nombre" placeholderTextColor="#a1a1aa" /></View>
                        <View className="items-end">
                            <TouchableOpacity onPress={handleSaveProfile} disabled={updateProfileMutation.isPending} className="rounded-xl overflow-hidden shadow-md shadow-amber-500/20">
                                <LinearGradient colors={['#f59e0b', '#d97706']} style={{ paddingVertical: 10, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}>
                                    {updateProfileMutation.isPending ? <ActivityIndicator color="#ffffff" size="small" /> : <><Text className="text-white font-bold text-sm mr-2">Guardar</Text><FontAwesome name="check" size={12} color="#ffffff" /></>}
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <Text className="text-zinc-800 text-lg font-bold mb-2 ml-2 mt-4">Seguridad</Text>
                    <View className="bg-white p-6 rounded-[28px] shadow-sm border border-zinc-100 mb-6">
                        <TouchableOpacity onPress={() => { setPasswordFeedback(null); setIsPasswordModalVisible(true); }} className="flex-row items-center justify-between">
                            <View className="flex-row items-center">
                                <View className="w-10 h-10 bg-amber-100 rounded-full items-center justify-center mr-4"><FontAwesome name="lock" size={18} color="#f59e0b" /></View>
                                <View><Text className="text-zinc-900 font-bold text-base">Cambiar Contraseña</Text><Text className="text-zinc-500 text-xs">Actualiza tu clave de acceso</Text></View>
                            </View>
                            <FontAwesome name="chevron-right" size={16} color="#a1a1aa" />
                        </TouchableOpacity>
                    </View>
                    <Text className="text-center text-zinc-400 text-xs mt-8 mb-10">Barber Soft v1.0.0</Text>
                </View>
            </ScrollView>

            <Toast visible={!!feedbackMessage} type={feedbackMessage?.type || 'success'} text={feedbackMessage?.text || ''} onHide={() => setFeedbackMessage(null)} />

            <Modal visible={isOptionsModalVisible} animationType="slide" transparent={true}>
                <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={() => setIsOptionsModalVisible(false)} activeOpacity={1}>
                    <View className="bg-white rounded-t-[40px] p-8 pb-12 shadow-2xl mt-auto">
                        <View className="w-12 h-1.5 bg-zinc-200 rounded-full self-center mb-8" />
                        <Text className="text-2xl font-extrabold text-zinc-900 mb-6 text-center">Foto de perfil</Text>
                        <TouchableOpacity onPress={takePhoto} className="flex-row items-center bg-zinc-50 p-5 rounded-2xl mb-4 border border-zinc-100"><View className="w-12 h-12 bg-amber-100 rounded-full items-center justify-center mr-4"><FontAwesome name="camera" size={22} color="#f59e0b" /></View><View><Text className="text-zinc-900 font-bold text-lg">Tomar foto</Text><Text className="text-zinc-500 text-xs">Usa la cámara de tu dispositivo</Text></View></TouchableOpacity>
                        <TouchableOpacity onPress={pickFromGallery} className="flex-row items-center bg-zinc-50 p-5 rounded-2xl mb-4 border border-zinc-100"><View className="w-12 h-12 bg-blue-100 rounded-full items-center justify-center mr-4"><FontAwesome name="image" size={22} color="#3b82f6" /></View><View><Text className="text-zinc-900 font-bold text-lg">Elegir de la galería</Text><Text className="text-zinc-500 text-xs">Selecciona una foto existente</Text></View></TouchableOpacity>
                        <TouchableOpacity onPress={() => setIsOptionsModalVisible(false)} className="mt-2 py-4"><Text className="text-center text-zinc-500 font-bold text-lg">Cancelar</Text></TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

            <Modal visible={isPasswordModalVisible} animationType="slide" transparent={true}>
                <View className="flex-1 justify-end bg-black/50">
                    <TouchableOpacity style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} onPress={() => setIsPasswordModalVisible(false)} activeOpacity={1} />
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="bg-white rounded-t-[40px] p-8 shadow-2xl">
                        <View className="w-12 h-1.5 bg-zinc-200 rounded-full self-center mb-6" />
                        <View className="flex-row justify-between items-center mb-6"><Text className="text-2xl font-extrabold text-zinc-900">Seguridad</Text><TouchableOpacity onPress={() => setIsPasswordModalVisible(false)} className="bg-zinc-100 w-10 h-10 rounded-full items-center justify-center"><FontAwesome name="close" size={18} color="#52525b" /></TouchableOpacity></View>
                        <Text className="text-zinc-500 mb-2 text-xs font-bold uppercase tracking-wider">Contraseña Actual</Text>
                        <View className="flex-row items-center bg-zinc-50 border border-zinc-200 rounded-2xl px-5 py-4 mb-4"><FontAwesome name="lock" size={16} color="#a1a1aa" /><TextInput className="flex-1 text-zinc-900 ml-3 font-medium outline-none" value={currentPassword} onChangeText={setCurrentPassword} placeholder="Tu contraseña actual" placeholderTextColor="#a1a1aa" secureTextEntry /></View>
                        <Text className="text-zinc-500 mb-2 text-xs font-bold uppercase tracking-wider">Nueva Contraseña</Text>
                        <View className="flex-row items-center bg-zinc-50 border border-zinc-200 rounded-2xl px-5 py-4 mb-4"><FontAwesome name="key" size={16} color="#a1a1aa" /><TextInput className="flex-1 text-zinc-900 ml-3 font-medium outline-none" value={newPassword} onChangeText={setNewPassword} placeholder="Mínimo 6 caracteres" placeholderTextColor="#a1a1aa" secureTextEntry /></View>
                        <Text className="text-zinc-500 mb-2 text-xs font-bold uppercase tracking-wider">Confirmar Nueva Contraseña</Text>
                        <View className="flex-row items-center bg-zinc-50 border border-zinc-200 rounded-2xl px-5 py-4 mb-4"><FontAwesome name="check-circle" size={16} color="#a1a1aa" /><TextInput className="flex-1 text-zinc-900 ml-3 font-medium outline-none" value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Repite la nueva contraseña" placeholderTextColor="#a1a1aa" secureTextEntry /></View>
                        {passwordFeedback && (<View className={`p-3 rounded-xl mb-4 flex-row items-center ${passwordFeedback.type === 'error' ? 'bg-red-50' : 'bg-emerald-50'}`}><FontAwesome name={passwordFeedback.type === 'error' ? 'exclamation-circle' : 'check-circle'} size={16} color={passwordFeedback.type === 'error' ? '#ef4444' : '#10b981'} /><Text className={`ml-2 font-medium flex-1 ${passwordFeedback.type === 'error' ? 'text-red-500' : 'text-emerald-600'}`}>{passwordFeedback.text}</Text></View>)}
                        <TouchableOpacity onPress={handleUpdatePassword} disabled={isUpdatingPassword} className="w-full rounded-2xl overflow-hidden shadow-lg shadow-amber-500/30 mt-2">
                            <LinearGradient colors={['#f59e0b', '#d97706']} style={{ paddingVertical: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}>
                                {isUpdatingPassword ? <ActivityIndicator color="#ffffff" /> : <Text className="text-white font-bold text-lg">Actualizar Contraseña</Text>}
                            </LinearGradient>
                        </TouchableOpacity>
                    </KeyboardAvoidingView>
                </View>
            </Modal>
        </LinearGradient>
    );
}