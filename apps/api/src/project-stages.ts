export const PROJECT_STAGES = [
  { id: "ADVANCE_RECORDED", label: "Advance recorded (demo)" },
  { id: "SITE_SURVEY_COMPLETE", label: "Site survey complete" },
  { id: "INSTALLATION_SCHEDULED", label: "Installation scheduled" },
  { id: "INSTALLED", label: "Installed" },
  { id: "NET_METERING_SUBMITTED", label: "Net-metering submitted" },
  { id: "COMMISSIONED", label: "Commissioned" },
  { id: "SUBSIDY_CREDITED", label: "Subsidy credited" },
] as const;

export type ProjectStageId = (typeof PROJECT_STAGES)[number]["id"];

const legacyStageIds: Record<string, ProjectStageId> = Object.fromEntries(
  PROJECT_STAGES.map((stage) => [stage.label, stage.id]),
) as Record<string, ProjectStageId>;

export function normaliseStageId(stage: string | null | undefined) {
  if (!stage || stage === "NOT_STARTED") return null;
  if (PROJECT_STAGES.some((item) => item.id === stage)) return stage as ProjectStageId;
  return legacyStageIds[stage] ?? null;
}

export function stageLabel(stage: string | null | undefined) {
  const id = normaliseStageId(stage);
  return id ? PROJECT_STAGES.find((item) => item.id === id)!.label : null;
}

export function projectWorkflow(input: {
  currentStageId: string | null | undefined;
  hasQuote: boolean;
  hasSurvey: boolean;
}) {
  const currentStageId = normaliseStageId(input.currentStageId);
  const currentIndex = currentStageId
    ? PROJECT_STAGES.findIndex((stage) => stage.id === currentStageId)
    : -1;
  const candidate = PROJECT_STAGES[currentIndex + 1] ?? null;
  const unmetPrerequisites: { code: string; message: string; action: "QUOTE" | "SURVEY" }[] = [];
  if (candidate?.id === "ADVANCE_RECORDED" && !input.hasQuote)
    unmetPrerequisites.push({
      code: "QUOTE_REQUIRED",
      message: "Issue a post-survey quote before recording the advance.",
      action: "QUOTE",
    });
  if (candidate?.id === "SITE_SURVEY_COMPLETE" && !input.hasSurvey)
    unmetPrerequisites.push({
      code: "SURVEY_REQUIRED",
      message: "Save usable roof area in the sales survey before marking it complete.",
      action: "SURVEY",
    });
  return {
    currentStage: currentStageId
      ? { id: currentStageId, label: stageLabel(currentStageId)! }
      : null,
    allowedNextTransitions:
      candidate && unmetPrerequisites.length === 0 ? [candidate] : [],
    unmetPrerequisites,
    isFinal: candidate === null,
  };
}

export function stageTransitionDecision(input: {
  currentStageId: string | null | undefined;
  expectedStageId: string | null;
  nextStageId: string;
  hasQuote: boolean;
  hasSurvey: boolean;
}) {
  const workflow = projectWorkflow(input);
  const currentStageId = normaliseStageId(input.currentStageId);
  if (currentStageId !== input.expectedStageId)
    return {
      ok: false as const,
      stale: true,
      message: "Project stage changed elsewhere. Refresh and try the currently allowed action.",
      workflow,
    };
  if (!workflow.allowedNextTransitions.some((stage) => stage.id === input.nextStageId))
    return {
      ok: false as const,
      stale: false,
      message:
        workflow.unmetPrerequisites[0]?.message ??
        (workflow.isFinal
          ? "This project is already at its final stage."
          : "That stage is not the next allowed transition."),
      workflow,
    };
  return { ok: true as const, workflow };
}
