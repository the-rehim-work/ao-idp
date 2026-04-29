CREATE TABLE user_app_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    app_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    granted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, app_id)
);

CREATE INDEX idx_user_app_access_user_id ON user_app_access(user_id);
CREATE INDEX idx_user_app_access_app_id ON user_app_access(app_id);

INSERT INTO user_app_access (user_id, app_id)
SELECT u.id, a.id FROM users u CROSS JOIN applications a
WHERE u.is_active = true
ON CONFLICT DO NOTHING;
