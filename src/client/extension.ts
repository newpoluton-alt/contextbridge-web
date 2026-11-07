const EXTENSION_ID = "dfpafpdmlhafhpknaijeeelhdpbkiogk";

export type ExtensionConnection =
  | "connected"
  | "disconnected"
  | "permission_required"
  | "unavailable"
  | "not_installed"
  | "update_required";
type BridgeMessage =
  | { type: "CB_PAIR"; code: string; accountId: string }
  | { type: "CB_STATUS" | "CB_DISCONNECT"; accountId: string };
interface RuntimeBridge {
  lastError?: { message?: string };
  sendMessage(
    extensionId: string,
    message: BridgeMessage,
    callback: (response?: {
      ok?: boolean;
      status?: string;
      error?: string;
    }) => void,
  ): void;
}

async function send(message: BridgeMessage): Promise<ExtensionConnection> {
  const runtime = (window as Window & { chrome?: { runtime?: RuntimeBridge } })
    .chrome?.runtime;
  if (!runtime?.sendMessage) return "not_installed";
  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => resolve("unavailable"), 25000);
    try {
      // The bridge never exposes account credentials. Pairing sends only a
      // single-use code; status and logout are scoped to the website account.
      runtime.sendMessage(EXTENSION_ID, message, (response) => {
        window.clearTimeout(timeout);
        if (runtime.lastError || !response) resolve("not_installed");
        else if (
          !response.ok &&
          response.error === "Unsupported connection request."
        )
          resolve("update_required");
        else if (!response.ok) resolve("unavailable");
        else if (
          response.status === "permission_required" ||
          response.status === "connected" ||
          response.status === "disconnected"
        )
          resolve(response.status);
        else resolve("unavailable");
      });
    } catch {
      window.clearTimeout(timeout);
      resolve("unavailable");
    }
  });
}
export function connectInstalledExtension(code: string, accountId: string) {
  return send({ type: "CB_PAIR", code, accountId });
}
export function installedExtensionStatus(accountId: string) {
  return send({ type: "CB_STATUS", accountId });
}
export function disconnectInstalledExtension(accountId: string) {
  return send({ type: "CB_DISCONNECT", accountId });
}
export function hasExtensionConnectIntent() {
  return (
    new URLSearchParams(window.location.search).get("connect") === "extension"
  );
}
export function clearExtensionConnectIntent() {
  const url = new URL(window.location.href);
  url.searchParams.delete("connect");
  window.history.replaceState(window.history.state, "", url);
}

const lastAccountKey = "contextbridge:last-account";
export function lastKnownAccount() {
  try {
    return window.localStorage.getItem(lastAccountKey) || "";
  } catch {
    return "";
  }
}
export function rememberAccount(accountId: string) {
  try {
    window.localStorage.setItem(lastAccountKey, accountId);
  } catch {
    /* Storage may be disabled; live account state still works. */
  }
}
