import { describe, expect, it } from "vitest";
import { leadPath, parseRoute } from "../../web/src/routes.js";

describe("lead URL routing", () => {
  it("restores each supported lead tab from a direct URL", () => {
    expect(parseRoute("/leads/LD-30915")).toMatchObject({
      kind: "lead",
      tab: "overview",
    });
    expect(parseRoute("/leads/LD-30915/bill")).toMatchObject({
      kind: "lead",
      tab: "bill",
    });
    expect(parseRoute("/leads/LD-30915/quote")).toMatchObject({
      kind: "lead",
      tab: "quote",
    });
    expect(parseRoute("/leads/LD-30915/project")).toMatchObject({
      kind: "lead",
      tab: "project",
    });
    expect(parseRoute("/leads/LD-30915/overview")).toMatchObject({
      kind: "lead",
      tab: "overview",
    });
    expect(parseRoute("/leads/LD-30915/bill-review")).toMatchObject({
      kind: "lead",
      tab: "bill",
    });
  });
  it("round-trips a URL-safe lead id and rejects unknown paths", () => {
    expect(parseRoute(leadPath("LD 30915", "quote"))).toMatchObject({
      id: "LD 30915",
      tab: "quote",
    });
    expect(parseRoute("/leads/LD-30915/unknown")).toMatchObject({
      kind: "notFound",
    });
  });
});
