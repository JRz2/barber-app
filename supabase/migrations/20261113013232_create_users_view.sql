-- Crear la vista que une perfiles y roles, con un peso numérico para ordenar
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

-- Dar permisos de lectura a los usuarios autenticados
GRANT SELECT ON public.v_users_with_roles TO authenticated;