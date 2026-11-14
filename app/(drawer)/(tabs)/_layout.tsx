import { useAuth } from '@/src/features/auth/hooks/useAuth';
import { FontAwesome } from '@expo/vector-icons';
import { Tabs, usePathname, useRouter } from 'expo-router';
import { jwtDecode } from 'jwt-decode';
import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';

const CustomTabBar = memo(({ isSuperAdmin }: { isSuperAdmin: boolean }) => {
  const pathname = usePathname();
  const router = useRouter();

  const routeConfig: Record<string, { path: string; icon: string; label: string }> = {
    index: { path: '/', icon: 'home', label: 'Inicio' },
    users: { path: '/users', icon: 'users', label: 'Equipo' },
    appointments: { path: '/appointments', icon: 'calendar', label: 'Citas' },
    cash: { path: '/cash', icon: 'money', label: 'Caja' },
    profile: { path: '/profile', icon: 'user', label: 'Perfil' },
    businesses: { path: '/businesses', icon: 'building', label: 'Negocios' },
  };

  const visibleRoutes = isSuperAdmin
    ? ['businesses', 'users', 'profile']
    : ['users', 'appointments', 'index', 'cash', 'profile'];

  return (
    <View
      style={{
        position: 'absolute',
        bottom: 25,
        left: 20,
        right: 20,
        backgroundColor: '#ffffff',
        borderRadius: 30,
        height: 70,
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.15,
        shadowRadius: 15,
        elevation: 10,
      }}
    >
      {visibleRoutes.map((routeName) => {
        const config = routeConfig[routeName];
        const isFocused = pathname === config.path;

        return (
          <Pressable
            key={routeName}
            onPress={() => router.navigate(config.path as any)}
            style={{ alignItems: 'center', flex: 1 }}
          >
            <FontAwesome name={config.icon as any} size={routeName === 'index' ? 24 : 22} color={isFocused ? '#000' : '#a1a1aa'} />
            <Text style={{ fontSize: 10, fontWeight: '600', marginTop: 4, color: isFocused ? '#000' : '#a1a1aa' }}>{config.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
});

export default function TabLayout() {
  const { session } = useAuth();

  if (!session) {
    return null;
  }

  let isSuperAdmin = false;
  if (session?.access_token) {
    try {
      const decoded: any = jwtDecode(session.access_token);
      isSuperAdmin = decoded.user_role === 'SUPER_ADMIN';
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <Tabs
      tabBar={() => <CustomTabBar isSuperAdmin={isSuperAdmin} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" options={{ title: 'Inicio' }} />
      <Tabs.Screen name="users" options={{ title: 'Equipo' }} />
      <Tabs.Screen name="appointments" options={{ title: 'Citas' }} />
      <Tabs.Screen name="cash" options={{ title: 'Caja' }} />
      <Tabs.Screen name="profile" options={{ title: 'Perfil' }} />
      <Tabs.Screen name="businesses" options={{ title: 'Negocios' }} />
    </Tabs>
  );
}