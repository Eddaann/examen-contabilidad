BEGIN;

CREATE TABLE auth_rate_limits (
    scope VARCHAR(40) NOT NULL,
    key_hash CHAR(64) NOT NULL,
    hits INTEGER NOT NULL CHECK (hits >= 0),
    expires_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (scope, key_hash)
);
CREATE INDEX idx_auth_rate_limits_expires_at ON auth_rate_limits (expires_at);

COMMIT;
