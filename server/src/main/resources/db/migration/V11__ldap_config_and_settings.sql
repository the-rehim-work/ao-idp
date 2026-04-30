CREATE TABLE ldap_server_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    url VARCHAR(500) NOT NULL,
    base_dn VARCHAR(500) NOT NULL,
    service_account_dn VARCHAR(500) NOT NULL,
    service_account_password VARCHAR(500) NOT NULL,
    username_attribute VARCHAR(100) NOT NULL DEFAULT 'sAMAccountName',
    user_object_class VARCHAR(100) NOT NULL DEFAULT 'user',
    additional_user_filter VARCHAR(500),
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE idp_settings (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO idp_settings (key, value) VALUES
('access_token_expiry_minutes', '15'),
('refresh_token_expiry_days', '7'),
('admin_token_expiry_minutes', '30'),
('jwt_claim_mappings', '[
  {"claim":"ldap_username","ldap_attr":"sAMAccountName","description":"LDAP username","enabled":true},
  {"claim":"email","ldap_attr":"mail","description":"Email address","enabled":true},
  {"claim":"display_name","ldap_attr":"displayName","description":"Display name","enabled":true},
  {"claim":"department","ldap_attr":"department","description":"Department","enabled":false},
  {"claim":"title","ldap_attr":"title","description":"Job title","enabled":false},
  {"claim":"manager","ldap_attr":"manager","description":"Manager DN","enabled":false}
]');
