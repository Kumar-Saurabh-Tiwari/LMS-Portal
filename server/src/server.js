import "dotenv/config";
import app from "./app.js";
import { connectToDatabase } from "./config/database.js";

const port = Number(process.env.PORT ?? 5000);

try {
  await connectToDatabase();
  app.listen(port, () => {
    console.log(`LMS API server listening on port ${port}.`);
  });
} catch (error) {
  console.error("Failed to start the LMS API server:", error);
  process.exitCode = 1;
}
