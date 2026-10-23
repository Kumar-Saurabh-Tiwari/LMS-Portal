import mongoose from "mongoose";

const { Schema, model } = mongoose;

const userSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    roles: {
      type: [
        {
          type: String,
          enum: ["student", "instructor", "admin"],
        },
      ],
      required: true,
      default: ["student"],
      validate: [
        {
          validator: (roles) => roles.length > 0,
          message: "A user must have at least one role.",
        },
        {
          validator: (roles) => new Set(roles).size === roles.length,
          message: "User roles must not contain duplicates.",
        },
      ],
    },
    avatarUrl: {
      type: String,
      trim: true,
    },
    instructorProfile: {
      bio: { type: String, maxlength: 2000 },
      expertise: [{ type: String, trim: true }],
      paymentAccountId: { type: String, trim: true },
    },
    status: {
      type: String,
      enum: ["active", "suspended"],
      default: "active",
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(document, user) {
        delete user.passwordHash;
        return user;
      },
    },
  }
);

export const User = model("User", userSchema);
