import { Header } from '@/components/Header';
import { useAuth } from '@/src/features/auth/hooks/useAuth';
import { useUserProfile } from '@/src/hooks/useUserProfile';
import { FontAwesome } from '@expo/vector-icons';
import { DrawerActions } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, useNavigation } from 'expo-router';
import { jwtDecode } from 'jwt-decode';
import { SafeAreaView, ScrollView, Text, TouchableOpacity, View } from 'react-native';

export default function DashboardScreen() {
  const { session } = useAuth();
  const { data: profile } = useUserProfile();
  const navigation = useNavigation();

  if (!session) return null;

  let userRole = '';
  if (session?.access_token) {
    try {
      const decoded: any = jwtDecode(session.access_token);
      userRole = decoded.user_role || '';
    } catch (error) { }
  }

  // Si es SUPER_ADMIN, redirigir a Negocios
  if (userRole === 'SUPER_ADMIN') {
    return <Redirect href="/businesses" />;
  }

  const displayName = profile?.fullName?.split(' ')[0] || session.user.user_metadata?.full_name?.split(' ')[0] || 'Admin';

  return (
    <LinearGradient colors={['#E0F2FE', '#F3E8FF', '#ffffff']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <Header onMenuPress={() => navigation.dispatch(DrawerActions.openDrawer())} />

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
          <View className="flex-row justify-between items-center mb-8 mt-4">
            <View>
              <Text className="text-zinc-500 text-sm font-medium">Bienvenido de nuevo,</Text>
              <Text className="text-3xl font-extrabold text-zinc-900">{displayName}</Text>
            </View>
          </View>

          <View className="bg-zinc-900 p-6 rounded-[32px] mb-8 shadow-xl shadow-zinc-400 flex-row items-center justify-between">
            <View>
              <Text className="text-zinc-400 text-sm mb-1 font-medium">Nivel de Acceso</Text>
              <Text className="text-white text-2xl font-bold uppercase tracking-wider">{userRole}</Text>
            </View>
            <View className="w-14 h-14 bg-amber-500 rounded-full items-center justify-center shadow-lg shadow-amber-500/50">
              <FontAwesome name="shield" size={26} color="#000000" />
            </View>
          </View>

          <Text className="text-zinc-800 text-lg font-bold mb-4 ml-1">Acciones Rápidas</Text>

          <View className="flex-row space-x-4 mb-4">
            <TouchableOpacity className="flex-1 bg-zinc-900 p-5 rounded-[28px] shadow-lg shadow-zinc-400">
              <View className="w-12 h-12 bg-white/10 rounded-full items-center justify-center mb-4">
                <FontAwesome name="calendar-plus-o" size={22} color="#60a5fa" />
              </View>
              <Text className="text-white font-bold text-base">Nueva Cita</Text>
              <Text className="text-zinc-400 text-xs mt-1">Agendar cliente</Text>
            </TouchableOpacity>

            <TouchableOpacity className="flex-1 bg-white/70 p-5 rounded-[28px] border border-white shadow-sm">
              <View className="w-12 h-12 bg-green-100 rounded-full items-center justify-center mb-4">
                <FontAwesome name="money" size={22} color="#22c55e" />
              </View>
              <Text className="text-zinc-900 font-bold text-base">Caja</Text>
              <Text className="text-zinc-500 text-xs mt-1">Ver ingresos</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}