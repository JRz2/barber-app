import { useAuth } from '@/src/features/auth/hooks/useAuth';
import { supabase } from '@/src/lib/supabase';
import { useQuery } from '@tanstack/react-query';

export function useUserProfile() {
  const { session } = useAuth();

  return useQuery({
    queryKey: ['userProfile', session?.user?.id],
    queryFn: async () => {
      if (!session?.user) {
        return null;
      }

      // 1er intento
      let { data: profile, error } = await supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', session.user.id)
        .single();

      // Si el JWT expiró, refrescamos y reintentamos
      if (error && (error.message.includes('JWT expired') || error.code === 'PGRST303')) {
        const { error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshError) {
          throw refreshError;
        }

        const retry = await supabase
          .from('profiles')
          .select('full_name, avatar_url')
          .eq('id', session.user.id)
          .single();
        
        profile = retry.data;
        error = retry.error;
      }

      if (error) throw error;

      let avatarSignedUrl = null;
      if (profile?.avatar_url) {
        const { data: urlData } = await supabase.storage
          .from('avatars')
          .createSignedUrl(profile.avatar_url, 3600);
        avatarSignedUrl = urlData?.signedUrl || null;
      }

      const result = {
        fullName: profile?.full_name || session.user.user_metadata?.full_name || 'Usuario',
        avatarUrl: avatarSignedUrl,
        email: session.user.email,
      };
      
      return result;
    },
    enabled: !!session?.user?.id,
  });
}