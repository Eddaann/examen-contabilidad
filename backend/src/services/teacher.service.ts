import { findAllResults } from "../repositories/teacher.repository";

export async function getAllStudentResults() {
  const results = await findAllResults();

  return results.map((result) => ({
    ...result,
    grade: `${result.score}/${result.total}`,
  }));
}
