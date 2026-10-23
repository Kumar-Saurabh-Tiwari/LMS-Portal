import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import app from "../src/app.js";
import { Course } from "../src/models/Course.js";
import { Lesson } from "../src/models/Lesson.js";

test("dashboard API returns published courses and upcoming live lessons", async (context) => {
  const instructor = { name: "Ada Instructor" };
  const course = {
    _id: "course-1",
    title: "Design Foundations",
    description: "Learn the fundamentals.",
    category: "Design",
    instructor,
    thumbnailUrl: "https://example.test/design.jpg",
  };
  const startsAt = new Date(Date.now() + 60_000);
  const lesson = {
    _id: "lesson-1",
    course: course._id,
    title: "Design critique",
    position: 0,
    type: "live",
    liveClass: { startsAt, status: "scheduled" },
  };
  const courseQuery = {
    select() { return this; },
    populate() { return this; },
    sort() { return this; },
    async lean() { return [course]; },
  };
  const lessonQuery = {
    select() { return this; },
    sort() { return this; },
    async lean() { return [lesson]; },
  };
  const originalCourseFind = Course.find;
  const originalLessonFind = Lesson.find;
  Course.find = () => courseQuery;
  Lesson.find = () => lessonQuery;

  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(async () => {
    Course.find = originalCourseFind;
    Lesson.find = originalLessonFind;
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });

  const { port } = server.address();
  const rootResponse = await fetch(`http://127.0.0.1:${port}/`);
  const rootPayload = await rootResponse.json();
  assert.equal(rootResponse.status, 200);
  assert.equal(rootPayload.status, "ok");
  assert.ok(["connected", "disconnected"].includes(rootPayload.database));
  assert.equal(rootPayload.endpoints.dashboard, "GET /api/dashboard");

  const response = await fetch(`http://127.0.0.1:${port}/api/dashboard`);
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(payload.courses[0], {
    id: "course-1",
    title: "Design Foundations",
    subtitle: "Learn the fundamentals.",
    instructor: "Ada Instructor",
    canManage: false,
    category: "Design",
    thumbnailUrl: "https://example.test/design.jpg",
    isEnrolled: false,
    enrollmentId: null,
    progress: 0,
    lessonsComplete: 0,
    lessonsTotal: 1,
    lessons: [{
      id: "lesson-1",
      title: "Design critique",
      type: "live",
      durationSeconds: 0,
      liveClassStatus: "scheduled",
    }],
    accent: "lavender",
    artwork: "✳",
    nextLesson: "Course outline coming soon",
    nextLessonId: null,
    nextLessonType: null,
  });
  assert.equal(payload.liveClasses[0].id, "lesson-1");
  assert.equal(payload.liveClasses[0].title, "Design critique");
  assert.equal(payload.liveClasses[0].instructor, "Ada Instructor");
  assert.equal(payload.liveClasses[0].status, "scheduled");
  assert.equal(new Date(payload.liveClasses[0].startsAt).getTime(), startsAt.getTime());
});
