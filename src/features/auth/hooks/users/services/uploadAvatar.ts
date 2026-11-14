import { supabase } from '@/src/lib/supabase';
import { decode } from 'base64-arraybuffer';
import * as ImagePicker from 'expo-image-picker';

export async function pickAndUploadAvatar(userId: string) {
  // 1. Pedir permisos (opcional en iOS, requerido en Android 13+)
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Se necesitan permisos para acceder a la galería');
  }

  // 2. Abrir la galería
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true, // Permite recortar
    aspect: [1, 1],      // Forzar recorte cuadrado (útil para avatares)
    quality: 0.5,        // Comprime la imagen para no subir archivos gigantes
    base64: true,        // Necesario para convertir a ArrayBuffer
  });

  if (result.canceled) {
    return null; // El usuario canceló
  }

  const image = result.assets[0];
  const fileExt = image.fileName?.split('.').pop() || 'jpg';
  // La ruta debe ser "userId/nombreArchivo.ext" para que las políticas RLS funcionen
  const filePath = `${userId}/avatar.${fileExt}`;

  // 3. Subir a Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(filePath, decode(image.base64!), {
      contentType: `image/${fileExt}`, // ¡Crítico para que no se suba un archivo de 0 bytes!
      upsert: true, // Sobrescribe si ya existe
    });

  if (uploadError) throw uploadError;

  // 4. Guardar la ruta en la tabla profiles
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ avatar_url: filePath })
    .eq('id', userId);

  if (profileError) throw profileError;

  return filePath; // Retorna la ruta guardada
}