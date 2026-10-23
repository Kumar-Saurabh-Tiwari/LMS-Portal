import mongoose from "mongoose";

const { Schema, model } = mongoose;

const courseSchema = new Schema(
  {
    instructor: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      maxlength: 10000,
    },
    category: {
      type: String,
      trim: true,
      index: true,
    },
    level: {
      type: String,
      enum: ["beginner", "intermediate", "advanced", "all_levels"],
      default: "all_levels",
    },
    language: {
      type: String,
      default: "en",
    },
    thumbnailUrl: {
      type: String,
      trim: true,
    },
    pricing: {
      type: {
        type: String,
        enum: ["free", "paid"],
        required: true,
        default: "free",
      },
      amount: {
        type: Number,
        min: 0,
        default: 0,
        validate: {
          validator(amount) {
            if (this.pricing?.type === "paid") {
              return Number.isInteger(amount) && amount > 0;
            }
            return amount === 0;
          },
          message: "Free courses must cost zero; paid courses need a positive integer amount.",
        },
      },
      currency: {
        type: String,
        uppercase: true,
        default: "USD",
        minlength: 3,
        maxlength: 3,
      },
    },
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
      required: true,
      index: true,
    },
    publishedAt: Date,
    enrollmentCount: {
      type: Number,
      min: 0,
      default: 0,
    },
  },
  { timestamps: true }
);

courseSchema.index({ status: 1, category: 1, createdAt: -1 });

export const Course = model("Course", courseSchema);
