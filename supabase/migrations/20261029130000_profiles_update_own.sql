-- SPEC 12: permite a cada usuario actualizar su propio perfil (necesario para el onboarding OAuth)
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));
