import { Router } from "express";
import { Course } from "../models/Course.js";
import { Enrollment } from "../models/Enrollment.js";
import { Lesson } from "../models/Lesson.js";
import { User } from "../models/User.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

router.get("/instructor/courses", requireAuth, requireRole("instructor", "admin"), async (request, response, next) => {
  try {
    const filter = request.user.roles.includes("admin") ? {} : { instructor: request.user._id };
    const courses = await Course.find(filter).select("title status pricing enrollmentCount").sort({ updatedAt: -1 }).lean();
    const courseIds = courses.map((course) => course._id);
    const lessons = courseIds.length
      ? await Lesson.find({ course: { $in: courseIds } })
          .select("course title type position isPublished video.processingStatus")
          .sort({ course: 1, position: 1 })
          .lean()
      : [];
    const lessonsByCourse = new Map();
    for (const lesson of lessons) {
      const id = String(lesson.course);
      const items = lessonsByCourse.get(id) ?? [];
      items.push({
        id: String(lesson._id),
        title: lesson.title,
        type: lesson.type,
        position: lesson.position,
        isPublished: lesson.isPublished,
        videoStatus: lesson.video?.processingStatus,
      });
      lessonsByCourse.set(id, items);
    }
    response.json({
      courses: courses.map((course) => ({
        id: String(course._id),
        title: course.title,
        status: course.status,
        pricing: course.pricing,
        enrollmentCount: course.enrollmentCount,
        lessons: lessonsByCourse.get(String(course._id)) ?? [],
      })),
    });
  } catch (error) {
    next(error);
  }
});

router.put("/admin/users/:id/roles", requireAuth, requireRole("admin"), async (request, response, next) => {
  try {
    const roles = request.body.roles;
    const allowedRoles = ["student", "instructor", "admin"];
    if (!Array.isArray(roles) || !roles.length ||
        roles.some((role) => !allowedRoles.includes(role)) ||
        new Set(roles).size !== roles.length) {
      response.status(400).json({ error: "Provide one or more unique valid roles." });
      return;
    }
    const user = await User.findById(request.params.id);
    if (!user) {
      response.status(404).json({ error: "User not found." });
      return;
    }
    if (user.roles.includes("admin") && !roles.includes("admin") &&
        await User.countDocuments({ roles: "admin" }) < 2) {
      response.status(409).json({ error: "The last administrator cannot be demoted." });
      return;
    }
    user.roles = roles;
    await user.save();
    response.json({ user: user.toJSON() });
  } catch (error) {
    next(error);
  }
});

router.get("/instructor/revenue", requireAuth, requireRole("instructor", "admin"), async (request, response, next) => {
  try {
    const courseFilter = request.user.roles.includes("admin") ? {} : { instructor: request.user._id };
    const courses = await Course.find(courseFilter).select("title pricing.currency instructor").lean();
    const courseIds = courses.map((course) => course._id);
    const revenue = courseIds.length
      ? await Enrollment.aggregate([
          { $match: { course: { $in: courseIds }, "purchase.status": "paid", status: { $in: ["active", "completed"] } } },
          {
            $group: {
              _id: { course: "$course", currency: "$purchase.currency" },
              paidEnrollments: { $sum: 1 },
              grossRevenue: { $sum: "$purchase.amount" },
            },
          },
        ])
      : [];
    const courseById = new Map(courses.map((course) => [String(course._id), course]));
    response.json({
      courses: revenue.map((item) => ({
        courseId: String(item._id.course),
        title: courseById.get(String(item._id.course))?.title,
        currency: item._id.currency ?? courseById.get(String(item._id.course))?.pricing?.currency ?? "USD",
        paidEnrollments: item.paidEnrollments,
        grossRevenue: item.grossRevenue,
      })),
      totals: revenue.reduce((totals, item) => {
        const currency = item._id.currency ?? "USD";
        totals[currency] = (totals[currency] ?? 0) + item.grossRevenue;
        return totals;
      }, {}),
      note: "Gross test-mode sales before Stripe fees; no instructor payout transfer is made.",
    });
  } catch (error) {
    next(error);
  }
});

export default router;
