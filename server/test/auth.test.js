import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import app from "../src/app.js";

test("protected course and admin routes reject unauthenticated requests", async (context) => {
  const originalSecret = process.env.JWT_SECRET;
  delete process.env.JWT_SECRET;
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(async () => {
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });

  const { port } = server.address();
  const courseResponse = await fetch(`http://127.0.0.1:${port}/api/courses`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title: "Unauthorized", description: "Must be rejected" }),
  });
  const adminResponse = await fetch(`http://127.0.0.1:${port}/api/admin/users/not-an-id/roles`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ roles: ["admin"] }),
  });
  const registrationResponse = await fetch(`http://127.0.0.1:${port}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Test Student", email: "student@example.test", password: "long-enough-password" }),
  });

  assert.equal(courseResponse.status, 401);
  assert.equal(adminResponse.status, 401);
  assert.equal(registrationResponse.status, 503);
});
