import { Router } from "express";
import { Course } from "../models/Course.js";
import { Enrollment } from "../models/Enrollment.js";
import { Lesson } from "../models/Lesson.js";
import { Quiz } from "../models/Quiz.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { findActiveEnrollment, markLessonComplete } from "../services/progress.js";

const router = Router();

async function canManageLesson(lesson, user) {
  const course = await Course.findById(lesson.course).select("instructor");
  return course && (user.roles.includes("admin") || String(course.instructor) === String(user._id));
}

router.put("/lessons/:id/quiz", requireAuth, requireRole("instructor", "admin"), async (request, response, next) => {
  try {
    const lesson = await Lesson.findById(request.params.id);
    if (!lesson || lesson.type !== "quiz") {
      response.status(404).json({ error: "Quiz lesson not found." });
      return;
    }
    if (!(await canManageLesson(lesson, request.user))) {
      response.status(403).json({ error: "You can only manage quizzes in your own courses." });
      return;
    }
    const { title, passingScore, questions } = request.body;
    if (typeof title !== "string" || !title.trim() || !Array.isArray(questions) || questions.length === 0) {
      response.status(400).json({ error: "Quiz title and at least one question are required." });
      return;
    }
    const quiz = await Quiz.findOne({ lesson: lesson._id }) ?? new Quiz({ lesson: lesson._id });
    quiz.title = title.trim();
    if (passingScore !== undefined) quiz.passingScore = passingScore;
    quiz.questions = questions;
    await quiz.save();
    lesson.quiz = quiz._id;
    await lesson.save();
    response.status(200).json({ quiz: { id: quiz._id, title: quiz.title, passingScore: quiz.passingScore } });
  } catch (error) {
    next(error);
  }
});

router.get("/lessons/:id/quiz", requireAuth, async (request, response, next) => {
  try {
    const lesson = await Lesson.findById(request.params.id).select("course isPreview isPublished quiz");
    if (!lesson || !lesson.isPublished || !lesson.quiz) {
      response.status(404).json({ error: "Published quiz not found." });
      return;
    }
    const enrollment = await findActiveEnrollment(request.user._id, lesson.course);
    if (!lesson.isPreview && !request.user.roles.includes("admin") && !enrollment) {
      response.status(403).json({ error: "Enroll in this course to take the quiz." });
      return;
    }
    const quiz = await Quiz.findById(lesson.quiz).lean();
    if (!quiz) {
      response.status(404).json({ error: "Quiz is not available." });
      return;
    }
    response.json({
      quiz: {
        id: String(quiz._id),
        title: quiz.title,
        passingScore: quiz.passingScore,
        questions: quiz.questions.map(({ _id, prompt, options }) => ({ id: String(_id), prompt, options })),
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post("/lessons/:id/quiz/submit", requireAuth, async (request, response, next) => {
  try {
    const lesson = await Lesson.findById(request.params.id).select("course isPublished quiz");
    if (!lesson || !lesson.isPublished || !lesson.quiz) {
      response.status(404).json({ error: "Published quiz not found." });
      return;
    }
    const enrollment = await findActiveEnrollment(request.user._id, lesson.course);
    if (!enrollment) {
      response.status(403).json({ error: "An active course enrollment is required." });
      return;
    }
    const quiz = await Quiz.findById(lesson.quiz);
    const answers = request.body.answers;
    if (!Array.isArray(answers) || answers.length !== quiz.questions.length) {
      response.status(400).json({ error: "Submit exactly one answer for each quiz question." });
      return;
    }
    const answerMap = new Map();
    for (const answer of answers) {
      if (!answer || typeof answer.questionId !== "string" || !Number.isInteger(answer.selectedOption) ||
          answerMap.has(answer.questionId)) {
        response.status(400).json({ error: "Quiz answers are invalid or duplicated." });
        return;
      }
      answerMap.set(answer.questionId, answer.selectedOption);
    }
    const correctCount = quiz.questions.filter((question) =>
      answerMap.get(String(question._id)) === question.correctOption
    ).length;
    if (quiz.questions.some((question) =>
      !answerMap.has(String(question._id)) ||
      answerMap.get(String(question._id)) < 0 ||
      answerMap.get(String(question._id)) >= question.options.length
    )) {
      response.status(400).json({ error: "Answers must identify a valid option for every question." });
      return;
    }
    const score = Math.round((correctCount / quiz.questions.length) * 100);
    const passed = score >= quiz.passingScore;
    enrollment.progress.quizAttempts.push({ lesson: lesson._id, score, passed });
    if (passed) await markLessonComplete(enrollment, lesson._id);
    else await enrollment.save();
    response.json({
      score,
      passed,
      passingScore: quiz.passingScore,
      results: quiz.questions.map((question) => ({
        questionId: String(question._id),
        correct: answerMap.get(String(question._id)) === question.correctOption,
        correctOption: question.correctOption,
        explanation: question.explanation,
      })),
      progress: enrollment.progress,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
