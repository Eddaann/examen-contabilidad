
BEGIN;

-- ============================================
-- ROLES INICIALES
-- ============================================

INSERT INTO roles (code, name)
VALUES
    ('STUDENT', 'Estudiante'),
    ('TEACHER', 'Maestro')
ON CONFLICT (code) DO NOTHING;


-- ============================================
-- PERMISOS INICIALES
-- ============================================

INSERT INTO permissions (code, description)
VALUES
    ('exam:read', 'Consultar exámenes'),
    ('exam:submit', 'Presentar exámenes'),
    ('result:read:own', 'Consultar resultados propios'),
    ('result:read:all', 'Consultar todos los resultados'),
    ('student:read:all', 'Consultar estudiantes')
ON CONFLICT (code) DO NOTHING;


-- ============================================
-- PERMISOS DEL ESTUDIANTE
-- ============================================

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'STUDENT'
AND p.code IN (
    'exam:read',
    'exam:submit',
    'result:read:own'
)
ON CONFLICT DO NOTHING;


-- ============================================
-- PERMISOS DEL MAESTRO
-- ============================================

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'TEACHER'
AND p.code IN (
    'result:read:all',
    'student:read:all'
)
ON CONFLICT DO NOTHING;

COMMIT;
