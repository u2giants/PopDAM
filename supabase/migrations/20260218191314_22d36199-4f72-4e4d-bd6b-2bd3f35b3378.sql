
-- Drop the existing trigger and replace with our version
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Assign default 'user' role
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  -- Mark invitation as accepted if one exists
  UPDATE public.invitations 
  SET accepted_at = now() 
  WHERE email = NEW.email AND accepted_at IS NULL;
  
  -- Create profile if not exists
  INSERT INTO public.profiles (user_id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
