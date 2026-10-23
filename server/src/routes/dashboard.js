import { Router } from "express";
import { Course } from "../models/Course.js";
import { Lesson } from "../models/Lesson.js";
import { User } from "../models/User.js";

const router = Router();

const categoryStyles = {
  business: { accent: "mint", artwork: "✺" },
  design: { accent: "lavender", artwork: "✳" },
  development: { accent: "peach", artwork: "{ }" },
};

router.get("/dashboard", async (request, response, next) => {
  try {
    const courses = await Course.find({ status: "published" })
      .select("title description category instructor thumbnailUrl updatedAt")
      .populate({ path: "instructor", select: "name", model: User })
      .sort({ updatedAt: -1 })
      .lean();
    const courseIds = courses.map((course) => course._id);
    const lessons = courseIds.length
      ? await Lesson.find({ course: { $in: courseIds }, isPublished: true })
          .select("course title position type liveClass")
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

    const dashboardCourses = courses.map((course) => {
      const category = course.category?.trim() || "General";
      const style = categoryStyles[category.toLowerCase()] ?? {
        accent: "lavender",
        artwork: "✦",
      };
      const courseLessons = lessonsByCourse.get(String(course._id)) ?? [];
      const nextLesson = courseLessons.find((lesson) => lesson.type !== "live");

      return {
        id: String(course._id),
        title: course.title,
        subtitle: course.description,
        instructor: course.instructor?.name ?? "Instructor",
        category,
        thumbnailUrl: course.thumbnailUrl ?? "",
        progress: 0,
        lessonsComplete: 0,
        lessonsTotal: courseLessons.length,
        accent: style.accent,
        artwork: style.artwork,
        nextLesson: nextLesson?.title ?? "Course outline coming soon",
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
