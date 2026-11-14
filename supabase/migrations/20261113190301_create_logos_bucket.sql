-- 1. Crear el bucket 'logos'
INSERT INTO storage.buckets (id, name, public) 
VALUES ('logos', 'logos', false)
ON CONFLICT (id) DO NOTHING;

-- 2. Políticas de Seguridad para el bucket 'logos'

-- Cualquier usuario autenticado puede leer los logos (para mostrarlos en la app)
DROP POLICY IF EXISTS "Authenticated users can read logos" ON storage.objects;
CREATE POLICY "Authenticated users can read logos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'logos');

-- Solo el SUPER_ADMIN puede insertar/actualizar/eliminar logos
DROP POLICY IF EXISTS "Super admin can manage logos" ON storage.objects;
CREATE POLICY "Super admin can manage logos"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'logos' AND (auth.jwt() ->> 'user_role') = 'SUPER_ADMIN');