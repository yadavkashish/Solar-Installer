import crypto from "node:crypto";

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
    stage: project.stage,
    timeline: project.events.map((event) => ({
      stage: event.stage,
      createdAt: event.createdAt,
    })),
  };
}
