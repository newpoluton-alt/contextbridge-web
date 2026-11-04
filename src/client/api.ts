let tokenProvider: (() => Promise<string | null>) | undefined;
export function setTokenProvider(provider?: () => Promise<string | null>) {
  tokenProvider = provider;
}
export async function apiResponse(path: string, options: RequestInit = {}) {
  const token = await tokenProvider?.();
  const headers = new Headers(options.headers);
  if (options.body) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`/api${path}`, { ...options, headers });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(
      typeof body.message === "string"
        ? body.message
        : `Request failed (${response.status}). Please try again.`,
    );
  }
  return response;
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  return (await apiResponse(path, options)).json();
}
export const json = (body: unknown, method = "POST"): RequestInit => ({
  method,
  body: JSON.stringify(body),
});
export function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}
export async function downloadAnki() {
  const blob = await (await apiResponse("/export")).blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "contextbridge-anki.tsv";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
