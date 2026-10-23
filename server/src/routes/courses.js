import { Router } from "express";
import { Course } from "../models/Course.js";
import { Lesson } from "../models/Lesson.js";
import { Enrollment } from "../models/Enrollment.js";
import { optionalAuth, requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

function canManageCourse(course, user) {
  return user.roles.includes("admin") || String(course.instructor) === String(user._id);
}

function slugify(value) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

router.get("/courses", async (request, response, next) => {
  try {
    const courses = await Course.find({ status: "published" })
      .select("title slug description category level language thumbnailUrl pricing instructor")
      .populate("instructor", "name")
      .sort({ publishedAt: -1 })
      .lean();
    response.json({ courses });
  } catch (error) {
    next(error);
  }
});

router.get("/courses/:slug", optionalAuth, async (request, response, next) => {
  try {
    const course = await Course.findOne({ slug: request.params.slug, status: "published" })
      .populate("instructor", "name instructorProfile.bio");
    if (!course) {
      response.status(404).json({ error: "Course not found." });
      return;
    }
    const lessons = await Lesson.find({ course: course._id, isPublished: true })
      .select("-video -quiz")
      .sort({ position: 1 })
      .lean();
    const isOwner = request.user && (
      request.user.roles.includes("admin") ||
      (course.instructor && String(course.instructor._id ?? course.instructor) === String(request.user._id))
    );
    const isEnrolled = request.user && await Enrollment.exists({
      student: request.user._id,
      course: course._id,
      status: { $in: ["active", "completed"] },
      "purchase.status": { $in: ["not_required", "paid"] },
    });
    response.json({
      course,
      lessons: lessons.map((lesson) => ({
        ...lesson,
        ...(!lesson.isPreview && !isOwner && !isEnrolled ? { textContent: undefined } : {}),
      })),
    });
  } catch (error) {
    next(error);
  }
});

router.post("/courses", requireAuth, requireRole("instructor", "admin"), async (request, response, next) => {
  try {
    const { title, description, category, level, language, pricing, thumbnailUrl } = request.body;
    if (typeof title !== "string" || !title.trim() || typeof description !== "string" || !description.trim()) {
      response.status(400).json({ error: "Course title and description are required." });
      return;
    }
    const baseSlug = slugify(title);
    let slug = baseSlug;
    let suffix = 2;
    while (await Course.exists({ slug })) {
      slug = `${baseSlug}-${suffix}`;
      suffix += 1;
    }
    const course = await Course.create({
      instructor: request.user._id,
      title: title.trim(),
      slug,
      description: description.trim(),
      category,
      level,
      language,
      pricing,
      thumbnailUrl,
    });
    response.status(201).json({ course });
  } catch (error) {
    next(error);
  }
});

router.patch("/courses/:id", requireAuth, requireRole("instructor", "admin"), async (request, response, next) => {
  try {
    const course = await Course.findById(request.params.id);
    if (!course) {
      response.status(404).json({ error: "Course not found." });
      return;
    }
    if (!canManageCourse(course, request.user)) {
      response.status(403).json({ error: "You can only edit your own courses." });
      return;
    }

    const editableFields = ["title", "description", "category", "level", "language", "thumbnailUrl", "pricing"];
    for (const field of editableFields) {
      if (Object.hasOwn(request.body, field)) course[field] = request.body[field];
    }
    if (Object.hasOwn(request.body, "status")) {
      if (!["draft", "published", "archived"].includes(request.body.status)) {
        response.status(400).json({ error: "Course status is invalid." });
        return;
      }
      course.status = request.body.status;
      if (course.status === "published" && !course.publishedAt) course.publishedAt = new Date();
      if (course.status === "published" && !await Lesson.exists({ course: course._id, isPublished: true })) {
        response.status(409).json({ error: "Publish at least one lesson before publishing this course." });
        return;
      }
    }
    await course.save();
    response.json({ course });
  } catch (error) {
    next(error);
  }
});

router.post("/courses/:id/lessons", requireAuth, requireRole("instructor", "admin"), async (request, response, next) => {
  try {
    const course = await Course.findById(request.params.id);
    if (!course) {
      response.status(404).json({ error: "Course not found." });
      return;
    }
    if (!canManageCourse(course, request.user)) {
      response.status(403).json({ error: "You can only add lessons to your own courses." });
      return;
    }
    const { title, description, type, position, isPreview, durationSeconds, textContent, liveClass } = request.body;
    if (typeof title !== "string" || !title.trim() || !["video", "live", "quiz", "text"].includes(type)) {
      response.status(400).json({ error: "A lesson title and valid lesson type are required." });
      return;
    }
    if (type === "text" && (typeof textContent !== "string" || !textContent.trim())) {
      response.status(400).json({ error: "Text lessons require lesson content." });
      return;
    }
    if (type === "live" && (!liveClass?.startsAt || !Number.isFinite(new Date(liveClass.startsAt).getTime()))) {
      response.status(400).json({ error: "Live classes require a valid start time." });
      return;
    }
    if (type === "live" && liveClass.endsAt &&
        (!Number.isFinite(new Date(liveClass.endsAt).getTime()) ||
         new Date(liveClass.endsAt).getTime() <= new Date(liveClass.startsAt).getTime())) {
      response.status(400).json({ error: "Live class end time must be after its start time." });
      return;
    }
    const nextPosition = Number.isInteger(position)
      ? position
      : await Lesson.countDocuments({ course: course._id });
    const lesson = await Lesson.create({
      course: course._id,
      title: title.trim(),
      description,
      type,
      position: nextPosition,
      isPreview: Boolean(isPreview),
      isPublished: false,
      durationSeconds,
      textContent,
      ...(type === "live" ? { liveClass: { ...liveClass, status: "scheduled" } } : {}),
    });
    response.status(201).json({ lesson });
  } catch (error) {
    next(error);
  }
});

router.post("/courses/:id/enroll", requireAuth, async (request, response, next) => {
  try {
    const course = await Course.findOne({ _id: request.params.id, status: "published" });
    if (!course) {
      response.status(404).json({ error: "Published course not found." });
      return;
    }
    if (course.pricing.type === "paid") {
      response.status(402).json({ error: "Complete checkout before enrolling in this paid course." });
      return;
    }
    const lessons = await Lesson.find({ course: course._id, isPublished: true }).select("_id");
    const enrollmentResult = await Enrollment.findOneAndUpdate(
      { student: request.user._id, course: course._id },
      {
        $setOnInsert: {
          student: request.user._id,
          course: course._id,
          "purchase.status": "not_required",
          "purchase.amount": 0,
          progress: {
            totalLessons: lessons.length,
            lessons: lessons.map(({ _id }) => ({ lesson: _id })),
          },
        },
      },
      { upsert: true, new: true, runValidators: true, includeResultMetadata: true }
    );
    const enrollment = enrollmentResult.value;
    if (enrollmentResult.lastErrorObject?.upserted) {
      await Course.updateOne({ _id: course._id }, { $inc: { enrollmentCount: 1 } });
    }
    response.status(200).json({ enrollment });
  } catch (error) {
    next(error);
  }
});

router.get("/me/enrollments", requireAuth, async (request, response, next) => {
  try {
    const enrollments = await Enrollment.find({ student: request.user._id })
      .populate("course", "title slug thumbnailUrl instructor")
      .sort({ enrolledAt: -1 })
      .lean();
    response.json({ enrollments });
  } catch (error) {
    next(error);
  }
});

export default router;
