import { createServer } from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { readFile, writeFile, chmod } from "node:fs/promises";
import { spawn } from "node:child_process";
const token = randomBytes(32).toString("hex");
const envFile = new URL("../.env", import.meta.url);
let address = "";
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>ContextBridge · private key setup</title><style>body{font:17px system-ui;background:#f7f6ef;color:#202921;max-width:540px;margin:12vh auto;padding:28px}h1{font-size:32px}input,button{font:inherit;box-sizing:border-box;width:100%;padding:15px;border:1px solid #a1a99c;border-radius:10px;margin-top:16px}button{background:#263b2c;color:white;cursor:pointer}small{display:block;line-height:1.6;color:#59665a}</style><h1>Connect your OpenAI key</h1><p>This form runs on your computer. Your key is saved only in <b>web/.env</b> and is never sent through chat or included in the extension.</p><form method="POST" action="/save"><input type="hidden" name="csrf" value="${token}"><label for="key">OpenAI API key</label><input id="key" type="password" name="key" autocomplete="off" required minlength="20" placeholder="sk-…"><button>Save key privately</button></form><small>Restart the local app after saving. When you deploy, the deployment helper can transfer this saved key to Vercel.</small></html>`;
const server = createServer(async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'",
  );
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.headers.host !== new URL(address).host) {
    res.writeHead(403).end("Invalid host");
    return;
  }
  const url = new URL(req.url, address);
  if (
    req.method === "GET" &&
    url.pathname === "/" &&
    url.searchParams.get("token") === token
  ) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(html);
    return;
  }
  if (
    req.method !== "POST" ||
    url.pathname !== "/save" ||
    req.headers.origin !== address
  ) {
    res
      .writeHead(403)
      .end("Open the private setup link printed in your terminal.");
    return;
  }
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 12000) {
      res.writeHead(413).end();
      return;
    }
  }
  const form = new URLSearchParams(raw);
  const provided = form.get("csrf") || "";
  const key = (form.get("key") || "").trim();
  if (
    provided.length !== token.length ||
    !timingSafeEqual(Buffer.from(provided), Buffer.from(token)) ||
    !/^sk-[A-Za-z0-9_-]{20,}$/.test(key)
  ) {
    res
      .writeHead(400)
      .end("Invalid key or expired setup form. Please try again.");
    return;
  }
  try {
    let env = await readFile(envFile, "utf8").catch(() => "");
    env = /^OPENAI_API_KEY=/m.test(env)
      ? env.replace(/^OPENAI_API_KEY=.*$/m, `OPENAI_API_KEY=${key}`)
      : env + `\nOPENAI_API_KEY=${key}\n`;
    await writeFile(envFile, env, { mode: 0o600 });
    await chmod(envFile, 0o600);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(
      "<h1>Key saved privately.</h1><p>You can close this tab. Restart ContextBridge to enable live AI.</p>",
    );
    console.log("OpenAI key saved to web/.env. The key was not logged.");
    server.close();
  } catch {
    res.writeHead(500).end("Could not save the environment file.");
  }
});
server.listen(0, "127.0.0.1", () => {
  address = `http://127.0.0.1:${server.address().port}`;
  const url = `${address}/?token=${token}`;
  console.log(`Open this private local setup form: ${url}`);
  const command =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "explorer"
        : "xdg-open";
  spawn(command, [url], { stdio: "ignore" }).on("error", () => {});
});
setTimeout(
  () => {
    console.log("Setup form expired. Run npm run setup:key again.");
    server.close();
  },
  15 * 60 * 1000,
).unref();
