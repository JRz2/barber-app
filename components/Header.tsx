import { useAuth } from '@/src/features/auth/hooks/useAuth';
import { FontAwesome } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';

export function Header({ onMenuPress }: { onMenuPress?: () => void }) {
    const { session, signOut } = useAuth();
    const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
    const [isSigningOut, setIsSigningOut] = useState(false);

    const fullName = session?.user?.user_metadata?.full_name || 'Usuario';
    const initials = fullName
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase();

    const handleSignOut = async () => {
        setIsSigningOut(true);
        setIsProfileMenuOpen(false);
        await signOut();
    };

    return (
        <View className="flex-row items-center justify-between px-4 pt-4 pb-0 z-50">
            <TouchableOpacity
                className="w-10 h-10 bg-white/60 rounded-full items-center justify-center border border-white"
                onPress={onMenuPress}
            >
                <FontAwesome name="bars" size={20} color="#000000" />
            </TouchableOpacity>

            <View className="relative">
                <TouchableOpacity
                    className="w-10 h-10 bg-zinc-900 rounded-full items-center justify-center border-2 border-white shadow-sm"
                    onPress={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                    disabled={isSigningOut}
                >
                    {isSigningOut ? (
                        <ActivityIndicator color="#ffffff" size="small" />
                    ) : (
                        <Text className="text-white font-bold text-sm">{initials}</Text>
                    )}
                </TouchableOpacity>

                {isProfileMenuOpen && !isSigningOut && (
                    <>
                        <TouchableOpacity
                            style={{ position: 'absolute', top: -1000, left: -1000, right: -1000, bottom: -1000, zIndex: -1 }}
                            onPress={() => setIsProfileMenuOpen(false)}
                        />

                        <View
                            className="absolute right-0 bg-white rounded-2xl shadow-xl w-52 border border-zinc-100 overflow-hidden"
                            style={{ top: 48, zIndex: 100 }}
                        >
                            <View className="p-4 border-b border-zinc-100 bg-zinc-50">
                                <Text className="text-zinc-900 font-bold">{fullName}</Text>
                                <Text className="text-zinc-500 text-xs">{session?.user?.email}</Text>
                            </View>

                            <TouchableOpacity
                                className="flex-row items-center p-4 border-b border-zinc-100"
                                onPress={() => setIsProfileMenuOpen(false)}
                            >
                                <FontAwesome name="user" size={16} color="#3b82f6" />
                                <Text className="ml-3 text-zinc-700 font-medium">Mi Perfil</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                className="flex-row items-center p-4 bg-red-50"
                                onPress={handleSignOut}
                            >
                                <FontAwesome name="sign-out" size={16} color="#ef4444" />
                                <Text className="ml-3 text-red-500 font-medium">Cerrar Sesión</Text>
                            </TouchableOpacity>
                        </View>
                    </>
                )}
            </View>
        </View>
    );
}