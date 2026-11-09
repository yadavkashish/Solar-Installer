import { afterEach, describe, expect, it, vi } from "vitest";
import { extractBill } from "./groq.js";

const valid = {
  consumerNumber: "001234567890",
  tariff: "LT-I Residential",
  sanctionedLoad: 3,
  sanctionedLoadUnit: "kW",
  monthlyUnits: 340,
  monthlyBill: 3200,
  billingPeriod: null,
  unreadable: false,
  notes: [],
};

const providerResponse = (content: unknown) =>
  new Response(
    JSON.stringify({
      choices: [{ message: { content: JSON.stringify(content) } }],
    }),
    { status: 200 },
  );

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.GROQ_API_KEY;
});

describe("Groq repair", () => {
  it("uses one repair response when the initial contract is invalid", async () => {
    process.env.GROQ_API_KEY = "test-key";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        providerResponse({ ...valid, unreadable: [false] }),
      )
      .mockResolvedValueOnce(
        providerResponse({ ...valid, notes: "Read from image" }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      extractBill(Buffer.from("image"), "image/png"),
    ).resolves.toMatchObject({
      notes: ["Read from image"],
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("fails safely when the single repair result remains invalid", async () => {
    process.env.GROQ_API_KEY = "test-key";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        providerResponse({ ...valid, unreadable: [false] }),
      )
      .mockResolvedValueOnce(
        providerResponse({ ...valid, unreadable: ["false"] }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      extractBill(Buffer.from("image"), "image/png"),
    ).rejects.toThrow("AI response did not match the bill-review format");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
