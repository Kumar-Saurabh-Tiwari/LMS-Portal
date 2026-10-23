import mongoose from "mongoose";

const { Schema, model } = mongoose;

const lessonProgressSchema = new Schema(
  {
    lesson: {
      type: Schema.Types.ObjectId,
      ref: "Lesson",
      required: true,
    },
    status: {
      type: String,
      enum: ["not_started", "in_progress", "completed"],
      default: "not_started",
    },
    completedAt: Date,
    lastPositionSeconds: {
      type: Number,
      min: 0,
      default: 0,
    },
  },
  { _id: false }
);

const enrollmentSchema = new Schema(
  {
    student: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    course: {
      type: Schema.Types.ObjectId,
      ref: "Course",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["active", "completed", "refunded", "cancelled"],
      default: "active",
      required: true,
    },
    enrolledAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    completedAt: Date,
    progress: {
      lessons: {
        type: [lessonProgressSchema],
        default: [],
      },
      completedLessons: {
        type: Number,
        min: 0,
        default: 0,
      },
      totalLessons: {
        type: Number,
        min: 0,
        default: 0,
      },
    },
    purchase: {
      amount: { type: Number, min: 0 },
      currency: { type: String, uppercase: true },
      provider: { type: String, trim: true },
      providerPaymentId: { type: String, trim: true },
      status: {
        type: String,
        enum: ["not_required", "pending", "paid", "failed", "refunded"],
        default: "not_required",
      },
      paidAt: Date,
    },
    certificate: {
      issuedAt: Date,
      storageKey: String,
    },
  },
  { timestamps: true }
);

enrollmentSchema.index({ student: 1, course: 1 }, { unique: true });
enrollmentSchema.index({ course: 1, status: 1 });

export const Enrollment = model("Enrollment", enrollmentSchema);
