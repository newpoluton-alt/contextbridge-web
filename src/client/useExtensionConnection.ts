import { useCallback, useEffect, useRef, useState } from "react";
import { api, captureApiToken, errorMessage, json } from "./api";
import {
  clearExtensionConnectIntent,
  connectInstalledExtension,
  disconnectInstalledExtension,
  hasExtensionConnectIntent,
  installedExtensionStatus,
  type ExtensionConnection,
} from "./extension";

export function useExtensionConnection(accountId: string) {
  const [status, setStatus] = useState<ExtensionConnection | "checking">(
    "checking",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const identity = useRef(accountId);
  identity.current = accountId;
  const previousIdentity = useRef("");
  const pending = useRef<Promise<void> | null>(null);
  const generation = useRef(0);
  const attempted = useRef("");
  const checking = useRef(false);
  const disconnecting = useRef(new Map<string, Promise<void>>());

  const disconnect = useCallback(async (owner: string) => {
    if (!owner) return;
    const existing = disconnecting.current.get(owner);
    if (existing) return existing;
    generation.current += 1;
    const pairing = pending.current;
    if (!identity.current || identity.current === owner) {
      setStatus("disconnected");
      setBusy(false);
    }
    const task = (async () => {
      // Cancel a matching worker exchange immediately. Repeat after a pending
      // bridge response as a backstop for an older installed extension.
      await disconnectInstalledExtension(owner);
      if (pairing) {
        await pairing.catch(() => {});
        await disconnectInstalledExtension(owner);
      }
    })();
    disconnecting.current.set(owner, task);
    try {
      await task;
    } finally {
      disconnecting.current.delete(owner);
    }
  }, []);

  const connect = useCallback(async () => {
    const owner = identity.current;
    if (!owner) return;
    // A quick sign-out/sign-in to the same account must finish its old
    // disconnect before starting another pairing operation.
    const logout = disconnecting.current.get(owner);
    if (logout) {
      await logout;
      if (identity.current !== owner) return;
    }
    const active = pending.current;
    if (active) {
      await active;
      if (pending.current === active) pending.current = null;
      if (identity.current !== owner || pending.current) return;
    }
    const version = ++generation.current;
    const current = () =>
      identity.current === owner && generation.current === version;
    setBusy(true);
    setError("");
    const task = (async () => {
      try {
        const existing = await installedExtensionStatus(owner);
        if (!current()) return;
        if (existing === "connected") {
          setStatus("connected");
          clearExtensionConnectIntent();
          return;
        }
        if (existing === "update_required") {
          setStatus(existing);
          return;
        }
        if (existing === "not_installed") {
          setStatus(existing);
          setError(
            "Open ContextBridge in the browser where the extension is installed, or install it below.",
          );
          return;
        }
        // Capture and verify one identity before creating a single-use code.
        const token = await captureApiToken();
        const user = await api<{ id: string }>("/me", {}, token);
        if (!current() || user.id !== owner) return;
        const code = await api<{ code: string }>(
          "/extension/pair",
          json({}),
          token,
        );
        if (!current()) return;
        const result = await connectInstalledExtension(code.code, owner);
        if (!current()) return;
        setStatus(result);
        if (result === "connected") clearExtensionConnectIntent();
        if (result === "unavailable")
          setError(
            "We couldn’t reach the extension. Open it in this browser and choose Connect account to try again.",
          );
      } catch (err) {
        if (current()) setError(errorMessage(err));
      } finally {
        if (current()) setBusy(false);
      }
    })();
    pending.current = task;
    try {
      await task;
    } finally {
      if (pending.current === task) pending.current = null;
    }
  }, []);

  const refresh = useCallback(async () => {
    const owner = identity.current;
    if (!owner || pending.current || checking.current) return;
    const version = generation.current;
    checking.current = true;
    try {
      const result = await installedExtensionStatus(owner);
      if (
        identity.current !== owner ||
        generation.current !== version ||
        pending.current
      )
        return;
      setStatus(result);
      if (result === "connected") {
        clearExtensionConnectIntent();
        setError("");
      }
    } finally {
      checking.current = false;
    }
  }, []);

  useEffect(() => {
    const previous = previousIdentity.current;
    previousIdentity.current = accountId;
    setError("");
    setBusy(false);
    setStatus(accountId ? "checking" : "disconnected");
    if (previous && previous !== accountId) void disconnect(previous);
    if (!accountId) {
      attempted.current = "";
      return;
    }
    const sync = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    sync();
    const interval = window.setInterval(sync, 10000);
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [accountId, disconnect, refresh]);

  useEffect(() => {
    if (
      !accountId ||
      !hasExtensionConnectIntent() ||
      attempted.current === accountId
    )
      return;
    attempted.current = accountId;
    window.location.hash = "settings";
    void connect();
  }, [accountId, connect]);

  return { status, busy, error, connect, disconnect };
}
export type ExtensionState = ReturnType<typeof useExtensionConnection>;
