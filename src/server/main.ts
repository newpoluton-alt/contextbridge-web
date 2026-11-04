import { createApp } from "./app.js";
const { app } = await createApp();
await app.listen(
  Number(process.env.API_PORT) || 3000,
  process.env.VERCEL ? "0.0.0.0" : "127.0.0.1",
);
console.log(
  `ContextBridge API ready on http://localhost:${process.env.API_PORT || 3000}`,
);
