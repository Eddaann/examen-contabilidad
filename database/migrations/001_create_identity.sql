
BEGIN;

-- ============================================
-- 1. USUARIOS
-- ============================================

CREATE TABLE users (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    email VARCHAR(255) NOT NULL,

    password_hash TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_users_email_not_empty
        CHECK (LENGTH(TRIM(email)) > 0),

    CONSTRAINT chk_users_email_normalized
        CHECK (email = LOWER(TRIM(email))),

    CONSTRAINT chk_users_password_hash_not_empty
        CHECK (
            password_hash IS NULL
            OR LENGTH(TRIM(password_hash)) > 0
        )
);

CREATE UNIQUE INDEX uq_users_email
    ON users (LOWER(email));


-- ============================================
-- 2. ROLES
-- ============================================

CREATE TABLE roles (
    id SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    code VARCHAR(50) NOT NULL UNIQUE,

    name VARCHAR(100) NOT NULL,

    CONSTRAINT chk_roles_code_not_empty
        CHECK (LENGTH(TRIM(code)) > 0),

    CONSTRAINT chk_roles_name_not_empty
        CHECK (LENGTH(TRIM(name)) > 0)
);


-- ============================================
-- 3. PERMISOS
-- ============================================

CREATE TABLE permissions (
    id SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    code VARCHAR(100) NOT NULL UNIQUE,

    description VARCHAR(255) NOT NULL,

    CONSTRAINT chk_permissions_code_not_empty
        CHECK (LENGTH(TRIM(code)) > 0),

    CONSTRAINT chk_permissions_description_not_empty
        CHECK (LENGTH(TRIM(description)) > 0)
);


-- ============================================
-- 4. USUARIOS Y ROLES
-- ============================================

CREATE TABLE user_roles (
    user_id BIGINT NOT NULL,

    role_id SMALLINT NOT NULL,

    PRIMARY KEY (user_id, role_id),

    CONSTRAINT fk_user_roles_user
        FOREIGN KEY (user_id)
        REFERENCES users (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_user_roles_role
        FOREIGN KEY (role_id)
        REFERENCES roles (id)
        ON DELETE RESTRICT
);

CREATE INDEX idx_user_roles_role_id
    ON user_roles (role_id);


-- ============================================
-- 5. ROLES Y PERMISOS
-- ============================================

CREATE TABLE role_permissions (
    role_id SMALLINT NOT NULL,

    permission_id SMALLINT NOT NULL,

    PRIMARY KEY (role_id, permission_id),

    CONSTRAINT fk_role_permissions_role
        FOREIGN KEY (role_id)
        REFERENCES roles (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_role_permissions_permission
        FOREIGN KEY (permission_id)
        REFERENCES permissions (id)
        ON DELETE RESTRICT
);

CREATE INDEX idx_role_permissions_permission_id
    ON role_permissions (permission_id);

COMMIT;
