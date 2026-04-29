ALTER TABLE applications
    ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT FALSE,
    ALTER COLUMN client_secret_hash DROP NOT NULL;

UPDATE applications SET is_public = TRUE, client_secret_hash = NULL
WHERE client_id = 'demo-portal-client';
