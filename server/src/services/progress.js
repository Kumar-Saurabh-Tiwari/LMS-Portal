import { Enrollment } from "../models/Enrollment.js";
import { Lesson } from "../models/Lesson.js";

export async function markLessonComplete(enrollment, lessonId) {
  const progress = enrollment.progress.lessons.find((item) => String(item.lesson) === String(lessonId));
  if (!progress) {
    enrollment.progress.lessons.push({ lesson: lessonId, status: "completed", completedAt: new Date() });
    enrollment.progress.totalLessons = Math.max(enrollment.progress.totalLessons, enrollment.progress.lessons.length);
  } else if (progress.status !== "completed") {
    progress.status = "completed";
    progress.completedAt = new Date();
  }

  enrollment.progress.completedLessons = enrollment.progress.lessons.filter((item) => item.status === "completed").length;
  const totalLessons = await Lesson.countDocuments({ course: enrollment.course, isPublished: true });
  enrollment.progress.totalLessons = totalLessons;
  if (totalLessons > 0 && enrollment.progress.completedLessons >= totalLessons) {
    enrollment.status = "completed";
    enrollment.completedAt ??= new Date();
    enrollment.certificate ??= {};
    enrollment.certificate.issuedAt ??= new Date();
  }
  await enrollment.save();
  return enrollment;
}

export async function findActiveEnrollment(userId, courseId) {
  return Enrollment.findOne({
    student: userId,
    course: courseId,
    status: { $in: ["active", "completed"] },
    "purchase.status": { $in: ["not_required", "paid"] },
  });
}
