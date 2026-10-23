import jwt from "jsonwebtoken";
import { User } from "../models/User.js";

export async function optionalAuth(request, response, next) {
  const token = request.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token || !process.env.JWT_SECRET) {
    next();
    return;
  }
  try {
    const claims = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(claims.sub).select("name email roles status instructorProfile");
    if (user?.status === "active") request.user = user;
    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
      next();
      return;
    }
    next(error);
  }
}

export async function requireAuth(request, response, next) {
  const token = request.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) {
    response.status(401).json({ error: "Authentication is required." });
    return;
  }
  if (!process.env.JWT_SECRET) {
    response.status(503).json({ error: "Authentication is not configured on this server." });
    return;
  }

  try {
    const claims = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(claims.sub).select("name email roles status instructorProfile");
    if (!user || user.status !== "active") {
      response.status(401).json({ error: "This account is not available." });
      return;
    }
    request.user = user;
    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
      response.status(401).json({ error: "The authentication token is invalid or expired." });
      return;
    }
    next(error);
  }
}

export function requireRole(...roles) {
  return (request, response, next) => {
    if (!request.user?.roles.some((role) => roles.includes(role))) {
      response.status(403).json({ error: "You do not have permission to perform this action." });
      return;
    }
    next();
  };
}
