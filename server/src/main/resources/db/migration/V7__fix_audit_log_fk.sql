ALTER TABLE audit_logs
    DROP CONSTRAINT IF EXISTS audit_logs_application_id_fkey;

ALTER TABLE audit_logs
    ADD CONSTRAINT audit_logs_application_id_fkey
    FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE SET NULL;
