import "dotenv/config";
import pg from "pg";
import { readFile, readdir } from "node:fs/promises";
if (!process.env.DATABASE_URL)
  throw new Error("Set DATABASE_URL in web/.env first.");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  for (const name of (await readdir(new URL("../sql/", import.meta.url)))
    .filter((name) => name.endsWith(".sql"))
    .sort()) {
    await pool.query(
      await readFile(new URL("../sql/" + name, import.meta.url), "utf8"),
    );
  }
  console.log("ContextBridge schema and vector indexes are ready.");
} finally {
  await pool.end();
}
