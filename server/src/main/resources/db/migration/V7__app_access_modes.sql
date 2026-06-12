ALTER TABLE applications
    ADD COLUMN access_mode VARCHAR(20) NOT NULL DEFAULT 'ASSIGNED'
    CHECK (access_mode IN ('ASSIGNED', 'PUBLIC', 'LDAP_GROUP', 'LDAP_OU'));

CREATE TABLE app_access_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    rule_type VARCHAR(20) NOT NULL CHECK (rule_type IN ('LDAP_GROUP', 'LDAP_OU')),
    value VARCHAR(500) NOT NULL,
    ldap_server_id UUID REFERENCES ldap_server_config(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_app_access_rules_app_id ON app_access_rules(app_id);
