-- SPEC 12: username nullable para usuarios OAuth
ALTER TABLE public.profiles ALTER COLUMN username DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'username'  -- NULL para OAuth, valor para email+pass
  );
  RETURN new;
END;
$$;
