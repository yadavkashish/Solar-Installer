import { billExtractionSchema } from "./bill-schema.js";
import {
  billExtractionJsonSchema,
  billExtractionPrompt,
  contractIssues,
  validatedProviderExtraction,
} from "./groq-contract.js";
export const billExtraction = billExtractionSchema;
export type BillExtraction = import("./bill-schema.js").BillExtraction;

const endpoint = "https://api.groq.com/openai/v1/chat/completions";

async function completion(key: string, body: object) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(30_000),
    body: JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok)
    throw Error(`AI unavailable (${response.status}). Use manual entry.`);
  try {
    return JSON.parse(text);
  } catch {
    throw Error(
      "AI returned an invalid response. Retry extraction or use manual entry.",
    );
  }
}

function responseContent(body: any) {
  const content = body.choices?.[0]?.message?.content;
  if (typeof content !== "string")
    throw Error(
      "AI returned no bill details. Retry extraction or use manual entry.",
    );
  try {
    return JSON.parse(content);
  } catch {
    throw Error(
      "AI returned malformed bill details. Retry extraction or use manual entry.",
    );
  }
}
export async function extractBill(
  buffer: Buffer,
  mime: string,
): Promise<BillExtraction> {
  const key = process.env.GROQ_API_KEY;
  if (!key)
    throw Error(
      "AI unavailable: GROQ_API_KEY is not configured. Use manual entry.",
    );
  if (mime === "application/pdf")
    throw Error(
      "PDF extraction is not implemented. Upload JPEG/PNG or use manual entry.",
    );
  const image = `data:${mime};base64,${buffer.toString("base64")}`;
  const model = process.env.GROQ_VISION_MODEL || "qwen/qwen3.8-27b";
  const base = {
    model,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: billExtractionPrompt },
          { type: "image_url", image_url: { url: image } },
        ],
      },
    ],
  };
  let response: any;
  try {
    response = await completion(key, {
      ...base,
      response_format: {
        type: "json_schema",
        json_schema: billExtractionJsonSchema,
      },
    });
  } catch (error: any) {
    if (!/\b(400|422)\b/.test(error?.message || "")) throw error;
    response = await completion(key, {
      ...base,
      response_format: { type: "json_object" },
    });
  }
  const candidate = responseContent(response);
  const issues = contractIssues(candidate);
  if (!issues.length) return validatedProviderExtraction(candidate);
  const repaired = await completion(key, {
    model,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "user",
        content: `Return corrected JSON only. The candidate failed these schema checks: ${issues.join("; ")}. Preserve values only when present; use null for unknown fields. Required schema: ${billExtractionPrompt}\nCandidate JSON: ${JSON.stringify(candidate)}`,
      },
    ],
  });
  return validatedProviderExtraction(responseContent(repaired));
}
