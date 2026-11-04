import "reflect-metadata";
import {
  Module,
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Req,
  Res,
  Body,
  Param,
  Query,
  Catch,
  HttpException,
  type ExceptionFilter,
  type ArgumentsHost,
  UnauthorizedException,
} from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { ExpressAdapter } from "@nestjs/platform-express";
import express, { type Request, type Response } from "express";
import helmet from "helmet";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { z, ZodError } from "zod";
import { demo, authUrl, appUrl, production, validateConfig } from "./config.js";
import { identity, webOnly } from "./auth.js";
import { store } from "./store.js";
import { lookup, feedback, chatResponse, embed } from "./ai.js";
import {
  lookupSchema,
  transientContextSchema,
  explanationSchema,
  encounterInputSchema,
  progressSchema,
  settingsSchema,
  exportAnki,
  type Chat,
} from "./schema.js";
import { fixtureInputs, fixture } from "./fixtures.js";
const idSchema = z.string().uuid();
const messageSchema = z.object({
  message: z.string().trim().min(1).max(3000),
  encounterId: z.string().uuid().optional(),
  context: transientContextSchema.optional(),
});
@Controller("api")
class ApiController {
  @Get("config") config() {
    return {
      demo,
      authUrl,
      aiConfigured: !!process.env.OPENAI_API_KEY,
      storage: store.pool ? "neon" : "local",
      appUrl,
    };
  }
  @Get("health") health() {
    return { ok: true };
  }
  @Get("me") async me(@Req() req: Request) {
    const user = await identity(req);
    return {
      id: user.id,
      name: (await store.settings(user.id, user.name)).name,
      email: user.email,
    };
  }
  @Get("usage") async usage(@Req() req: Request) {
    return store.usage((await identity(req)).id);
  }
  @Get("settings") async settings(@Req() req: Request) {
    const user = await identity(req);
    return store.settings(user.id, user.name);
  }
  @Put("settings") async saveSettings(
    @Req() req: Request,
    @Body() body: unknown,
  ) {
    return store.setSettings(
      (await identity(req)).id,
      settingsSchema.partial().parse(body),
    );
  }
  @Get("encounters") async list(
    @Req() req: Request,
    @Query("q") q = "",
    @Query("language") language = "",
  ) {
    return {
      items: await store.list(
        (await identity(req)).id,
        z.string().max(160).parse(q),
        z.string().max(80).parse(language),
      ),
    };
  }
  @Post("lookup") async lookup(@Req() req: Request, @Body() body: unknown) {
    return lookup((await identity(req)).id, lookupSchema.parse(body));
  }
  @Post("feedback") async feedback(@Req() req: Request, @Body() body: unknown) {
    const input = z
      .object({
        expression: z.string().max(160),
        sentence: z.string().max(2400),
        interpretation: z.string().trim().min(1).max(2000),
        explanation: explanationSchema,
        kind: z.enum(["interpretation", "check"]).optional(),
      })
      .parse(body);
    return feedback((await identity(req)).id, input);
  }
  @Post("encounters") async save(@Req() req: Request, @Body() body: unknown) {
    const owner = (await identity(req)).id;
    const input = encounterInputSchema.parse(body);
    const previous = await store.exact(owner, input);
    const embedding = previous
      ? undefined
      : await embed(
          owner,
          `${input.expression}\n${input.sentence}\n${input.explanation.meaning}`,
        );
    return store.save(owner, input, embedding);
  }
  @Patch("encounters/:id") async update(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return store.update(
      (await identity(req)).id,
      idSchema.parse(id),
      progressSchema.partial().parse(body),
    );
  }
  @Delete("encounters/:id") async remove(
    @Req() req: Request,
    @Param("id") id: string,
  ) {
    await store.remove((await identity(req)).id, idSchema.parse(id));
    return { ok: true };
  }
  @Post("encounters/:id/review") async review(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const input = z
      .object({
        rating: z.enum(["again", "hard", "good", "easy"]),
        interpretation: z.string().max(2000).optional(),
        assistance: z.array(z.string().max(80)).max(30).optional(),
        unresolved: z.boolean().optional(),
      })
      .parse(body);
    return store.review(
      (await identity(req)).id,
      idSchema.parse(id),
      input.rating,
      input,
    );
  }
  @Get("export") async export(@Req() req: Request, @Res() res: Response) {
    res
      .type("text/tab-separated-values")
      .set(
        "Content-Disposition",
        'attachment; filename="contextbridge-anki.tsv"',
      )
      .send(exportAnki(await store.list((await identity(req)).id)));
  }
  @Get("chats") async chats(@Req() req: Request) {
    return { items: await store.chats((await identity(req)).id) };
  }
  @Get("chats/:id") async chat(@Req() req: Request, @Param("id") id: string) {
    return store.chat((await identity(req)).id, idSchema.parse(id));
  }
  @Post("chats") async newChat(@Req() req: Request, @Body() body: unknown) {
    const owner = (await identity(req)).id;
    const input = messageSchema.parse(body);
    const generated = await chatResponse(
      owner,
      input.message,
      undefined,
      input.encounterId,
      input.context,
    );
    const now = new Date().toISOString();
    return store.saveChat(owner, {
      id: randomUUID(),
      title: generated.title,
      createdAt: now,
      updatedAt: now,
      encounterId: input.encounterId,
      context: input.encounterId ? undefined : input.context,
      messages: [
        {
          id: randomUUID(),
          role: "user",
          content: input.message,
          createdAt: now,
        },
        {
          id: randomUUID(),
          role: "assistant",
          content: generated.reply,
          createdAt: now,
        },
      ],
    });
  }
  @Post("chats/:id/messages") async message(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const owner = (await identity(req)).id;
    const previous = await store.chat(owner, idSchema.parse(id));
    if (previous.messages.length >= 200)
      throw new HttpException(
        "Start a new conversation to keep context manageable.",
        422,
      );
    const input = messageSchema.parse(body);
    const generated = await chatResponse(
      owner,
      input.message,
      previous,
      previous.encounterId,
    );
    const now = new Date().toISOString();
    const data: Chat = {
      ...previous,
      updatedAt: now,
      messages: [
        ...previous.messages,
        {
          id: randomUUID(),
          role: "user",
          content: input.message,
          createdAt: now,
        },
        {
          id: randomUUID(),
          role: "assistant",
          content: generated.reply,
          createdAt: now,
        },
      ],
    };
    return store.appendChat(
      owner,
      data.id,
      data.messages.slice(previous.messages.length),
      previous.messages.length,
    );
  }
  @Delete("chats/:id") async deleteChat(
    @Req() req: Request,
    @Param("id") id: string,
  ) {
    await store.deleteChat((await identity(req)).id, idSchema.parse(id));
    return { ok: true };
  }
  @Post("extension/pair") async pair(@Req() req: Request) {
    const who = await identity(req);
    webOnly(who);
    return store.pair(who.id);
  }
  @Post("extension/exchange") async exchange(@Body() body: unknown) {
    return store.exchange(
      z.object({ code: z.string().trim().min(20).max(100) }).parse(body).code,
    );
  }
  @Delete("extension/token") async revoke(@Req() req: Request) {
    await identity(req);
    await store.revoke(req.headers.authorization?.slice(7) || "");
    return { ok: true };
  }
}
@Module({ controllers: [ApiController] })
class AppModule {}
@Catch()
class SafeErrors implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    if (error instanceof ZodError) {
      res
        .status(400)
        .json({ message: error.issues.map((v) => v.message).join(" ") });
      return;
    }
    if (error instanceof HttpException) {
      const payload = error.getResponse();
      res.status(error.getStatus()).json({
        message:
          typeof payload === "string"
            ? payload
            : (payload as { message?: string }).message || "Request failed.",
      });
      return;
    }
    res
      .status(500)
      .json({ message: "The request could not be completed. Please retry." });
  }
}
export async function createApp() {
  validateConfig();
  if (demo) {
    const settings = await store.settings("local-demo");
    if (
      !(await store.list("local-demo")).length &&
      settings.name === "Reader"
    ) {
      // Seed only on first launch; the marker survives deleting every saved example.
      const fs = await import("node:fs/promises");
      const marker = resolve(".data/demo-seeded");
      if (!existsSync(marker)) {
        for (const input of fixtureInputs)
          await store.save("local-demo", {
            ...input,
            explanation: fixture(input)!,
            sourceUrl: "",
            initialInterpretation: "",
            revisedInterpretation: "",
            assistance: [],
            checkResponse: "",
            unresolved: false,
          });
        await fs.mkdir(resolve(".data"), { recursive: true });
        await fs.writeFile(marker, "1");
      }
    }
  }
  const server = express();
  server.disable("x-powered-by");
  server.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          connectSrc: ["'self'", ...(authUrl ? [new URL(authUrl).origin] : [])],
          imgSrc: ["'self'", "data:"],
          frameSrc: authUrl ? [new URL(authUrl).origin] : ["'none'"],
          objectSrc: ["'none'"],
        },
      },
    }),
  );
  const allowed = new Set([
    appUrl,
    ...(process.env.CORS_ORIGINS || "").split(",").filter(Boolean),
    ...(process.env.EXTENSION_IDS || "")
      .split(",")
      .filter(Boolean)
      .map((id) => "chrome-extension://" + id),
  ]);
  server.use((req, res, next) => {
    if (
      demo &&
      !/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(
        req.headers.host || "",
      )
    ) {
      res
        .status(403)
        .json({ message: "Local demo is available only on localhost." });
      return;
    }
    const origin = req.headers.origin;
    const permitted =
      !origin ||
      allowed.has(origin) ||
      (!production && demo && /^chrome-extension:\/\/[a-p]{32}$/.test(origin));
    if (!permitted) {
      res.status(403).json({ message: "This app origin is not allowed." });
      return;
    }
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Authorization, Content-Type",
      );
      res.setHeader(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      );
    }
    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    if (req.path.startsWith("/api/"))
      res.setHeader("Cache-Control", "no-store");
    next();
  });
  server.use(express.json({ limit: "48kb" }));
  const bursts = new Map<string, { time: number; count: number }>();
  server.use("/api", (req, res, next) => {
    const key =
      (process.env.VERCEL
        ? req.headers["x-vercel-forwarded-for"]?.toString().split(",")[0].trim()
        : undefined) ||
      req.ip ||
      "unknown";
    const now = Date.now();
    let bucket = bursts.get(key);
    if (!bucket || now - bucket.time > 60000) {
      bucket = { time: now, count: 0 };
      bursts.set(key, bucket);
    }
    if (++bucket.count > 120) {
      res
        .status(429)
        .json({ message: "Please wait a moment before trying again." });
      return;
    }
    if (bursts.size > 10000)
      for (const [k, v] of bursts) if (now - v.time > 60000) bursts.delete(k);
    next();
  });
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
    logger: false,
    bodyParser: false,
  });
  app.useGlobalFilters(new SafeErrors());
  const publicDir = resolve("dist/client");
  if (existsSync(publicDir)) {
    server.use(express.static(publicDir));
    server.get(/^\/(?!api(?:\/|$)).*/, (_req, res) =>
      res.sendFile(resolve(publicDir, "index.html")),
    );
  }
  await app.init();
  return { app, server };
}
