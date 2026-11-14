-- Permitir actualizaciones en la tabla profiles a usuarios autenticados
GRANT UPDATE ON public.profiles TO authenticated;

-- Asegurar que un usuario solo pueda actualizar su propio perfil
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);