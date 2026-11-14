import { useAuth } from '@/src/features/auth/hooks/useAuth';
import { FontAwesome } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { z } from 'zod';

const loginSchema = z.object({
    email: z.string().email('Correo electrónico inválido'),
    password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginScreen() {
    const { signIn } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

    const [isEmailFocused, setIsEmailFocused] = useState(false);
    const [isPasswordFocused, setIsPasswordFocused] = useState(false);

    const { control, handleSubmit, formState: { errors } } = useForm<LoginFormData>({
        resolver: zodResolver(loginSchema),
        defaultValues: { email: '', password: '' },
    });

    const onSubmit = async (data: LoginFormData) => {
        setIsLoading(true);
        setFeedbackMessage(null);

        const { error } = await signIn(data.email, data.password);
        setIsLoading(false);

        if (error) {
            setFeedbackMessage(error.message || 'Error al iniciar sesión');
        } else {
            // Si no hay error, forzamos la entrada al Dashboard
            router.replace('/(drawer)/(tabs)');
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="flex-1 bg-black"
        >
            <LinearGradient
                colors={['#1e1e24', '#09090b', '#000000']}
                locations={[0, 0.6, 1]}
                className="flex-1"
            >
                <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingTop: 40, paddingBottom: 20 }}>

                    {/* Logo y Título */}
                    <View className="items-center mb-12">
                        <Image
                            source={require('@/assets/images/skull-logo.png')}
                            style={{ width: 110, height: 110 }}
                            className="mb-4"
                            resizeMode="contain"
                        />
                        <Text className="text-4xl font-extrabold text-white tracking-wider">Barber Soft</Text>
                        <Text className="text-amber-500 font-medium mt-2 text-base text-center uppercase tracking-widest">
                            Premium Grooming
                        </Text>
                        <Text className="text-zinc-500 mt-3 text-center text-sm">
                            Bienvenido de nuevo. Ingresa tus credenciales.
                        </Text>
                    </View>

                    {/* Mensaje de Error */}
                    {feedbackMessage && (
                        <View className="bg-red-500/10 border border-red-500/50 p-3 rounded-xl mb-6">
                            <Text className="text-red-500 text-center text-sm">{feedbackMessage}</Text>
                        </View>
                    )}

                    {/* Formulario */}
                    <View className="space-y-5">
                        {/* Email */}
                        <View>
                            <Text className="text-zinc-400 mb-2 text-xs font-bold uppercase tracking-wider">Correo Electrónico</Text>
                            <View className={`flex-row items-center bg-[#1a1a1a] rounded-xl px-4 border ${errors.email ? 'border-red-500/50' : isEmailFocused ? 'border-amber-500' : 'border-zinc-800'}`}>
                                <FontAwesome name="envelope" size={16} color={isEmailFocused ? "#f59e0b" : "#52525b"} />
                                <Controller
                                    control={control}
                                    name="email"
                                    render={({ field: { onChange, onBlur, value } }) => (
                                        <TextInput
                                            className="flex-1 text-white py-4 px-3 bg-transparent outline-none"
                                            placeholder="ejemplo@barbersoft.com"
                                            placeholderTextColor="#52525b"
                                            onBlur={() => { onBlur(); setIsEmailFocused(false); }}
                                            onFocus={() => setIsEmailFocused(true)}
                                            onChangeText={onChange}
                                            value={value}
                                            autoCapitalize="none"
                                            keyboardType="email-address"
                                        />
                                    )}
                                />
                            </View>
                            {errors.email && <Text className="text-red-500 text-xs mt-1 ml-1">{errors.email.message}</Text>}
                        </View>

                        {/* Contraseña */}
                        <View>
                            <Text className="text-zinc-400 mb-2 text-xs font-bold uppercase tracking-wider">Contraseña</Text>
                            <View className={`flex-row items-center bg-[#1a1a1a] rounded-xl px-4 border ${errors.password ? 'border-red-500/50' : isPasswordFocused ? 'border-amber-500' : 'border-zinc-800'}`}>
                                <FontAwesome name="lock" size={18} color={isPasswordFocused ? "#f59e0b" : "#52525b"} />
                                <Controller
                                    control={control}
                                    name="password"
                                    render={({ field: { onChange, onBlur, value } }) => (
                                        <TextInput
                                            className="flex-1 text-white py-4 px-3 bg-transparent outline-none"
                                            placeholder="••••••••"
                                            placeholderTextColor="#52525b"
                                            onBlur={() => { onBlur(); setIsPasswordFocused(false); }}
                                            onFocus={() => setIsPasswordFocused(true)}
                                            onChangeText={onChange}
                                            value={value}
                                            secureTextEntry={!showPassword}
                                        />
                                    )}
                                />
                                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} className="p-2">
                                    <FontAwesome name={showPassword ? "eye-slash" : "eye"} size={16} color="#52525b" />
                                </TouchableOpacity>
                            </View>
                            {errors.password && <Text className="text-red-500 text-xs mt-1 ml-1">{errors.password.message}</Text>}
                        </View>

                        {/* Botón Login */}
                        <TouchableOpacity
                            className="w-full bg-amber-500 rounded-xl py-4 mt-6 flex-row justify-center items-center shadow-lg shadow-amber-500/40"
                            onPress={() => handleSubmit(onSubmit)()}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <ActivityIndicator color="#000000" />
                            ) : (
                                <>
                                    <Text className="text-black font-extrabold text-lg tracking-wide uppercase mr-2">Iniciar Sesión</Text>
                                    <FontAwesome name="arrow-right" size={16} color="#000000" />
                                </>
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Separador y Texto de Acceso Restringido */}
                    <View className="mt-12 items-center">
                        <View className="flex-row items-center w-full mb-6">
                            <View className="flex-1 h-[1px] bg-zinc-800" />
                            <FontAwesome name="scissors" size={14} color="#3f3f46" className="mx-4" />
                            <View className="flex-1 h-[1px] bg-zinc-800" />
                        </View>

                        <View className="flex-row items-center bg-zinc-900/50 px-4 py-2 rounded-full border border-zinc-800">
                            <FontAwesome name="lock" size={12} color="#71717a" />
                            <Text className="text-zinc-500 text-xs ml-2 font-medium">
                                Acceso exclusivo para personal autorizado
                            </Text>
                        </View>
                    </View>

                    {/* Footer con Logo JetStack */}
                    <View className="mt-16 items-center justify-center flex-row opacity-60">
                        <Text className="text-zinc-600 text-xs mr-2 font-medium">Powered by</Text>
                        <Image
                            source={require('@/assets/images/jetstack-logo.png')}
                            style={{ width: 100, height: 30 }}
                            resizeMode="contain"
                        />
                    </View>

                </ScrollView>
            </LinearGradient>
        </KeyboardAvoidingView>
    );
}