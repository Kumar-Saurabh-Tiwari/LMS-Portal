import { Router } from "express";
import { AccessToken } from "livekit-server-sdk";
import { Course } from "../models/Course.js";
import { Lesson } from "../models/Lesson.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { findActiveEnrollment } from "../services/progress.js";

const router = Router();

router.post("/lessons/:id/live-token", requireAuth, async (request, response, next) => {
  try {
    const lesson = await Lesson.findById(request.params.id).select("course type isPublished liveClass");
    if (!lesson || lesson.type !== "live" || !lesson.isPublished ||
        !["scheduled", "live"].includes(lesson.liveClass?.status)) {
      response.status(404).json({ error: "Scheduled live class not found." });
      return;
    }
    const course = await Course.findById(lesson.course).select("instructor");
    const isInstructor = course && String(course.instructor) === String(request.user._id);
    const isAdmin = request.user.roles.includes("admin");
    const enrollment = await findActiveEnrollment(request.user._id, lesson.course);
    if (!isInstructor && !isAdmin && !enrollment) {
      response.status(403).json({ error: "Enroll in this course to join the live class." });
      return;
    }
    const startsAt = lesson.liveClass.startsAt ? new Date(lesson.liveClass.startsAt).getTime() : 0;
    if (lesson.liveClass.status !== "live" && startsAt > Date.now() + 15 * 60 * 1000) {
      response.status(409).json({ error: "The live class room opens 15 minutes before it starts." });
      return;
    }
    const { LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET } = process.env;
    if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
      response.status(503).json({ error: "LiveKit is not configured on this server." });
      return;
    }
    const room = lesson.liveClass.liveKitRoomName || `lesson-${lesson._id}`;
    const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: String(request.user._id),
      name: request.user.name,
      ttl: "2h",
    });
    token.addGrant({ roomJoin: true, room, canPublish: true, canPublishData: true });
    response.json({ url: LIVEKIT_URL, token: await token.toJwt(), room, status: lesson.liveClass.status });
  } catch (error) {
    next(error);
  }
});

router.patch(
  "/lessons/:id/live-status",
  requireAuth,
  requireRole("instructor", "admin"),
  async (request, response, next) => {
    try {
      const lesson = await Lesson.findById(request.params.id);
      if (!lesson || lesson.type !== "live") {
        response.status(404).json({ error: "Live lesson not found." });
        return;
      }
      const course = await Course.findById(lesson.course).select("instructor");
      if (!course || (!request.user.roles.includes("admin") && String(course.instructor) !== String(request.user._id))) {
        response.status(403).json({ error: "You can only update live classes in your own courses." });
        return;
      }
      const nextStatus = request.body.status;
      const transitions = { scheduled: ["live", "cancelled"], live: ["ended", "cancelled"] };
      if (!transitions[lesson.liveClass.status]?.includes(nextStatus)) {
        response.status(400).json({ error: "This live class status transition is not allowed." });
        return;
      }
      lesson.liveClass.status = nextStatus;
      await lesson.save();
      response.json({ liveClass: lesson.liveClass });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
