import cors from "cors";
import express from "express";
import helmet from "helmet";
import mongoose from "mongoose";
import { mediaDirectory } from "./config/mediaStorage.js";
import authRouter from "./routes/auth.js";
import certificatesRouter from "./routes/certificates.js";
import coursesRouter from "./routes/courses.js";
import dashboardRouter from "./routes/dashboard.js";
import instructorRouter from "./routes/instructor.js";
import lessonsRouter from "./routes/lessons.js";
import liveClassesRouter from "./routes/liveClasses.js";
import paymentsRouter from "./routes/payments.js";
import quizzesRouter from "./routes/quizzes.js";

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173" }));
app.use(express.json({
  limit: "1mb",
  verify(request, response, buffer) {
    request.rawBody = Buffer.from(buffer);
  },
}));
if (!process.env.AWS_S3_BUCKET) app.use("/media", express.static(mediaDirectory, {
  fallthrough: false,
  maxAge: "1y",
  setHeaders(response, filePath) {
    if (filePath.endsWith(".m3u8")) response.setHeader("Cache-Control", "public, max-age=60");
  },
}));
app.get("/", (request, response) => {
  response.json({
    service: "LMS API",
    status: "ok",
    database: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    endpoints: {
      auth: "POST /api/auth/register, POST /api/auth/login",
      courses: "GET /api/courses",
      dashboard: "GET /api/dashboard",
    },
  });
});
app.use("/api", authRouter);
app.use("/api", coursesRouter);
app.use("/api", lessonsRouter);
app.use("/api", quizzesRouter);
app.use("/api", liveClassesRouter);
app.use("/api", certificatesRouter);
app.use("/api", paymentsRouter);
app.use("/api", instructorRouter);
app.use("/api", dashboardRouter);
app.use("/api", (request, response) => {
  response.status(404).json({ error: "API endpoint not found." });
});
app.use((request, response) => {
  response.status(404).json({
    error: "Route not found.",
    dashboardEndpoint: "GET /api/dashboard",
  });
});

app.use((error, request, response, next) => {
  console.error("API request failed:", error);
  if (response.headersSent) {
    next(error);
    return;
  }
  if (error.status === 404) {
    response.status(404).json({ error: "Requested resource was not found." });
    return;
  }
  if (error.name === "MulterError") {
    response.status(error.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({ error: error.message });
    return;
  }
  if (error.status === 415) {
    response.status(415).json({ error: error.message });
    return;
  }
  if (error.name === "ValidationError" || error.name === "CastError") {
    response.status(400).json({ error: error.message });
    return;
  }
  response.status(500).json({ error: "Unable to process this API request." });
});

export default app;
