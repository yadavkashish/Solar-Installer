export type ExtractionWhere = {
  id: string;
  status: "EXTRACTING";
  extractionAttempt: number;
};

export async function updateExtractionIfCurrent(
  update: (where: ExtractionWhere) => Promise<{ count: number }>,
  where: ExtractionWhere,
) {
  return (await update(where)).count === 1;
}
