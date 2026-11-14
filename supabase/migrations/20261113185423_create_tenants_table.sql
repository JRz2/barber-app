-- 1. Crear la tabla de Negocios (Tenants)
CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    logo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Añadir tenant_id a la tabla profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL;

-- 3. Eliminar la vista anterior y crearla de nuevo con las columnas correctas
DROP VIEW IF EXISTS public.v_users_with_roles;

CREATE VIEW public.v_users_with_roles AS
SELECT 
    p.id,
    p.full_name,
    p.email,
    p.avatar_url,
    p.tenant_id,
    t.name AS tenant_name,
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
    public.user_roles r ON p.id = r.user_id
LEFT JOIN 
    public.tenants t ON p.tenant_id = t.id;

GRANT SELECT ON public.v_users_with_roles TO authenticated;

-- 4. Políticas de Seguridad (RLS)

-- Habilitar RLS en tenants
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- Los SUPER_ADMIN pueden hacer todo con los tenants
DROP POLICY IF EXISTS "Super admins can manage all tenants" ON public.tenants;
CREATE POLICY "Super admins can manage all tenants"
ON public.tenants
FOR ALL
TO authenticated
USING ( (auth.jwt() ->> 'user_role') = 'SUPER_ADMIN' );

-- Los usuarios normales solo pueden ver su propio tenant
DROP POLICY IF EXISTS "Users can view their own tenant" ON public.tenants;
CREATE POLICY "Users can view their own tenant"
ON public.tenants
FOR SELECT
TO authenticated
USING ( id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()) );

-- Actualizar política de profiles para que los ADMIN vean solo usuarios de su tenant
DROP POLICY IF EXISTS "Allow read access to authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Allow read access based on tenant" ON public.profiles;

CREATE POLICY "Allow read access based on tenant"
ON public.profiles
FOR SELECT
TO authenticated
USING (
    (auth.jwt() ->> 'user_role') = 'SUPER_ADMIN'
    OR
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
);