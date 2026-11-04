let tokenProvider: (() => Promise<string | null>) | undefined;
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
export function setTokenProvider(provider?: () => Promise<string | null>) {
  tokenProvider = provider;
}
export async function captureApiToken(): Promise<string | null> {
  return (await tokenProvider?.()) ?? null;
}
export async function apiResponse(
  path: string,
  options: RequestInit = {},
  tokenSnapshot?: string | null,
) {
  const token =
    tokenSnapshot === undefined ? await captureApiToken() : tokenSnapshot;
  const headers = new Headers(options.headers);
  if (options.body) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`/api${path}`, { ...options, headers });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(
      typeof body.message === "string"
        ? body.message
        : `Request failed (${response.status}). Please try again.`,
      response.status,
    );
  }
  return response;
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
  tokenSnapshot?: string | null,
): Promise<T> {
  return (await apiResponse(path, options, tokenSnapshot)).json();
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
