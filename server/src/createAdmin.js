import "dotenv/config";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { connectToDatabase } from "./config/database.js";
import { User } from "./models/User.js";

async function createAdmin() {
  const { INITIAL_ADMIN_EMAIL, INITIAL_ADMIN_PASSWORD, INITIAL_ADMIN_NAME = "LMS Administrator" } = process.env;
  if (!INITIAL_ADMIN_EMAIL || !INITIAL_ADMIN_PASSWORD || INITIAL_ADMIN_PASSWORD.length < 12) {
    throw new Error("Set INITIAL_ADMIN_EMAIL and an INITIAL_ADMIN_PASSWORD of at least 12 characters.");
  }
  await connectToDatabase();
  const email = INITIAL_ADMIN_EMAIL.trim().toLowerCase();
  const user = await User.findOne({ email }).select("+passwordHash");
  if (user) {
    if (!user.roles.includes("admin")) user.roles.push("admin");
    await user.save();
    console.info(`Administrator role granted to ${email}.`);
    return;
  }
  await User.create({
    name: INITIAL_ADMIN_NAME,
    email,
    passwordHash: await bcrypt.hash(INITIAL_ADMIN_PASSWORD, 12),
    roles: ["admin"],
  });
  console.info(`Administrator account created for ${email}.`);
}

try {
  await createAdmin();
} catch (error) {
  console.error("Unable to create administrator account:", error);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
