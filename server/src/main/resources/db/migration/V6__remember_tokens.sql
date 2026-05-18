CREATE TABLE remember_tokens (
    token_hash VARCHAR(64) PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ldap_username VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_remember_tokens_user ON remember_tokens(user_id);
CREATE INDEX idx_remember_tokens_expires ON remember_tokens(expires_at);
