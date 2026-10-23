import { Router } from "express";
import { createReadStream } from "node:fs";
import { mkdir, unlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import multer from "multer";
import { Course } from "../models/Course.js";
import { Enrollment } from "../models/Enrollment.js";
import { Lesson } from "../models/Lesson.js";
import { optionalAuth, requireAuth, requireRole } from "../middleware/auth.js";
import { isCloudStorageConfigured, mediaUrl, putMedia } from "../config/mediaStorage.js";
import { getVideoQueue } from "../jobs/videoQueue.js";
import { findActiveEnrollment, markLessonComplete } from "../services/progress.js";

const router = Router();
const uploadDirectory = path.join(os.tmpdir(), "lms-video-uploads");
await mkdir(uploadDirectory, { recursive: true });
const extensionsByMimeType = {
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/quicktime": ".mov",
  "video/x-matroska": ".mkv",
};
const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDirectory,
    filename: (request, file, callback) => callback(null, `${randomUUID()}${extensionsByMimeType[file.mimetype] ?? ".video"}`),
  }),
  limits: { fileSize: Number(process.env.MAX_VIDEO_UPLOAD_BYTES ?? 2 * 1024 * 1024 * 1024) },
  fileFilter: (request, file, callback) => {
    if (!["video/mp4", "video/webm", "video/quicktime", "video/x-matroska"].includes(file.mimetype)) {
      const error = new Error("Upload an MP4, WebM, MOV, or MKV video.");
      error.status = 415;
      callback(error);
      return;
    }
    callback(null, true);
  },
});

async function removeTempUpload(filePath) {
  try {
    await unlink(filePath);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

async function ownsLesson(lesson, user) {
  const course = await Course.findById(lesson.course).select("instructor");
  return course && (user.roles.includes("admin") || String(course.instructor) === String(user._id));
}

router.post(
  "/lessons/:id/video",
  requireAuth,
  requireRole("instructor", "admin"),
  (request, response, next) => {
    if (!process.env.REDIS_URL) {
      response.status(503).json({ error: "REDIS_URL must be configured before video uploads can be processed." });
      return;
    }
    if (process.env.AWS_S3_BUCKET && !isCloudStorageConfigured()) {
      response.status(503).json({ error: "Configure CLOUDFRONT_URL before uploading videos to S3." });
      return;
    }
    next();
  },
  upload.single("video"),
  async (request, response, next) => {
    try {
      const lesson = await Lesson.findById(request.params.id);
      if (!lesson) {
        response.status(404).json({ error: "Lesson not found." });
        return;
      }
      if (lesson.type !== "video") {
        response.status(400).json({ error: "Video files can only be uploaded to video lessons." });
        return;
      }
      if (!(await ownsLesson(lesson, request.user))) {
        response.status(403).json({ error: "You can only upload videos to your own courses." });
        return;
      }
      if (!request.file) {
        response.status(400).json({ error: "Select a video file to upload." });
        return;
      }
      const sourceKey = `uploads/${lesson._id}/${path.basename(request.file.path)}`;
      try {
        await putMedia(sourceKey, createReadStream(request.file.path), request.file.mimetype);
        lesson.video.sourceKey = sourceKey;
        lesson.video.hlsMasterKey = undefined;
        lesson.video.processingStatus = "queued";
        lesson.video.processingError = undefined;
        await lesson.save();
        const job = await getVideoQueue().add(
          "transcode",
          { lessonId: String(lesson._id), sourceKey },
          { attempts: 3, backoff: { type: "exponential", delay: 5000 }, removeOnComplete: 100, removeOnFail: 500 }
        );
        response.status(202).json({ lessonId: String(lesson._id), jobId: job.id, processingStatus: "queued" });
      } catch (error) {
        lesson.video.processingStatus = "failed";
        lesson.video.processingError = error.message.slice(0, 500);
        await lesson.save();
        throw error;
      } finally {
        await removeTempUpload(request.file.path);
      }
    } catch (error) {
      if (request.file?.path) await removeTempUpload(request.file.path);
      next(error);
    }
  }
);

router.get("/lessons/:id/stream", optionalAuth, async (request, response, next) => {
  try {
    const lesson = await Lesson.findById(request.params.id).select("course isPreview isPublished video");
    if (!lesson || !lesson.isPublished || lesson.video.processingStatus !== "ready" || !lesson.video.hlsMasterKey) {
      response.status(404).json({ error: "Ready video lesson not found." });
      return;
    }
    const course = await Course.findById(lesson.course).select("instructor");
    const allowed = lesson.isPreview ||
      request.user?.roles.includes("admin") ||
      (request.user && String(course?.instructor) === String(request.user._id)) ||
      (request.user && await Enrollment.exists({
        student: request.user._id,
        course: lesson.course,
        status: { $in: ["active", "completed"] },
        "purchase.status": { $in: ["not_required", "paid"] },
      }));
    if (!allowed) {
      response.status(403).json({ error: "Enroll in this course to watch this lesson." });
      return;
    }
    response.json({ url: mediaUrl(lesson.video.hlsMasterKey), type: "application/vnd.apple.mpegurl" });
  } catch (error) {
    next(error);
  }
});

router.patch("/lessons/:id/publish", requireAuth, requireRole("instructor", "admin"), async (request, response, next) => {
  try {
    const lesson = await Lesson.findById(request.params.id);
    if (!lesson) {
      response.status(404).json({ error: "Lesson not found." });
      return;
    }
    if (!(await ownsLesson(lesson, request.user))) {
      response.status(403).json({ error: "You can only publish lessons in your own courses." });
      return;
    }
    if (lesson.type === "video" && lesson.video.processingStatus !== "ready") {
      response.status(409).json({ error: "Finish video processing before publishing this lesson." });
      return;
    }
    if (lesson.type === "text" && !lesson.textContent?.trim()) {
      response.status(409).json({ error: "Add lesson content before publishing this lesson." });
      return;
    }
    if (lesson.type === "quiz" && !lesson.quiz) {
      response.status(409).json({ error: "Configure the quiz before publishing this lesson." });
      return;
    }
    lesson.isPublished = true;
    await lesson.save();
    response.json({ lesson });
  } catch (error) {
    next(error);
  }
});

router.post("/lessons/:id/complete", requireAuth, async (request, response, next) => {
  try {
    const lesson = await Lesson.findById(request.params.id);
    if (!lesson || !lesson.isPublished) {
      response.status(404).json({ error: "Published lesson not found." });
      return;
    }
    const enrollment = await findActiveEnrollment(request.user._id, lesson.course);
    if (!enrollment) {
      response.status(403).json({ error: "An active course enrollment is required." });
      return;
    }
    if (lesson.type === "video" && lesson.video.processingStatus !== "ready") {
      response.status(409).json({ error: "This video is not ready to complete." });
      return;
    }
    if (lesson.type === "quiz" && !enrollment.progress.quizAttempts.some(
      (attempt) => String(attempt.lesson) === String(lesson._id) && attempt.passed
    )) {
      response.status(409).json({ error: "Pass the quiz before completing this lesson." });
      return;
    }
    if (lesson.type === "live" && lesson.liveClass.status !== "ended") {
      response.status(409).json({ error: "A live class must end before it can be completed." });
      return;
    }
    const lastPositionSeconds = request.body.lastPositionSeconds;
    if (lastPositionSeconds !== undefined &&
        (!Number.isFinite(lastPositionSeconds) || lastPositionSeconds < 0)) {
      response.status(400).json({ error: "Lesson position must be a non-negative number." });
      return;
    }
    if (lesson.type === "video" && lesson.durationSeconds > 0 &&
        (!Number.isFinite(lastPositionSeconds) || lastPositionSeconds < lesson.durationSeconds * 0.9)) {
      response.status(409).json({ error: "Watch at least 90% of the video before completing this lesson." });
      return;
    }
    const progress = enrollment.progress.lessons.find((item) => String(item.lesson) === String(lesson._id));
    if (progress && lastPositionSeconds !== undefined) progress.lastPositionSeconds = lastPositionSeconds;
    const updatedEnrollment = await markLessonComplete(enrollment, lesson._id);
    response.json({ enrollment: updatedEnrollment });
  } catch (error) {
    next(error);
  }
});

export default router;
