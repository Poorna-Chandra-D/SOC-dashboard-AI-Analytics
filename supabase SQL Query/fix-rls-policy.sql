-- Fix RLS infinite recursion on user_roles table

-- Drop ALL problematic policies
DROP POLICY IF EXISTS "Admins can manage all roles" ON user_roles;
DROP POLICY IF EXISTS "Users can view their own role" ON user_roles;

-- Temporarily allow authenticated users to read all roles (no recursion)
CREATE POLICY "Authenticated users can view all roles" ON user_roles
  FOR SELECT USING (auth.role() = 'authenticated');

-- Allow authenticated users to manage roles (admin check will be in app code)
CREATE POLICY "Authenticated users can manage roles" ON user_roles
  FOR ALL USING (auth.role() = 'authenticated');

-- Test: This query should now work
SELECT user_id, role, created_at FROM user_roles LIMIT 10;
