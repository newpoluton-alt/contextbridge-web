import { strict as assert } from "node:assert";
import { once } from "node:events";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import {
  createClient,
  getSignInSession,
  getWorkspaceToken,
} from "../src/client/auth.js";

test("verified login reads the current session and requests a workspace JWT even when the Neon SDK has cached a session", async (t) => {
  const paths: string[] = [];
  let userId = "first-reader";
  const server = createServer((req, res) => {
    paths.push(req.url!);
    res.setHeader("content-type", "application/json");
    if (req.url === "/auth/token") {
      res.end(JSON.stringify({ token: "workspace-token-fixture" }));
    } else if (req.url === "/auth/get-session") {
      res.end(
        JSON.stringify({
          session: { id: "session-fixture", token: "opaque-session-fixture" },
          user: { id: userId, emailVerified: true },
        }),
      );
    } else {
      res.writeHead(404).end();
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
  const client = createClient(
    `http://127.0.0.1:${(server.address() as AddressInfo).port}/auth`,
  );

  // Populate the real adapter's cache, then model a different successful login.
  assert.equal((await client.getSession()).data?.user.id, "first-reader");
  userId = "verified-reader";
  assert.equal((await getSignInSession(client)).data?.user.id, userId);
  assert.equal(
    (await getWorkspaceToken(client)).data?.token,
    "workspace-token-fixture",
  );
  assert.deepEqual(paths, [
    "/auth/get-session",
    "/auth/get-session",
    "/auth/token",
  ]);
});
