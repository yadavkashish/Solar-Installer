export function isDatabaseUnavailable(error: unknown) {
  const candidate = error as { name?: string; code?: string } | undefined;
  return (
    candidate?.name === "PrismaClientInitializationError" ||
    ["P1001", "P1002", "P1008", "P1017"].includes(candidate?.code ?? "")
  );
}

export function databaseUnavailableResponse(error: unknown) {
  return isDatabaseUnavailable(error)
    ? {
        status: 503,
        body: {
          error:
            "Database is temporarily unavailable. Please try again shortly.",
        },
      }
    : null;
}
