import { useAuth } from '@/src/features/auth/hooks/useAuth';
import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

export default function Index() {
    const { session, loading } = useAuth();

    if (loading) {
        return (
            <View className="flex-1 bg-zinc-950 justify-center items-center">
                <ActivityIndicator size="large" color="#f59e0b" />
            </View>
        );
    }

    if (session) {
        return <Redirect href="/(drawer)/(tabs)" />;
    }

    return <Redirect href="/(auth)/login" />;
}