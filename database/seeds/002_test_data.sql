
BEGIN;

-- ============================================
-- 1. ESTUDIANTES DE PRUEBA
-- ============================================

INSERT INTO users (email)
VALUES
    ('alumno1@ejemplo.com'),
    ('alumno2@ejemplo.com'),
    ('alumno3@ejemplo.com')
ON CONFLICT DO NOTHING;

-- Asignar el rol a student
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
CROSS JOIN roles r
WHERE r.code = 'STUDENT'
  AND u.email IN (
      'alumno1@ejemplo.com',
      'alumno2@ejemplo.com',
      'alumno3@ejemplo.com'
  )
ON CONFLICT DO NOTHING;


-- ============================================
-- 2. EXAMEN DE CONTABILIDAD
-- ============================================

INSERT INTO exams (title, description)
SELECT
    'Examen de Contabilidad',
    'Operaciones contables registradas en la cuenta Bancos.'
WHERE NOT EXISTS (
    SELECT 1 FROM exams
    WHERE title = 'Examen de Contabilidad'
);


-- ============================================
-- 3. PREGUNTAS
-- ============================================

INSERT INTO questions (exam_id, number, statement)
SELECT
    e.id,
    q.number,
    q.statement
FROM exams e
CROSS JOIN (
    VALUES
        (1, 'El saldo inicial de Bancos es de $850,000.'),
        (2, 'Se pagó al proveedor INMOBILIARIA SA la cantidad de $17,700.'),
        (3, 'Se vendió una máquina envasadora y se cobró la cantidad de $120,000.'),
        (4, 'Se entregaron viáticos por viaje a Monterrey al vendedor Javier Barrera por $70,000.'),
        (5, 'El cliente ZAZA SA pagó por un servicio la cantidad de $25,000.')
) AS q(number, statement)
WHERE e.title = 'Examen de Contabilidad'
ON CONFLICT (exam_id, number) DO NOTHING;


-- ============================================
-- 4. OPCIONES DE RESPUESTA
-- ============================================

INSERT INTO options (
    exam_id,
    question_number,
    code,
    text,
    is_correct
)
SELECT
    e.id,
    o.question_number,
    o.code,
    o.text,
    o.is_correct
FROM exams e
CROSS JOIN (
    VALUES
        (1, 'A', 'Cargo', TRUE),
        (1, 'B', 'Abono', FALSE),
        (1, 'C', 'No se registra', FALSE),
        (1, 'D', 'Se registra en ambas columnas', FALSE),

        (2, 'A', 'Cargo', FALSE),
        (2, 'B', 'Abono', TRUE),
        (2, 'C', 'No se registra', FALSE),
        (2, 'D', 'Se registra en ambas columnas', FALSE),

        (3, 'A', 'Cargo', TRUE),
        (3, 'B', 'Abono', FALSE),
        (3, 'C', 'No se registra', FALSE),
        (3, 'D', 'Se registra en ambas columnas', FALSE),

        (4, 'A', 'Cargo', FALSE),
        (4, 'B', 'Abono', TRUE),
        (4, 'C', 'No se registra', FALSE),
        (4, 'D', 'Se registra en ambas columnas', FALSE),

        (5, 'A', 'Cargo', TRUE),
        (5, 'B', 'Abono', FALSE),
        (5, 'C', 'No se registra', FALSE),
        (5, 'D', 'Se registra en ambas columnas', FALSE)
) AS o(question_number, code, text, is_correct)
WHERE e.title = 'Examen de Contabilidad'
ON CONFLICT (exam_id, question_number, code)
DO NOTHING;


-- ============================================
-- 5. ACTIVAR EXAMEN
-- ============================================

UPDATE exams
SET is_active = TRUE
WHERE title = 'Examen de Contabilidad';

COMMIT;
