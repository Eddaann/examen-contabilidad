export interface ExamOption {
  code: string;
  text: string;
}

export interface ExamQuestion {
  number: number;
  statement: string;
  options: ExamOption[];
}

export interface Exam {
  id: string;
  title: string;
  description: string | null;
  questions: ExamQuestion[];
}

export interface ExamStatus {
  studentId: string;
  examId: string;
  submitted: boolean;
}

export interface ExamAnswer {
  questionNumber: number;
  optionCode: string;
}

export interface AnswerResult {
  statement?: string;
  selectedOptionText?: string;
  correctOptionText?: string;
  questionNumber: number;
  selectedOption: string;
  correctOption: string;
  isCorrect: boolean;
}

export interface ExamResult {
  examId?: string;
  score: number;
  total: number;
  grade: string;
  submittedAt?: string;
  details: AnswerResult[];
}
