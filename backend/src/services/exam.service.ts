import { findExamById } from "../repositories/exam.repository";

interface ExamOption {
  code: string;
  text: string;
}

interface ExamQuestion {
  number: number;
  statement: string;
  options: ExamOption[];
}

export async function getExamById(examId: string) {
  const rows = await findExamById(examId);

  if (rows.length === 0) {
    return null;
  }

  const questions: ExamQuestion[] = [];

  for (const row of rows) {
    let question = questions.find(
      (q) => q.number === row.question_number
    );

    if (!question) {
      question = {
        number: row.question_number,
        statement: row.statement,
        options: [],
      };

      questions.push(question);
    }

    question.options.push({
      code: row.option_code,
      text: row.option_text,
    });
  }

  return {
    id: rows[0].exam_id,
    title: rows[0].title,
    description: rows[0].description,
    questions,
  };
}
