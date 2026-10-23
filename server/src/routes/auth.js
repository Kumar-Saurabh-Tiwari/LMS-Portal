import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

function createToken(user) {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET must be configured.");
  return jwt.sign({ sub: String(user._id) }, process.env.JWT_SECRET, { expiresIn: "12h" });
}

router.post("/auth/register", async (request, response, next) => {
  try {
    if (!process.env.JWT_SECRET) {
      response.status(503).json({ error: "Authentication is not configured on this server." });
      return;
    }
    const { name, email, password } = request.body;
    if (typeof name !== "string" || !name.trim() || typeof email !== "string" ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        typeof password !== "string" || password.length < 12) {
      response.status(400).json({ error: "Provide a name, valid email, and password of at least 12 characters." });
      return;
    }
    const user = await User.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      passwordHash: await bcrypt.hash(password, 12),
      roles: ["student"],
    });
    response.status(201).json({ token: createToken(user), user: user.toJSON() });
  } catch (error) {
    if (error.code === 11000) {
      response.status(409).json({ error: "An account with that email already exists." });
      return;
    }
    next(error);
  }
});

router.post("/auth/login", async (request, response, next) => {
  try {
    if (!process.env.JWT_SECRET) {
      response.status(503).json({ error: "Authentication is not configured on this server." });
      return;
    }
    const { email, password } = request.body;
    if (typeof email !== "string" || typeof password !== "string") {
      response.status(400).json({ error: "Email and password are required." });
      return;
    }
    const user = await User.findOne({ email: email.trim().toLowerCase() }).select("+passwordHash");
    if (!user || user.status !== "active" || !(await bcrypt.compare(password, user.passwordHash))) {
      response.status(401).json({ error: "Email or password is incorrect." });
      return;
    }
    response.json({ token: createToken(user), user: user.toJSON() });
  } catch (error) {
    next(error);
  }
});

router.get("/auth/me", requireAuth, (request, response) => {
  response.json({ user: request.user.toJSON() });
});

export default router;
