BEGIN;

ALTER TABLE users ADD COLUMN session_version INTEGER NOT NULL DEFAULT 0
    CHECK (session_version >= 0);

CREATE TABLE auth_sessions (
    id UUID PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    session_version INTEGER NOT NULL CHECK (session_version >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    CHECK (expires_at > created_at)
);
CREATE INDEX idx_auth_sessions_user_id ON auth_sessions (user_id);

-- Cualquier cambio de contraseña invalida todas las sesiones anteriores,
CREATE FUNCTION invalidate_sessions_on_password_change() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.password_hash IS DISTINCT FROM OLD.password_hash THEN
        NEW.session_version := OLD.session_version + 1;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_users_password_sessions
BEFORE UPDATE OF password_hash ON users
FOR EACH ROW EXECUTE FUNCTION invalidate_sessions_on_password_change();

COMMIT;
