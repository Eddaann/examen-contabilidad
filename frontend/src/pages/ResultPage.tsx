import type { ExamResult } from "../types/exam.types";
import "./ResultPage.scss";

interface ResultPageProps {
  result: ExamResult;
  confirmation?: string;
}

export default function ResultPage({ result, confirmation }: ResultPageProps) {
  return (
    <main className="exam result">
      <div className="exam__container">
        {confirmation && <p className="exam__success" role="status">{confirmation}</p>}
        <header className="exam__header">
          <span className="exam__tag">Evaluación finalizada</span>
          <h1 className="exam__title">Resultado del examen</h1>
          <p className="result__grade">Calificación: <strong>{result.grade}</strong></p>
          <p>{result.score} aciertos de {result.total} preguntas.</p>
          <p className="result__note">Estas son las respuestas de tu intento. El examen ya no puede modificarse.</p>
        </header>

        <ol className="result__answers" aria-label="Preguntas y respuestas del alumno">
          {[...result.details].sort((a, b) => a.questionNumber - b.questionNumber).map(answer => (
            <li className="result__answer" key={answer.questionNumber}>
              <div className="result__heading">
                <span className="result__number">Pregunta {answer.questionNumber}</span>
                <span className={`result__badge result__badge--${answer.isCorrect ? "correct" : "incorrect"}`}>
                  {answer.isCorrect ? "Correcta" : "Incorrecta"}
                </span>
              </div>
              <h2 className="result__question">{answer.statement ?? `Pregunta ${answer.questionNumber}`}</h2>
              <dl className="result__detail">
                <div>
                  <dt>Tu respuesta</dt>
                  <dd><strong>{answer.selectedOption})</strong> {answer.selectedOptionText ?? answer.selectedOption}</dd>
                </div>
                {!answer.isCorrect && (
                  <div>
                    <dt>Respuesta correcta</dt>
                    <dd><strong>{answer.correctOption})</strong> {answer.correctOptionText ?? answer.correctOption}</dd>
                  </div>
                )}
              </dl>
            </li>
          ))}
        </ol>
      </div>
    </main>
  );
}
