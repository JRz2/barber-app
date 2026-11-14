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

    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    let roleFromToken = null;
    if (token) {
      const payload = JSON.parse(atob(token.split(".")[1]));
      roleFromToken = payload.user_role;
    }

    if (roleFromToken !== "SUPER_ADMIN") {
      return new Response(JSON.stringify({ error: "Permiso denegado. Solo SUPER_ADMIN" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { action, userId, full_name, email, role, newPassword, tenant_id } = await req.json();

    if (action === 'reset_password') {
      if (!newPassword || newPassword.length < 6) {
        return new Response(JSON.stringify({ error: "La contraseña debe tener al menos 6 caracteres" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password: newPassword });
      if (error) throw error;

      return new Response(JSON.stringify({ message: "Contraseña restablecida" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === 'delete') {
      const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (error) throw error;
      return new Response(JSON.stringify({ message: "Usuario eliminado" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } 
    
    if (action === 'update') {
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        email,
        user_metadata: { full_name }
      });
      if (authError) throw authError;

      // Incluimos tenant_id en la actualización
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update({ full_name, email, tenant_id })
        .eq('id', userId);
      if (profileError) throw profileError;

      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .update({ role })
        .eq('user_id', userId);
      if (roleError) throw roleError;

      return new Response(JSON.stringify({ message: "Usuario actualizado" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Acción no válida" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});