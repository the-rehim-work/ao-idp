INSERT INTO admin_users (id, username, password_hash, display_name, admin_type, is_active)
VALUES (
    gen_random_uuid(),
    'superadmin',
    '$2b$12$QW5GfFaPJ.CzTVeX/2xhMOcvuFU65v33f/HE0iQuRTxN7g82akPqu',
    'System Administrator',
    'idp_admin',
    true
);
