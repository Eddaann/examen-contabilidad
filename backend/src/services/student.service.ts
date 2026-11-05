import { findStudentByEmail } from "../repositories/student.repository";

export async function validateStudentAccess(email: string) {
  const normalizedEmail = email.trim().toLowerCase();

  const student = await findStudentByEmail(normalizedEmail);

  if (!student) {
    return null;
  }

  return student;
}
