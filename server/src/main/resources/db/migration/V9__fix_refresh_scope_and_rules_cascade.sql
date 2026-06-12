-- Fix: store scope on refresh_tokens so refresh grants retain the originally-issued scope
ALTER TABLE refresh_tokens ADD COLUMN scope VARCHAR(500);

-- Fix: change ON DELETE CASCADE to ON DELETE SET NULL for ldap_server_id on app_access_rules.
-- Deleting an LDAP server config previously silently deleted ALL rules referencing it,
-- leaving apps in LDAP_GROUP/LDAP_OU mode with zero rules (silent user lockout).
-- SET NULL makes those rules server-agnostic (match any server) instead of vanishing.
ALTER TABLE app_access_rules DROP CONSTRAINT IF EXISTS app_access_rules_ldap_server_id_fkey;
ALTER TABLE app_access_rules ADD CONSTRAINT app_access_rules_ldap_server_id_fkey
    FOREIGN KEY (ldap_server_id) REFERENCES ldap_server_config(id) ON DELETE SET NULL;
