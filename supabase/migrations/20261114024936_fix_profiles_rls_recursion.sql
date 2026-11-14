-- 1. Función helper SECURITY DEFINER que evade RLS para leer el tenant_id
CREATE OR REPLACE FUNCTION public.get_my_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.profiles WHERE id = auth.uid();
$$;

-- 2. Eliminar la política recursiva
DROP POLICY IF EXISTS "Allow read access based on tenant" ON public.profiles;

-- 3. Crear la política corregida (sin subconsulta recursiva)
CREATE POLICY "Allow read access based on tenant"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  (auth.jwt() ->> 'user_role') = 'SUPER_ADMIN'
  OR
  tenant_id = public.get_my_tenant_id()
);