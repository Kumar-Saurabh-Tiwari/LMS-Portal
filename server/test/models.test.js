import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import { Course } from "../src/models/Course.js";
import { Enrollment } from "../src/models/Enrollment.js";
import { Lesson } from "../src/models/Lesson.js";
import { User } from "../src/models/User.js";

test("user defaults to the student role and hides password hashes", () => {
  const user = new User({
    name: "Ada Learner",
    email: "ada@example.com",
    passwordHash: "hashed-password",
  });

  assert.deepEqual(user.roles, ["student"]);
  assert.equal(user.toJSON().passwordHash, undefined);
});

test("user rejects an empty role list", async () => {
  const user = new User({
    name: "No Role",
    email: "no-role@example.com",
    passwordHash: "hashed-password",
    roles: [],
  });

  await assert.rejects(user.validate(), (error) => error.errors.roles);
});

test("paid courses require a positive integer amount", async () => {
  const course = new Course({
    instructor: new mongoose.Types.ObjectId(),
    title: "Course",
    slug: "course",
    description: "Description",
    pricing: { type: "paid", amount: 10.5 },
  });

  await assert.rejects(course.validate(), (error) => error.errors["pricing.amount"]);
});

test("lesson positions must be non-negative integers", async () => {
  const lesson = new Lesson({
    course: new mongoose.Types.ObjectId(),
    title: "Lesson",
    position: 1.5,
    type: "video",
  });

  await assert.rejects(lesson.validate(), (error) => error.errors.position);
});

test("enrollment requires student and course references", async () => {
  const enrollment = new Enrollment({});

  await assert.rejects(enrollment.validate(), (error) => {
    return error.errors.student && error.errors.course;
  });
});
