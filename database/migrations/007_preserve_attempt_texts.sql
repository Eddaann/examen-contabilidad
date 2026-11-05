BEGIN;

ALTER TABLE attempt_answers
    ADD COLUMN statement TEXT,
    ADD COLUMN selected_option_text TEXT,
    ADD COLUMN correct_option_text TEXT;

-- Los intentos previos solo pueden reconstruirse con el contenido disponible
-- al migrar. Si la opción correcta histórica ya no existe, conservar su código.
UPDATE attempt_answers a
SET statement = (
        SELECT q.statement FROM questions q
        WHERE q.exam_id = a.exam_id AND q.number = a.question_number
    ),
    selected_option_text = (
        SELECT o.text FROM options o
        WHERE o.exam_id = a.exam_id AND o.question_number = a.question_number
          AND o.code = a.option_code
    ),
    correct_option_text = COALESCE((
        SELECT o.text FROM options o
        WHERE o.exam_id = a.exam_id AND o.question_number = a.question_number
          AND o.code = a.correct_option_code
    ), a.correct_option_code);

ALTER TABLE attempt_answers
    ALTER COLUMN statement SET NOT NULL,
    ALTER COLUMN selected_option_text SET NOT NULL,
    ALTER COLUMN correct_option_text SET NOT NULL;

COMMIT;
