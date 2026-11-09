let csrfToken = "";
export type CurrentUser = {
  id: string;
  role: "HOMEOWNER" | "SALES";
  email: string;
};
export class SessionExpired extends Error {}
export class ApiError extends Error {
  status?: number;
  issues?: Record<string, string[]>;
  workflow?: unknown;
}
export async function api(path: string, options: RequestInit = {}) {
  const method = (options.method ?? "GET").toUpperCase();
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("Content-Type"))
    headers.set("Content-Type", "application/json");
  if (!["GET", "HEAD", "OPTIONS"].includes(method) && csrfToken)
    headers.set("x-csrf-token", csrfToken);
  const response = await fetch("/api" + path, {
    ...options,
    headers,
    credentials: "include",
  });
  if (response.status === 401)
    throw new SessionExpired("Your session has expired. Please sign in again.");
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new ApiError(data?.error || "Request failed");
    error.status = response.status;
    error.issues = data?.issues;
    error.workflow = data?.workflow;
    throw error;
  }
  return data;
}
export async function login(email: string, password: string) {
  const result = await api("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  csrfToken = result.csrfToken;
  return result.user as CurrentUser;
}
export async function restore() {
  const result = await api("/auth/me");
  csrfToken = result.csrfToken;
  return result.user as CurrentUser;
}
export async function logout() {
  await api("/auth/logout", { method: "POST" });
  csrfToken = "";
}
export async function download(path: string) {
  const response = await fetch("/api" + path, { credentials: "include" });
  if (response.status === 401)
    throw new SessionExpired("Your session has expired. Please sign in again.");
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new ApiError(data?.error || "Download failed");
  }
  return response.blob();
}
export async function upload(path: string, file: File) {
  const form = new FormData();
  form.append("bill", file);
  const method = "POST";
  const headers = new Headers();
  if (csrfToken) headers.set("x-csrf-token", csrfToken);
  const response = await fetch("/api" + path, {
    method,
    headers,
    body: form,
    credentials: "include",
  });
  if (response.status === 401)
    throw new SessionExpired("Your session has expired. Please sign in again.");
  const data = await response.json().catch(() => null);
  if (!response.ok) throw Error(data?.error || "Upload failed");
  return data;
}
