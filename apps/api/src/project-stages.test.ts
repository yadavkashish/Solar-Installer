import { describe, expect, it } from "vitest";
import { projectWorkflow, stageTransitionDecision } from "./project-stages.js";

describe("project stage workflow", () => {
  it("allows the first recorded advance only after a quote exists", () => {
    expect(
      projectWorkflow({ currentStageId: null, hasQuote: true, hasSurvey: false })
        .allowedNextTransitions[0]?.id,
    ).toBe("ADVANCE_RECORDED");
    expect(
      projectWorkflow({ currentStageId: null, hasQuote: false, hasSurvey: false })
        .unmetPrerequisites[0]?.code,
    ).toBe("QUOTE_REQUIRED");
  });

  it("blocks survey completion until survey findings are saved", () => {
    expect(
      projectWorkflow({
        currentStageId: "ADVANCE_RECORDED",
        hasQuote: true,
        hasSurvey: false,
      }).unmetPrerequisites[0]?.code,
    ).toBe("SURVEY_REQUIRED");
  });

  it("rejects stale requests without permitting another event", () => {
    const decision = stageTransitionDecision({
      currentStageId: "SITE_SURVEY_COMPLETE",
      expectedStageId: "ADVANCE_RECORDED",
      nextStageId: "INSTALLATION_SCHEDULED",
      hasQuote: true,
      hasSurvey: true,
    });
    expect(decision).toMatchObject({ ok: false, stale: true });
  });

  it("returns no next action at the final stage", () => {
    const workflow = projectWorkflow({
      currentStageId: "SUBSIDY_CREDITED",
      hasQuote: true,
      hasSurvey: true,
    });
    expect(workflow.isFinal).toBe(true);
    expect(workflow.allowedNextTransitions).toEqual([]);
  });
});
