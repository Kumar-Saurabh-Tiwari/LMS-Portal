import cors from "cors";
import express from "express";
import helmet from "helmet";
import mongoose from "mongoose";
import dashboardRouter from "./routes/dashboard.js";

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173" }));
app.use(express.json({ limit: "1mb" }));
app.get("/", (request, response) => {
  response.json({
    service: "LMS API",
    status: "ok",
    database: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    endpoints: { dashboard: "GET /api/dashboard" },
  });
});
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
  response.status(500).json({ error: "Unable to load dashboard data." });
});

export default app;
