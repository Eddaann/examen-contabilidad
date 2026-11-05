BEGIN;

-- Guardar la corrección usada al enviar, independiente del examen actual.
ALTER TABLE exam_attempts
    ADD COLUMN score INTEGER,
    ADD COLUMN total_questions INTEGER;

ALTER TABLE attempt_answers
    ADD COLUMN correct_option_code VARCHAR(8),
    ADD COLUMN is_correct BOOLEAN;

-- Los intentos antiguos solo pueden reconstruirse con la clave actual.
UPDATE attempt_answers a
SET correct_option_code = o.code,
    is_correct = (a.option_code = o.code)
FROM options o
WHERE o.exam_id = a.exam_id
  AND o.question_number = a.question_number
  AND o.is_correct = TRUE;

UPDATE exam_attempts a
SET score = (
        SELECT COUNT(*)::INTEGER FROM attempt_answers aa
        WHERE aa.user_id = a.user_id AND aa.exam_id = a.exam_id
          AND aa.is_correct = TRUE
    ),
    total_questions = (
        SELECT COUNT(*)::INTEGER FROM questions q WHERE q.exam_id = a.exam_id
    );

ALTER TABLE exam_attempts
    ALTER COLUMN score SET NOT NULL,
    ALTER COLUMN total_questions SET NOT NULL,
    ADD CONSTRAINT chk_attempt_score
        CHECK (total_questions > 0 AND score >= 0 AND score <= total_questions);

ALTER TABLE attempt_answers
    ALTER COLUMN correct_option_code SET NOT NULL,
    ALTER COLUMN is_correct SET NOT NULL,
    ADD CONSTRAINT chk_answer_correction
        CHECK (LENGTH(TRIM(correct_option_code)) > 0
               AND is_correct = (option_code = correct_option_code));

COMMIT;
