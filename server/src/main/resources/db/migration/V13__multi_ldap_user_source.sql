ALTER TABLE ldap_server_config ADD COLUMN priority INTEGER NOT NULL DEFAULT 0;

ALTER TABLE users ADD COLUMN ldap_server_id UUID REFERENCES ldap_server_config(id) ON DELETE SET NULL;
