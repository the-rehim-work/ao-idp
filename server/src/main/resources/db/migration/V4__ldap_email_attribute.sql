ALTER TABLE ldap_server_config
    ADD COLUMN IF NOT EXISTS email_attribute VARCHAR(100) NOT NULL DEFAULT 'mail';
