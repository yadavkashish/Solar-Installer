import crypto from "node:crypto";
import { normaliseStageId, stageLabel } from "./project-stages.js";

export const createStatusToken = () =>
  crypto.randomBytes(32).toString("base64url");
export const hashStatusToken = (token: string) =>
  crypto.createHash("sha256").update(token).digest("hex");

export function isActiveStatusToken(
  token: { expiresAt: Date; revokedAt: Date | null },
  now = new Date(),
) {
  return !token.revokedAt && token.expiresAt > now;
}

export function customerStatus(project: {
  stage: string;
  events: { stage: string; createdAt: Date }[];
}) {
  return {
    stage: stageLabel(project.stage) ?? "Project not started",
    stageId: normaliseStageId(project.stage),
    timeline: project.events.map((event) => ({
      stage: stageLabel(event.stage) ?? event.stage,
      stageId: normaliseStageId(event.stage),
      createdAt: event.createdAt,
    })),
  };
}
