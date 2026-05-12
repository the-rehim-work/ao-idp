-- Add permissions column to admin_users for fine-grained section access control
ALTER TABLE admin_users ADD COLUMN permissions TEXT[] NOT NULL DEFAULT '{}';

-- Grant full section access to existing idp_admin accounts
UPDATE admin_users
SET permissions = ARRAY['dashboard','applications','users','directory','audit','logs','database','admins','settings']
WHERE admin_type = 'idp_admin';

-- Grant default section access to existing app_admin accounts
UPDATE admin_users
SET permissions = ARRAY['dashboard','applications','users']
WHERE admin_type = 'app_admin';
