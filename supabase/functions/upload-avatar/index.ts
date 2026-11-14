// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    // 1. Verificar que quien llama sea ADMIN o SUPER_ADMIN
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    let roleFromToken = null;
    if (token) {
      const payload = JSON.parse(atob(token.split(".")[1]));
      roleFromToken = payload.user_role;
    }

    if (!['ADMIN', 'SUPER_ADMIN'].includes(roleFromToken)) {
      return new Response(JSON.stringify({ error: "Permiso denegado. Se requiere rol ADMIN o SUPER_ADMIN" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // 2. Obtener los datos de la petición
    const { userId, base64, ext } = await req.json();
    if (!userId || !base64 || !ext) {
      return new Response(JSON.stringify({ error: "Faltan parámetros" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Convertir base64 a ArrayBuffer
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    const filePath = `${userId}/avatar.${ext}`;

    // 3. Subir la imagen usando service_role (se salta las RLS)
    const { error: uploadError } = await supabaseAdmin.storage
      .from('avatars')
      .upload(filePath, bytes.buffer, {
        contentType: `image/${ext}`,
        upsert: true,
      });

    if (uploadError) throw uploadError;

    // 4. Actualizar la tabla profiles con la nueva ruta
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ avatar_url: filePath })
      .eq('id', userId);

    if (profileError) throw profileError;

    return new Response(JSON.stringify({ message: "Avatar subido", avatar_url: filePath }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});