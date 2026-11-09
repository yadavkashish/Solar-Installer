import { describe, expect, it } from "vitest";
import { updateExtractionIfCurrent } from "./bill-extraction.js";

describe("bill extraction compare-and-swap", () => {
  it("does not overwrite a bill confirmed while extraction was in flight", async () => {
    const row = { status: "CONFIRMED", extractionAttempt: 8 };
    const saved = await updateExtractionIfCurrent(
      async (where) => {
        expect(where).toEqual({
          id: "document-1",
          status: "EXTRACTING",
          extractionAttempt: 7,
        });
        if (
          row.status !== where.status ||
          row.extractionAttempt !== where.extractionAttempt
        )
          return { count: 0 };
        row.status = "EXTRACTED";
        return { count: 1 };
      },
      {
        id: "document-1",
        status: "EXTRACTING",
        extractionAttempt: 7,
      },
    );

    expect(saved).toBe(false);
    expect(row).toEqual({ status: "CONFIRMED", extractionAttempt: 8 });
  });
});
