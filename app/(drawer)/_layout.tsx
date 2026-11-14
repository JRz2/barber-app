import { useAuth } from '@/src/features/auth/hooks/useAuth';
import { FontAwesome } from '@expo/vector-icons';
import { Drawer } from 'expo-router/drawer';

export default function DrawerLayout() {
  const { session } = useAuth();

  if (!session) {
    return null;
  }

  return (
    <Drawer
      screenOptions={{
        headerShown: false,
        drawerStyle: { backgroundColor: '#18181b', width: 280 },
        drawerActiveTintColor: '#f59e0b',
        drawerInactiveTintColor: '#a1a1aa',
      }}
    >
      <Drawer.Screen
        name="(tabs)"
        options={{
          title: 'Inicio',
          drawerIcon: ({ color }) => <FontAwesome name="home" size={20} color={color as string} />,
        }}
      />
    </Drawer>
  );
}