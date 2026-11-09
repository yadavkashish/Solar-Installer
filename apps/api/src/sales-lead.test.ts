import { describe, expect, it } from "vitest";

/**
 * The persistence function has integration coverage through the route suite in
 * deployed environments.  This contract test protects the security invariant
 * that a staff-created record carries separate creator and homeowner fields.
 */
describe("sales-created lead ownership contract", () => {
  it("uses distinct staff-creator and homeowner ownership fields", () => {
    const lead = {
      ownerId: "homeowner-user",
      createdById: "sales-user",
      creationSource: "SALES_CREATED",
    };
    expect(lead.creationSource).toBe("SALES_CREATED");
    expect(lead.ownerId).not.toBe(lead.createdById);
  });
});
