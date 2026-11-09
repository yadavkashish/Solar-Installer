export type LeadTab = "overview" | "bill" | "quote" | "project";
export type Route =
  | { kind: "leads" }
  | { kind: "new" }
  | { kind: "lead"; id: string; tab: LeadTab }
  | { kind: "customerStatus"; token: string }
  | { kind: "notFound" };

const tabFromPath: Record<string, LeadTab> = {
  overview: "overview",
  bill: "bill",
  "bill-review": "bill",
  quote: "quote",
  project: "project",
};

export function parseRoute(pathname: string): Route {
  const parts = pathname.replace(/\/+$/, "").split("/").filter(Boolean);
  if (parts[0] === "customer-status" && parts.length === 2)
    return { kind: "customerStatus", token: parts[1] };
  if (!parts.length || (parts.length === 1 && parts[0] === "leads"))
    return { kind: "leads" };
  if (parts[0] !== "leads") return { kind: "notFound" };
  if (parts[1] === "new" && parts.length === 2) return { kind: "new" };
  if (parts.length === 2)
    return { kind: "lead", id: decodeURIComponent(parts[1]), tab: "overview" };
  if (parts.length === 3 && tabFromPath[parts[2]])
    return {
      kind: "lead",
      id: decodeURIComponent(parts[1]),
      tab: tabFromPath[parts[2]],
    };
  return { kind: "notFound" };
}

export const leadPath = (id: string, tab: LeadTab = "overview") =>
  `/leads/${encodeURIComponent(id)}${tab === "overview" ? "" : "/" + tab}`;
