-- Create a function to get ALL users with their roles (or null if no role)
CREATE OR REPLACE FUNCTION get_users_with_roles()
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  role VARCHAR(50),
  created_at TIMESTAMP
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    au.id,
    au.email::TEXT,
    ur.role,
    COALESCE(ur.created_at, au.created_at::TIMESTAMP)
  FROM auth.users au
  LEFT JOIN user_roles ur ON ur.user_id = au.id
  ORDER BY au.created_at DESC;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_users_with_roles() TO authenticated;

-- Test it
SELECT * FROM get_users_with_roles();
