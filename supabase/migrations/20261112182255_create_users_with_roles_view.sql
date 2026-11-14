-- supabase/migrations/xxxx_create_users_with_roles_view.sql

CREATE OR REPLACE VIEW public.v_users_with_roles AS
SELECT 
    p.id,
    p.full_name,
    p.email,
    p.avatar_url,
    r.role,
    CASE 
        WHEN r.role = 'SUPER_ADMIN' THEN 1
        WHEN r.role = 'ADMIN' THEN 2
        WHEN r.role = 'ENCARGADO' THEN 3
        ELSE 4
    END AS role_order
FROM 
    public.profiles p
LEFT JOIN 
    public.user_roles r ON p.id = r.user_id;

GRANT SELECT ON public.v_users_with_roles TO authenticated;