import { afterEach, describe, expect, it, vi } from "vitest";
import { assessQualification } from "./qualification.js";

const input = {
  ownerType: "TENANT",
  roofType: "RCC",
  roofArea: 50,
  tariff: "Residential",
  monthlyUnits: 350,
  monthlyBill: 3200,
};
const baseline = {
  points: 45,
  band: "MEDIUM",
  reasons: ["Tenant"],
  nextAction: "Short sales call",
};

afterEach(() => {
  delete process.env.GROQ_API_KEY;
  vi.unstubAllGlobals();
});

describe("Groq qualification assessment", () => {
  it("uses non-identifying inputs and preserves short-call guardrails", async () => {
    process.env.GROQ_API_KEY = "test-key";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  score: 82,
                  reasons: ["Good roof area"],
                  nextAction: "Book a roof survey",
                }),
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await assessQualification(input, baseline);
    expect(result.score).toBe(82);
    expect(result.nextAction).toBe("Short sales call");
    const request = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(JSON.stringify(request)).not.toContain("consumerNumber");
  });

  it("fails rather than inventing an assessment without credentials", async () => {
    await expect(assessQualification(input, baseline)).rejects.toThrow(
      "GROQ_API_KEY is not configured",
    );
  });
});
