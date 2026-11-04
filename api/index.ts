import type { Request, Response } from "express";
import { createApp } from "../src/server/app.js";
const ready = createApp();
export default async function handler(req: Request, res: Response) {
  const { server } = await ready;
  server(req, res);
}
