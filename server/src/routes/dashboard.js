import { Router } from "express";
import { Course } from "../models/Course.js";
import { Lesson } from "../models/Lesson.js";
import { Enrollment } from "../models/Enrollment.js";
import { User } from "../models/User.js";
import { optionalAuth } from "../middleware/auth.js";

const router = Router();

const categoryStyles = {
  business: { accent: "mint", artwork: "✺" },
  design: { accent: "lavender", artwork: "✳" },
  development: { accent: "peach", artwork: "{ }" },
};

router.get("/dashboard", optionalAuth, async (request, response, next) => {
  try {
    const courses = await Course.find({ status: "published" })
      .select("title description category instructor thumbnailUrl updatedAt pricing")
      .populate({ path: "instructor", select: "name", model: User })
      .sort({ updatedAt: -1 })
      .lean();
    const courseIds = courses.map((course) => course._id);
    const lessons = courseIds.length
      ? await Lesson.find({ course: { $in: courseIds }, isPublished: true })
          .select("course title position type liveClass durationSeconds isPreview textContent video.processingStatus")
          .sort({ course: 1, position: 1 })
          .lean()
      : [];

    const lessonsByCourse = new Map();
    for (const lesson of lessons) {
      const courseId = String(lesson.course);
      const courseLessons = lessonsByCourse.get(courseId) ?? [];
      courseLessons.push(lesson);
      lessonsByCourse.set(courseId, courseLessons);
    }

    const enrollments = request.user
      ? await Enrollment.find({ student: request.user._id, status: { $in: ["active", "completed"] } }).lean()
      : [];
    const enrollmentByCourse = new Map(enrollments.map((enrollment) => [String(enrollment.course), enrollment]));
    const dashboardCourses = courses.map((course) => {
      const category = course.category?.trim() || "General";
      const style = categoryStyles[category.toLowerCase()] ?? {
        accent: "lavender",
        artwork: "✦",
      };
      const courseLessons = lessonsByCourse.get(String(course._id)) ?? [];
      const enrollment = enrollmentByCourse.get(String(course._id));
      const completedLessonIds = new Set(
        enrollment?.progress?.lessons
          .filter((item) => item.status === "completed")
          .map((item) => String(item.lesson)) ?? []
      );
      const nextLesson = courseLessons.find((lesson) =>
        !completedLessonIds.has(String(lesson._id)) && lesson.type !== "live"
      );
      const lessonsComplete = courseLessons.filter((lesson) =>
        completedLessonIds.has(String(lesson._id))
      ).length;
      const lessonsTotal = courseLessons.length;

      return {
        id: String(course._id),
        title: course.title,
        subtitle: course.description,
        instructor: course.instructor?.name ?? "Instructor",
        canManage: Boolean(request.user && (
          request.user.roles.includes("admin") ||
          String(course.instructor?._id) === String(request.user._id)
        )),
        category,
        thumbnailUrl: course.thumbnailUrl ?? "",
        pricing: course.pricing,
        isEnrolled: Boolean(enrollment),
        enrollmentId: enrollment ? String(enrollment._id) : null,
        progress: lessonsTotal ? Math.round((lessonsComplete / lessonsTotal) * 100) : 0,
        lessonsComplete,
        lessonsTotal,
        lessons: courseLessons.map((lesson) => ({
          id: String(lesson._id),
          title: lesson.title,
          type: lesson.type,
          durationSeconds: lesson.durationSeconds ?? 0,
          isPreview: lesson.isPreview,
          videoStatus: lesson.video?.processingStatus,
          liveClassStatus: lesson.liveClass?.status,
          ...(lesson.type === "text" && (lesson.isPreview || enrollment || request.user && (
            request.user.roles.includes("admin") ||
            String(course.instructor?._id) === String(request.user._id)
          )) ? { textContent: lesson.textContent } : {}),
        })),
        accent: style.accent,
        artwork: style.artwork,
        nextLesson: nextLesson?.title ?? (enrollment && lessonsComplete >= lessonsTotal ? "Course completed" : "Course outline coming soon"),
        nextLessonId: nextLesson ? String(nextLesson._id) : null,
        nextLessonType: nextLesson?.type ?? null,
      };
    });

    const courseById = new Map(courses.map((course) => [String(course._id), course]));
    const liveClasses = lessons
      .filter((lesson) => {
        const startsAt = lesson.liveClass?.startsAt;
        const isLive = lesson.liveClass?.status === "live";
        return startsAt && (isLive || new Date(startsAt).getTime() >= Date.now())
          && ["scheduled", "live"].includes(lesson.liveClass.status);
      })
      .map((lesson) => ({
        id: String(lesson._id),
        title: lesson.title,
        instructor: courseById.get(String(lesson.course))?.instructor?.name ?? "Instructor",
        startsAt: lesson.liveClass.startsAt,
        status: lesson.liveClass.status,
      }))
      .sort((first, second) => new Date(first.startsAt) - new Date(second.startsAt));

    response.json({ courses: dashboardCourses, liveClasses });
  } catch (error) {
    next(error);
  }
});

export default router;
