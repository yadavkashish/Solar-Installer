import { describe, expect, it } from "vitest";
import {
  databaseUnavailableResponse,
  isDatabaseUnavailable,
} from "./db-errors.js";

describe("database-unavailable handling", () => {
  it("recognises Prisma initialization failures and maps them to a safe 503", () => {
    const failure = { name: "PrismaClientInitializationError" };
    expect(isDatabaseUnavailable(failure)).toBe(true);
    expect(databaseUnavailableResponse(failure)).toEqual({
      status: 503,
      body: {
        error: "Database is temporarily unavailable. Please try again shortly.",
      },
    });
  });
  it("does not mistake invalid credentials for database unavailability", () => {
    expect(isDatabaseUnavailable({ code: "P2002" })).toBe(false);
  });
});
