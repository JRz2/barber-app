import { verifyInstallation } from 'nativewind';
import { Text, View } from "react-native";

export default function TabOneScreen() {

  verifyInstallation();
  
  return (
    <View className="flex-1 items-center justify-center bg-zinc-900">
      <Text className="text-2xl font-bold text-amber-500">
        ¡Bienvenido a Barber App!
      </Text>
      <Text className="mt-2 text-gray-300">
        NativeWind está funcionando correctamente.
      </Text>
    </View>
  );
}