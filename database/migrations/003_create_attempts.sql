
BEGIN;

-- ============================================
-- 1. INTENTOS DE EXAMEN
-- ============================================

CREATE TABLE exam_attempts (
    user_id BIGINT NOT NULL,
    exam_id BIGINT NOT NULL,

    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_exam_attempts
        PRIMARY KEY (user_id, exam_id),

    CONSTRAINT fk_exam_attempts_user
        FOREIGN KEY (user_id)
        REFERENCES users (id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_exam_attempts_exam
        FOREIGN KEY (exam_id)
        REFERENCES exams (id)
        ON DELETE RESTRICT
);

-- Facilita consultar todos los intentos
-- correspondientes a un examen.
CREATE INDEX idx_exam_attempts_exam_id
    ON exam_attempts (exam_id);


-- ============================================
-- 2. RESPUESTAS DE LOS INTENTOS
-- ============================================

CREATE TABLE attempt_answers (
    user_id BIGINT NOT NULL,
    exam_id BIGINT NOT NULL,
    question_number INTEGER NOT NULL,
    option_code VARCHAR(8) NOT NULL,

    CONSTRAINT pk_attempt_answers
        PRIMARY KEY (
            user_id,
            exam_id,
            question_number
        ),

    CONSTRAINT fk_attempt_answers_attempt
        FOREIGN KEY (user_id, exam_id)
        REFERENCES exam_attempts (user_id, exam_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_attempt_answers_option
        FOREIGN KEY (
            exam_id,
            question_number,
            option_code
        )
        REFERENCES options (
            exam_id,
            question_number,
            code
        )
        ON DELETE RESTRICT
);

--- Sirve para saber que usuarios han respodido a cada opción
CREATE INDEX idx_attempt_answers_option
    ON attempt_answers (
        exam_id,
        question_number,
        option_code
    );

COMMIT;
