-- ============================================================
-- AUTO-ASSIGN DEFAULT ROLES ON USER SIGNUP
-- Run this in Supabase SQL Editor
-- ============================================================

-- Step 1: Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role, organization_id)
  VALUES (new.id, 'viewer', NULL);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Step 2: Create trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user();

-- Step 3: Verify trigger created
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

-- ============================================================
-- RESULT: Every new user will automatically get 'viewer' role
-- Admins can upgrade roles via Admin Panel afterwards
-- ============================================================
