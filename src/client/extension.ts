const EXTENSION_ID = "dfpafpdmlhafhpknaijeeelhdpbkiogk";

export type ExtensionConnection =
  "connected" | "permission_required" | "unavailable";
interface RuntimeBridge {
  lastError?: { message?: string };
  sendMessage(
    extensionId: string,
    message: { type: "CB_PAIR"; code: string },
    callback: (response?: {
      ok?: boolean;
      status?: string;
      error?: string;
    }) => void,
  ): void;
}

export async function connectInstalledExtension(
  code: string,
): Promise<ExtensionConnection> {
  const runtime = (window as Window & { chrome?: { runtime?: RuntimeBridge } })
    .chrome?.runtime;
  if (!runtime?.sendMessage) return "unavailable";
  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => resolve("unavailable"), 10000);
    try {
      // Only the short-lived pairing code crosses this bridge. The extension
      // checks the sender origin and exchanges it at its fixed backend itself.
      runtime.sendMessage(
        EXTENSION_ID,
        { type: "CB_PAIR", code },
        (response) => {
          window.clearTimeout(timeout);
          if (runtime.lastError || !response?.ok) resolve("unavailable");
          else if (response.status === "permission_required")
            resolve("permission_required");
          else if (response.status === "connected") resolve("connected");
          else resolve("unavailable");
        },
      );
    } catch {
      window.clearTimeout(timeout);
      resolve("unavailable");
    }
  });
}
