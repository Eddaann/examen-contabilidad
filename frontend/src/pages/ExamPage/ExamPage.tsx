import { useEffect, useState, type FormEvent } from "react";
import { getExam, getExamStatus, getExamResult, submitExam } from "../../api/exam.api";
import type { Exam, ExamAnswer, ExamResult } from "../../types/exam.types";
import { ApiError, errorMessage } from "../../api/client";
import ConfirmDialog from "../../components/ConfirmDialog/ConfirmDialog";
import Button from "../../components/Button";
import "./ExamPage.scss";

interface ExamPageProps {
  examId: string;
  onSubmitted: (result: ExamResult, recovered?: boolean) => void;
}

export default function ExamPage({ examId, onSubmitted }: ExamPageProps) {
  const [exam, setExam] = useState<Exam | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [uncertainSubmission, setUncertainSubmission] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setSessionExpired(false);

    async function loadExam() {
      try {
        const data = await getExam(examId);

        if (active) {
          setExam(data);
        }
      } catch (err) {
        if (active) {
          setError(errorMessage(err));
          setSessionExpired(err instanceof ApiError && err.status === 401);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadExam();

    return () => {
      active = false;
    };
  }, [examId, loadAttempt]);

  // Registrar la respuesta seleccionada
  function selectAnswer(
    questionNumber: number,
    optionCode: string
  ) {
    if (submitting || uncertainSubmission) return;
    setError("");
    setAnswers((previous) => ({
      ...previous,
      [questionNumber]: optionCode,
    }));
  }

  // Validar respuestas y abrir el mensaje
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!exam || submitting || uncertainSubmission || sessionExpired) return;

    const allAnswered = exam.questions.every(
      (question) => answers[question.number] !== undefined
    );

    if (!allAnswered) {
      setError("Debes responder todas las preguntas.");
      return;
    }

    setError("");
    setShowConfirmation(true);
  }

  // Confirmar y enviar el examen al backend
  async function handleConfirmSubmit() {
    if (!exam || submitting || uncertainSubmission || sessionExpired || !showConfirmation) return;

    const allAnswered = exam.questions.every(
      (question) => answers[question.number] !== undefined
    );

    if (!allAnswered) {
      setError("Debes responder todas las preguntas.");
      setShowConfirmation(false);
      return;
    }

    const selectedAnswers: ExamAnswer[] = exam.questions.map(
      (question) => ({
        questionNumber: question.number,
        optionCode: answers[question.number],
      })
    );

    setSubmitting(true);
    setError("");

    try {
      const result = await submitExam(exam.id, selectedAnswers);
      setShowConfirmation(false);
      onSubmitted(result);
    } catch (err) {
      setShowConfirmation(false);
      setSessionExpired(err instanceof ApiError && err.status === 401);
      const status = err instanceof ApiError ? err.status : undefined;
      if (status === undefined || status === 409 || status >= 500) {

        await checkSubmission();
      } else {
        setError(errorMessage(err));
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function checkSubmission() {
    if (!exam) return;
    setSubmitting(true);
    try {
      const status = await getExamStatus(exam.id);
      if (status.submitted) {
        const saved = await getExamResult(exam.id);
        onSubmitted(saved, true);
      } else {
        setUncertainSubmission(false);
        setError("El examen aún no está enviado. Tus respuestas se conservaron; puedes intentarlo de nuevo.");
      }
    } catch (err) {
      setUncertainSubmission(true);
      setSessionExpired(err instanceof ApiError && err.status === 401);
      setError(err instanceof ApiError && err.status === 401
        ? errorMessage(err)
        : "No pudimos confirmar el envío. Conservamos tus respuestas; comprueba el estado antes de volver a enviar.");
    } finally {
      setSubmitting(false);
    }
  }

  // Cerrar el diálogo sin enviar respuestas
  function handleCancel() {
    if (submitting) return;

    setShowConfirmation(false);
  }

  // Estado de carga
  if (loading) {
    return (
      <main className="exam">
        <p className="exam__message" role="status">
          Cargando examen...
        </p>
      </main>
    );
  }

  // Error al recuperar el examen
  if (!exam) {
    return (
      <main className="exam">
        <p className="exam__error" role="alert">
          {error || "No se encontró el examen."}
        </p>
        <Button className="exam__submit" onClick={() => sessionExpired
          ? window.location.reload() : setLoadAttempt((attempt) => attempt + 1)}>
          {sessionExpired ? "Volver a iniciar sesión" : "Reintentar carga"}
        </Button>
      </main>
    );
  }

  const answeredCount = exam.questions.filter(
    (question) => answers[question.number] !== undefined
  ).length;

  const allQuestionsAnswered =
    answeredCount === exam.questions.length;

  return (
    <main className="exam">
      <div className="exam__container">
        <header className="exam__header">
          <span className="exam__tag">
            Evaluación académica
          </span>

          <h1 className="exam__title">
            {exam.title}
          </h1>

          {exam.description && (
            <p className="exam__description">
              {exam.description}
            </p>
          )}

          <div className="exam__progress">
            <span>Progreso</span>

            <strong>
              {answeredCount} de {exam.questions.length}
            </strong>
          </div>

          <progress
            className="exam__progress-bar"
            value={answeredCount}
            max={exam.questions.length}
            aria-label="Preguntas respondidas"
          />
        </header>

        <form
          className="exam__form"
          onSubmit={handleSubmit}
          aria-busy={submitting}
        >
          {exam.questions.map((question) => (
            <fieldset
              className="exam__question"
              key={question.number}
              disabled={submitting || uncertainSubmission || sessionExpired}
            >
              <legend className="exam__question-title">
                <span className="exam__question-number">
                  {String(question.number).padStart(2, "0")}
                </span>

                {question.statement}
              </legend>

              <div className="exam__options">
                {question.options.map((option) => {
                  const selected =
                    answers[question.number] === option.code;

                  return (
                    <label
                      className={`exam__option${
                        selected
                          ? " exam__option--selected"
                          : ""
                      }`}
                      key={option.code}
                    >
                      <input
                        className="exam__radio"
                        type="radio"
                        name={`question-${question.number}`}
                        value={option.code}
                        checked={selected}
                        onChange={() =>
                          selectAnswer(
                            question.number,
                            option.code
                          )
                        }
                      />

                      <span className="exam__option-code">
                        {option.code}
                      </span>

                      <span className="exam__option-text">
                        {option.text}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ))}

          {error && (
            <div className="exam__feedback" role="alert">
              <p className="exam__error">{error}</p>
              {sessionExpired && (
                <Button className="exam__submit" onClick={() => window.location.reload()}>
                  Volver a iniciar sesión
                </Button>
              )}
              {uncertainSubmission && !sessionExpired && (
                <Button className="exam__submit" onClick={() => void checkSubmission()}
                  loading={submitting} loadingLabel="Comprobando...">
                  Comprobar envío
                </Button>
              )}
            </div>
          )}

          <footer className="exam__footer">
            <p className="exam__warning">
              Solo tienes un intento. Revisa tus respuestas
              antes de enviar.
            </p>

            <Button
              className="exam__submit"
              type="submit"
              disabled={!allQuestionsAnswered || uncertainSubmission || sessionExpired}
              loading={submitting}
              loadingLabel="Enviando..."
            >
              Finalizar examen
            </Button>
          </footer>
        </form>

        <ConfirmDialog
          open={showConfirmation}
          loading={submitting}
          onConfirm={() => void handleConfirmSubmit()}
          onCancel={handleCancel}
        />
      </div>
    </main>
  );
}
