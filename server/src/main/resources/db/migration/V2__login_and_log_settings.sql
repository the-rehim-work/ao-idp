INSERT INTO idp_settings (key, value) VALUES
('login_identifier_type', 'any'),
('login_page_title', 'AO ID'),
('log_retention_days', '10')
ON CONFLICT (key) DO NOTHING;
