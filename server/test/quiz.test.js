import assert from "node:assert/strict";
import { createServer } from "node:http";
import jwt from "jsonwebtoken";
import test from "node:test";
import app from "../src/app.js";
import { Enrollment } from "../src/models/Enrollment.js";
import { Lesson } from "../src/models/Lesson.js";
import { Quiz } from "../src/models/Quiz.js";
import { User } from "../src/models/User.js";

test("quiz endpoint hides answers and grades submissions into course progress", async (context) => {
  const originalSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "test-secret-that-is-not-used-outside-this-test";
  const originalUserFindById = User.findById;
  const originalLessonFindById = Lesson.findById;
  const originalLessonCountDocuments = Lesson.countDocuments;
  const originalEnrollmentFindOne = Enrollment.findOne;
  const originalQuizFindById = Quiz.findById;
  const studentId = "student-test-id";
  const lesson = { _id: "lesson-test-id", course: "course-test-id", isPublished: true, quiz: "quiz-test-id" };
  const quiz = {
    _id: "quiz-test-id",
    title: "Basics",
    passingScore: 70,
    questions: [{
      _id: "question-test-id",
      prompt: "Which option is correct?",
      options: ["First", "Second"],
      correctOption: 1,
      explanation: "The second option is correct.",
    }],
  };
  const enrollment = {
    course: lesson.course,
    status: "active",
    progress: { lessons: [], completedLessons: 0, totalLessons: 1, quizAttempts: [] },
    async save() { return this; },
  };
  User.findById = () => ({ select: async () => ({ _id: studentId, name: "Test Student", roles: ["student"], status: "active" }) });
  Lesson.findById = () => ({ select: async () => lesson });
  Lesson.countDocuments = async () => 1;
  Enrollment.findOne = async () => enrollment;
  Quiz.findById = () => ({
    lean: async () => quiz,
    then(resolve, reject) { return Promise.resolve(quiz).then(resolve, reject); },
  });

  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(async () => {
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
    User.findById = originalUserFindById;
    Lesson.findById = originalLessonFindById;
    Lesson.countDocuments = originalLessonCountDocuments;
    Enrollment.findOne = originalEnrollmentFindOne;
    Quiz.findById = originalQuizFindById;
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });

  const token = jwt.sign({ sub: studentId }, process.env.JWT_SECRET);
  const { port } = server.address();
  const quizResponse = await fetch(`http://127.0.0.1:${port}/api/lessons/${lesson._id}/quiz`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const quizPayload = await quizResponse.json();
  assert.equal(quizResponse.status, 200);
  assert.equal(quizPayload.quiz.questions[0].correctOption, undefined);

  const resultResponse = await fetch(`http://127.0.0.1:${port}/api/lessons/${lesson._id}/quiz/submit`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ answers: [{ questionId: "question-test-id", selectedOption: 1 }] }),
  });
  const result = await resultResponse.json();
  assert.equal(resultResponse.status, 200);
  assert.equal(result.score, 100);
  assert.equal(result.passed, true);
  assert.equal(enrollment.status, "completed");
  assert.equal(enrollment.progress.quizAttempts[0].passed, true);
});
