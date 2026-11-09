import { db } from "./repository.js";
import { isDatabaseUnavailable } from "./db-errors.js";

try {
  await db.$queryRawUnsafe("SELECT 1 AS connected");
  console.log("API Prisma SELECT 1 succeeded");
} catch (error) {
  if (isDatabaseUnavailable(error)) {
    console.log("API Prisma SELECT 1 could not reach the database");
    process.exitCode = 2;
  } else {
    throw error;
  }
} finally {
  await db.$disconnect();
}
