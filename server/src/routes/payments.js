import { Router } from "express";
import Stripe from "stripe";
import { Course } from "../models/Course.js";
import { Enrollment } from "../models/Enrollment.js";
import { Lesson } from "../models/Lesson.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

function stripeClient() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY must be configured.");
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

router.post("/payments/checkout", requireAuth, async (request, response, next) => {
  try {
    const course = await Course.findOne({ _id: request.body.courseId, status: "published" });
    if (!course) {
      response.status(404).json({ error: "Published course not found." });
      return;
    }
    if (course.pricing.type !== "paid" || !course.pricing.amount) {
      response.status(400).json({ error: "This course does not require payment." });
      return;
    }
    const existing = await Enrollment.findOne({
      student: request.user._id,
      course: course._id,
      status: { $in: ["active", "completed"] },
      "purchase.status": "paid",
    }).select("_id");
    if (existing) {
      response.status(409).json({ error: "You are already enrolled in this course." });
      return;
    }
    const clientUrl = process.env.CLIENT_ORIGIN ?? "http://localhost:5173";
    const exponent = new Intl.NumberFormat("en", {
      style: "currency",
      currency: course.pricing.currency,
    }).resolvedOptions().maximumFractionDigits;
    const minorUnitFactor = 10 ** exponent;
    const session = await stripeClient().checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{
        quantity: 1,
        price_data: {
          currency: course.pricing.currency.toLowerCase(),
          unit_amount: Math.round(course.pricing.amount * minorUnitFactor),
          product_data: { name: course.title },
        },
      }],
      client_reference_id: String(request.user._id),
      metadata: { studentId: String(request.user._id), courseId: String(course._id) },
      success_url: `${clientUrl}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${clientUrl}/?checkout=cancelled`,
    });
    response.status(201).json({ checkoutUrl: session.url, sessionId: session.id });
  } catch (error) {
    next(error);
  }
});

router.post("/payments/webhook", async (request, response, next) => {
  try {
    const signature = request.get("stripe-signature");
    if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
      response.status(400).json({ error: "Stripe webhook signature configuration is missing." });
      return;
    }
    const event = stripeClient().webhooks.constructEvent(
      request.rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const { studentId, courseId } = session.metadata ?? {};
      if (session.payment_status === "paid" && studentId && courseId) {
        const course = await Course.findById(courseId);
        if (!course || course.status !== "published") {
          response.status(409).json({ error: "The purchased course is no longer available." });
          return;
        }
        const exponent = new Intl.NumberFormat("en", {
          style: "currency",
          currency: course.pricing.currency,
        }).resolvedOptions().maximumFractionDigits;
        const expectedAmount = Math.round(course.pricing.amount * (10 ** exponent));
        if (session.currency !== course.pricing.currency.toLowerCase() || session.amount_total !== expectedAmount) {
          response.status(400).json({ error: "Payment amount or currency does not match the course price." });
          return;
        }
        const lessons = await Lesson.find({ course: courseId, isPublished: true }).select("_id");
        const enrollmentResult = await Enrollment.findOneAndUpdate(
          { student: studentId, course: courseId },
          {
            $setOnInsert: {
              student: studentId,
              course: courseId,
              enrolledAt: new Date(),
              progress: { totalLessons: lessons.length, lessons: lessons.map(({ _id }) => ({ lesson: _id })) },
            },
            $set: {
              status: "active",
              "purchase.amount": session.amount_total / (10 ** exponent),
              "purchase.currency": session.currency?.toUpperCase() ?? course.pricing.currency,
              "purchase.provider": "stripe",
              "purchase.providerPaymentId": session.id,
              "purchase.status": "paid",
              "purchase.paidAt": new Date(session.created * 1000),
            },
          },
          { upsert: true, new: true, runValidators: true, includeResultMetadata: true }
        );
        const enrollment = enrollmentResult.value;
        if (enrollmentResult.lastErrorObject?.upserted) {
          await Course.updateOne({ _id: courseId }, { $inc: { enrollmentCount: 1 } });
        }
        response.json({ received: true, enrollmentId: String(enrollment._id) });
        return;
      }
    }
    response.json({ received: true });
  } catch (error) {
    if (error.type === "StripeSignatureVerificationError") {
      response.status(400).json({ error: "Stripe webhook signature is invalid." });
      return;
    }
    next(error);
  }
});

export default router;
