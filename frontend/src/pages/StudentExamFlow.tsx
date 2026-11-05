import { useEffect, useState } from "react";
import ResultPage from "./ResultPage";
import ExamPage from "./ExamPage/ExamPage";
import Button from "../components/Button";
import { ApiError, errorMessage } from "../api/client";
import { EXAM_ID, getExamStatus, getExamResult } from "../api/exam.api";
import type { ExamResult } from "../types/exam.types";

type View = "loading" | "exam" | "result" | "error";

export default function StudentExamFlow() {
  const [view, setView] = useState<View>("loading");
  const [result, setResult] = useState<ExamResult | null>(null);
  const [error, setError] = useState("");
  const [sessionExpired, setSessionExpired] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [confirmation, setConfirmation] = useState("");

  useEffect(() => {
    let active = true;
    setView("loading");
    setError("");
    setSessionExpired(false);
    async function initialize() {
      try {
        const status = await getExamStatus(EXAM_ID);
        if (!active) return;
        if (status.submitted) {
          const saved = await getExamResult(EXAM_ID);
          if (!active) return;
          setResult(saved);
          setView("result");
        } else {
          setView("exam");
        }
      } catch (err) {
        if (!active) return;
        setError(errorMessage(err));
        setSessionExpired(err instanceof ApiError && err.status === 401);
        setView("error");
      }
    }
    void initialize();
    return () => { active = false; };
  }, [attempt]);

  function handleSubmitted(saved: ExamResult, recovered = false) {
    setResult(saved);
    setConfirmation(recovered
      ? "Tu examen ya fue enviado. Recuperamos tu resultado guardado."
      : "Examen enviado correctamente. Tus respuestas y tu calificación quedaron guardadas.");
    setView("result");
  }

  if (view === "loading") {
    return <main className="exam"><p className="exam__message" role="status">Cargando examen...</p></main>;
  }
  if (view === "error") {
    return (
      <main className="exam"><div className="exam__container">
        <h1>No pudimos consultar el examen</h1>
        <p className="exam__error" role="alert">{error}</p>
        <Button className="exam__submit" onClick={() => sessionExpired
          ? window.location.reload() : setAttempt((value) => value + 1)}>
          {sessionExpired ? "Volver a iniciar sesión" : "Reintentar"}
        </Button>
      </div></main>
    );
  }
  if (view === "exam") return <ExamPage onSubmitted={handleSubmitted} />;

  return result ? <ResultPage result={result} confirmation={confirmation} /> : null;
}
