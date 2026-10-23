import "dotenv/config";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { connectToDatabase } from "./config/database.js";
import { Course } from "./models/Course.js";
import { Lesson } from "./models/Lesson.js";
import { User } from "./models/User.js";

const instructors = [
  { name: "Mira Chen", email: "mira.chen.seed@learnspace.example" },
  { name: "Luis Ortega", email: "luis.ortega.seed@learnspace.example" },
  { name: "Amara Okafor", email: "amara.okafor.seed@learnspace.example" },
];

const courses = [
  {
    slug: "seed-product-design-essentials",
    title: "Product Design Essentials",
    description: "Learn the foundations of user-centered design, from understanding your audience to shaping polished interfaces.",
    category: "Design",
    instructorIndex: 0,
    lessons: [
      { title: "Start with the people using your product", type: "video" },
      { title: "A practical guide to design systems", type: "text" },
      { title: "Live design portfolio critique", type: "live", liveClassDaysFromNow: 2 },
    ],
  },
  {
    slug: "seed-javascript-for-modern-apps",
    title: "JavaScript for Modern Apps",
    description: "Build a solid foundation in modern JavaScript, async programming, and the patterns used in today's web apps.",
    category: "Development",
    instructorIndex: 1,
    lessons: [
      { title: "JavaScript essentials and variables", type: "video" },
      { title: "Working with async code", type: "video" },
      { title: "Live JavaScript questions and answers", type: "live", liveClassDaysFromNow: 4 },
    ],
  },
  {
    slug: "seed-build-a-memorable-brand",
    title: "Build a Memorable Brand",
    description: "Explore brand strategy, find a clear brand voice, and turn your ideas into a consistent identity.",
    category: "Business",
    instructorIndex: 2,
    lessons: [
      { title: "What makes a brand meaningful?", type: "video" },
      { title: "Finding your brand voice", type: "text" },
    ],
  },
];

async function createInstructor(instructor) {
  const initialPassword = process.env.SEED_INSTRUCTOR_PASSWORD ?? randomBytes(32).toString("base64url");
  const passwordHash = await bcrypt.hash(initialPassword, 12);

  return User.findOneAndUpdate(
    { email: instructor.email },
    {
      $setOnInsert: {
        name: instructor.name,
        email: instructor.email,
        passwordHash,
        roles: ["instructor"],
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
  );
}

async function seed() {
  await connectToDatabase();
  console.info("Connected to MongoDB successfully.");

  const instructorRecords = await Promise.all(instructors.map(createInstructor));
  const now = new Date();
  let lessonCount = 0;

  for (const courseData of courses) {
    const instructor = instructorRecords[courseData.instructorIndex];
    const course = await Course.findOneAndUpdate(
      { slug: courseData.slug },
      {
        $setOnInsert: {
          title: courseData.title,
          slug: courseData.slug,
          description: courseData.description,
          category: courseData.category,
          instructor: instructor._id,
          status: "published",
          publishedAt: now,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
    );

    for (const [position, lessonData] of courseData.lessons.entries()) {
      const liveClass = lessonData.type === "live"
        ? {
            startsAt: new Date(now.getTime() + lessonData.liveClassDaysFromNow * 24 * 60 * 60 * 1000),
            status: "scheduled",
          }
        : undefined;
      const update = {
        $setOnInsert: {
          course: course._id,
          title: lessonData.title,
          position,
          type: lessonData.type,
          isPublished: true,
          ...(liveClass ? { liveClass } : {}),
        },
      };

      await Lesson.findOneAndUpdate(
        { course: course._id, position },
        update,
        { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
      );
      lessonCount += 1;
    }
  }

  console.info(`Seed data ready: ${courses.length} courses, ${lessonCount} lessons, ${instructors.length} instructors.`);
}

try {
  await seed();
} catch (error) {
  console.error("Failed to seed MongoDB:", error);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
