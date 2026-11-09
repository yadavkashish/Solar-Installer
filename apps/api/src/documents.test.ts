import { describe, expect, it, vi } from "vitest";
import { persistUploadedDocument, validateDocument } from "./documents.js";

describe("bill document validation", () => {
  it("accepts JPEG and PNG signatures", () => {
    expect(() => validateDocument(Buffer.from([0xff, 0xd8, 0xff]), "image/jpeg")).not.toThrow();
    expect(() => validateDocument(Buffer.from([0x89, 0x50, 0x4e, 0x47]), "image/png")).not.toThrow();
  });

  describe("uploaded document persistence", () => {
    it("deletes a Cloudinary asset when database metadata cannot be saved", async () => {
      const cleanup = vi.fn(async () => {});

      await expect(
        persistUploadedDocument(
          async () => {
            throw new Error("database write failed");
          },
          cleanup,
          () => {},
        ),
      ).rejects.toThrow("database write failed");

      expect(cleanup).toHaveBeenCalledOnce();
    });

    it("preserves the database error and reports a failed orphan cleanup", async () => {
      const cleanupError = new Error("Cloudinary delete failed");
      const report = vi.fn();

      await expect(
        persistUploadedDocument(
          async () => {
            throw new Error("database write failed");
          },
          async () => {
            throw cleanupError;
          },
          report,
        ),
      ).rejects.toThrow("database write failed");

      expect(report).toHaveBeenCalledWith(cleanupError);
    });
  });

  it("rejects PDFs before private upload because extraction is image-only", () => {
    expect(() => validateDocument(Buffer.from("%PDF"), "application/pdf")).toThrow("Only JPEG and PNG");
  });
});
