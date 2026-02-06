-- Assign admin role to poornacd24@gmail.com
INSERT INTO user_roles (user_id, role, organization_id)
SELECT 
  id,
  'admin',
  NULL
FROM auth.users
WHERE email = 'poornacd24@gmail.com'
ON CONFLICT (user_id) DO UPDATE SET role = 'admin';

-- Verify the assignment
SELECT user_roles.user_id, auth.users.email, user_roles.role 
FROM user_roles 
JOIN auth.users ON auth.users.id = user_roles.user_id
WHERE auth.users.email = 'poornacd24@gmail.com';
