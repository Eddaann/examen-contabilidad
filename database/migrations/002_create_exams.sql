
BEGIN;

-- ============================================
-- 1. EXÁMENES
-- ============================================

CREATE TABLE exams (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    title VARCHAR(150) NOT NULL,

    description TEXT,

    is_active BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_exams_title_not_empty
        CHECK (LENGTH(TRIM(title)) > 0)
);


-- ============================================
-- 2. PREGUNTAS
-- ============================================

CREATE TABLE questions (
    exam_id BIGINT NOT NULL,

    number INTEGER NOT NULL,

    statement TEXT NOT NULL,

    CONSTRAINT pk_questions
        PRIMARY KEY (exam_id, number),

    CONSTRAINT fk_questions_exam
        FOREIGN KEY (exam_id)
        REFERENCES exams (id)
        ON DELETE RESTRICT,

    CONSTRAINT chk_questions_number_positive
        CHECK (number > 0),

    CONSTRAINT chk_questions_statement_not_empty
        CHECK (LENGTH(TRIM(statement)) > 0)
);


-- ============================================
-- 3. OPCIONES DE RESPUESTA
-- ============================================

CREATE TABLE options (
    exam_id BIGINT NOT NULL,

    question_number INTEGER NOT NULL,

    code VARCHAR(8) NOT NULL,

    text TEXT NOT NULL,

    is_correct BOOLEAN NOT NULL DEFAULT FALSE,

    CONSTRAINT pk_options
        PRIMARY KEY (
            exam_id,
            question_number,
            code
        ),

    CONSTRAINT fk_options_question
        FOREIGN KEY (exam_id, question_number)
        REFERENCES questions (exam_id, number)
        ON DELETE RESTRICT,

    CONSTRAINT chk_options_code_not_empty
        CHECK (LENGTH(TRIM(code)) > 0),

    CONSTRAINT chk_options_text_not_empty
        CHECK (LENGTH(TRIM(text)) > 0)
);


-- ============================================
-- 4. UNA SOLA RESPUESTA CORRECTA
-- ============================================

CREATE UNIQUE INDEX uq_options_correct
    ON options (exam_id, question_number)
    WHERE is_correct = TRUE;

COMMIT;
