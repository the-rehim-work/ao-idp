ALTER TABLE applications
    ADD COLUMN IF NOT EXISTS post_logout_redirect_uris text[] NOT NULL DEFAULT '{}';
