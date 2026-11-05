import { ApiError, apiRequest } from "./client";
import type { Exam, ExamAnswer, ExamResult, ExamStatus } from "../types/exam.types";

export const EXAM_ID = "1";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function isResult(value: unknown): value is ExamResult {
  if (!isRecord(value)) return false;
  return Number.isInteger(value.score) && Number.isInteger(value.total)
    && typeof value.score === "number" && typeof value.total === "number"
    && value.total > 0 && value.score >= 0 && value.score <= value.total
    && value.grade === `${value.score}/${value.total}`
    && Array.isArray(value.details) && value.details.length === value.total
    && value.details.every(answer => isRecord(answer)
      && (answer.statement === undefined || typeof answer.statement === "string")
      && (answer.selectedOptionText === undefined || typeof answer.selectedOptionText === "string")
      && (answer.correctOptionText === undefined || typeof answer.correctOptionText === "string")
      && Number.isInteger(answer.questionNumber)
      && typeof answer.selectedOption === "string"
      && typeof answer.correctOption === "string"
      && typeof answer.isCorrect === "boolean");
}

function invalidResponse(): never {
  throw new ApiError("El servidor devolvió información inválida del examen. Inténtalo de nuevo.");
}

export async function getExamStatus(examId: string): Promise<ExamStatus> {
  const data = await apiRequest(`/students/me/exams/${examId}/status`);
  if (!isRecord(data) || typeof data.studentId !== "string"
    || typeof data.examId !== "string" || typeof data.submitted !== "boolean") return invalidResponse();
  return { studentId: data.studentId, examId: data.examId, submitted: data.submitted };
}

export async function getExam(examId: string): Promise<Exam> {
  const data = await apiRequest(`/exams/${examId}`);
  if (!isRecord(data) || typeof data.id !== "string" || typeof data.title !== "string"
    || !(data.description === null || typeof data.description === "string")
    || !Array.isArray(data.questions) || data.questions.length === 0) return invalidResponse();
  const questions = data.questions.map(question => {
    if (!isRecord(question) || typeof question.number !== "number"
      || !Number.isInteger(question.number) || question.number < 1
      || typeof question.statement !== "string" || !Array.isArray(question.options)
      || question.options.length === 0) return invalidResponse();
    const options = question.options.map(option => {
      if (!isRecord(option) || typeof option.code !== "string" || typeof option.text !== "string") return invalidResponse();
      return { code: option.code, text: option.text };
    });
    return { number: question.number, statement: question.statement, options };
  });
  return { id: data.id, title: data.title, description: data.description, questions };
}

export async function submitExam(examId: string, answers: ExamAnswer[]): Promise<ExamResult> {
  const data = await apiRequest(`/exams/${examId}/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answers }),
    statusMessages: { 400: "Revisa que todas las preguntas tengan una respuesta válida." },
  });
  if (!isRecord(data) || !isResult(data.result)) return invalidResponse();
  return data.result;
}

export async function getExamResult(examId: string): Promise<ExamResult> {
  const data = await apiRequest(`/students/me/exams/${examId}/result`);
  if (!isResult(data)) return invalidResponse();
  return data;
}
