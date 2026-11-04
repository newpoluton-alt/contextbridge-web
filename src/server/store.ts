import pg from "pg";
import { readFile, mkdir, writeFile, rename } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { randomUUID, createHash, randomBytes } from "node:crypto";
import {
  HttpException,
  NotFoundException,
  UnauthorizedException,
  ConflictException,
} from "@nestjs/common";
import { demo } from "./config.js";
import {
  defaults,
  contextKey,
  attemptStatus,
  scheduleReview,
  type Settings,
  type Encounter,
  type Chat,
  type Explanation,
  type Lookup,
} from "./schema.js";
interface LocalData {
  settings: Record<string, Settings>;
  encounters: Record<string, { owner: string; data: Encounter }>;
  chats: Record<string, { owner: string; data: Chat }>;
  cache: Record<string, { owner?: string; data: unknown; expires: number }>;
  codes: Record<string, { owner: string; expires: number }>;
  tokens: Record<string, { owner: string; expires: number }>;
  usage: Record<string, number | UsageCounters>;
}
export interface UsageCounters {
  requests: number;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  reservedTokens: number;
}
export interface UsageReservation {
  day: string;
  reservedTokens: number;
}
const emptyUsage = (): UsageCounters => ({
  requests: 0,
  inputTokens: 0,
  outputTokens: 0,
  cachedInputTokens: 0,
  reservedTokens: 0,
});
function usageLimits() {
  const limit = (value: string | undefined, fallback: number) => {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
  };
  return {
    requestLimit: limit(process.env.AI_DAILY_REQUEST_LIMIT, 60),
    tokenLimit: limit(process.env.AI_DAILY_TOKEN_LIMIT, 25000),
  };
}
function localUsage(value: number | UsageCounters | undefined): UsageCounters {
  return typeof value === "number"
    ? { ...emptyUsage(), requests: value }
    : { ...emptyUsage(), ...value };
}
function tokenCount(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new RangeError("Token counts must be non-negative safe integers.");
  return value;
}
const utcDay = () => new Date().toISOString().slice(0, 10);
const allowanceError = () =>
  new HttpException(
    "Daily AI allowance reached. Saved words and reviews remain available.",
    429,
  );
const retrievalStopwords = new Set(
  "a an and are as at be been but by can could did do does for from had has have how i if in is it its me my of on or our please saved show some tell than that the their them then there these they this those to us was we were what when where which who why will with would you your explain explanation mean means meaning word words sentence example examples".split(
    " ",
  ),
);
const retrievalWords = (value: string) =>
  value.toLocaleLowerCase().match(/[\p{L}\p{N}]{2,}/gu) || [];
const empty = (): LocalData => ({
  settings: {},
  encounters: {},
  chats: {},
  cache: {},
  codes: {},
  tokens: {},
  usage: {},
});
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export class Store {
  pool =
    !demo && process.env.DATABASE_URL
      ? new pg.Pool({
          connectionString: process.env.DATABASE_URL,
          max: 4,
          connectionTimeoutMillis: 10000,
        })
      : undefined;
  path = resolve(process.env.LOCAL_DATA_FILE || ".data/contextbridge.json");
  private local = empty();
  private ready?: Promise<void>;
  private queue = Promise.resolve();
  private async load() {
    if (!this.ready)
      this.ready = (async () => {
        try {
          this.local = JSON.parse(await readFile(this.path, "utf8"));
        } catch (e) {
          if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
        }
      })();
    await this.ready;
  }
  private async mutate<T>(fn: (d: LocalData) => T): Promise<T> {
    await this.load();
    const work = this.queue.then(async () => {
      const result = fn(this.local);
      await mkdir(dirname(this.path), { recursive: true });
      const tmp = this.path + ".tmp";
      await writeFile(tmp, JSON.stringify(this.local), { mode: 0o600 });
      await rename(tmp, this.path);
      return result;
    });
    this.queue = work.then(
      () => {},
      () => {},
    );
    return work;
  }
  async profile(
    owner: string,
  ): Promise<
    | { name: string; email: string; emailVerified: boolean; banned: boolean }
    | undefined
  > {
    if (!this.pool) return undefined;
    const result = await this.pool.query(
      'SELECT name,email,"emailVerified",COALESCE(banned,false) AS banned FROM neon_auth."user" WHERE id::text=$1',
      [owner],
    );
    return result.rows[0];
  }
  async settings(owner: string, fallbackName = "Reader"): Promise<Settings> {
    if (this.pool) {
      const r = await this.pool.query(
        "SELECT data FROM cb_settings WHERE owner_id=$1",
        [owner],
      );
      return { ...defaults, name: fallbackName, ...r.rows[0]?.data };
    }
    await this.load();
    return {
      ...defaults,
      name: fallbackName,
      ...(this.local.settings[owner] as Partial<Settings> | undefined),
    };
  }
  async setSettings(owner: string, data: Partial<Settings>): Promise<Settings> {
    if (this.pool) {
      const result = await this.pool.query(
        "INSERT INTO cb_settings(owner_id,data) VALUES($1,$2) ON CONFLICT(owner_id) DO UPDATE SET data=cb_settings.data || $3::jsonb RETURNING data",
        [owner, { ...defaults, ...data }, data],
      );
      return { ...defaults, ...result.rows[0].data };
    }
    return this.mutate((d) => {
      const next = { ...defaults, ...d.settings[owner], ...data };
      d.settings[owner] = next;
      return next;
    });
  }
  async list(owner: string, q = "", language = ""): Promise<Encounter[]> {
    if (this.pool) {
      const r = await this.pool.query(
        "SELECT data FROM cb_encounters WHERE owner_id=$1 AND ($2='' OR data->>'language'=$2) AND ($3='' OR to_tsvector('simple',data->>'expression'||' '||(data->>'sentence')) @@ plainto_tsquery('simple',$3) OR strpos(lower(data::text),lower($3))>0) ORDER BY created_at DESC",
        [owner, language, q],
      );
      return r.rows.map((r) => r.data);
    }
    await this.load();
    return Object.values(this.local.encounters)
      .filter(
        (e) =>
          e.owner === owner &&
          (!language || e.data.language === language) &&
          (!q ||
            JSON.stringify(e.data).toLowerCase().includes(q.toLowerCase())),
      )
      .map((e) => e.data)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  async encounter(owner: string, id: string) {
    let item: Encounter | undefined;
    if (this.pool)
      item = (
        await this.pool.query(
          "SELECT data FROM cb_encounters WHERE owner_id=$1 AND id=$2",
          [owner, id],
        )
      ).rows[0]?.data;
    else {
      await this.load();
      const v = this.local.encounters[id];
      if (v?.owner === owner) item = v.data;
    }
    if (!item) throw new NotFoundException("Saved encounter not found.");
    return item;
  }
  async exact(owner: string, input: Lookup) {
    if (this.pool)
      return (
        await this.pool.query(
          "SELECT data FROM cb_encounters WHERE owner_id=$1 AND context_key=$2",
          [owner, contextKey(input)],
        )
      ).rows[0]?.data as Encounter | undefined;
    return (await this.list(owner)).find(
      (v) => contextKey(v) === contextKey(input),
    );
  }
  async save(
    owner: string,
    input: Omit<
      Encounter,
      "id" | "createdAt" | "updatedAt" | "review" | "attemptStatus"
    >,
    embedding?: number[],
  ) {
    const previous = await this.exact(owner, input);
    const now = new Date().toISOString();
    const data: Encounter = {
      ...input,
      id: previous?.id || randomUUID(),
      createdAt: previous?.createdAt || now,
      updatedAt: now,
      attemptStatus: attemptStatus(input),
      reviewHistory: previous?.reviewHistory || [],
      review: previous?.review || {
        dueAt: now,
        interval: 0,
        repetitions: 0,
        ease: 2.5,
      },
    };
    if (this.pool) {
      const r = await this.pool.query(
        `INSERT INTO cb_encounters(id,owner_id,context_key,data,embedding,embedding_model) VALUES($1,$2,$3,$4,$5::vector,$6) ON CONFLICT(owner_id,context_key) DO UPDATE SET data=EXCLUDED.data || jsonb_build_object('id',cb_encounters.id::text,'createdAt',cb_encounters.data->>'createdAt','review',cb_encounters.data->'review','reviewHistory',COALESCE(cb_encounters.data->'reviewHistory','[]'::jsonb)),embedding=COALESCE(EXCLUDED.embedding,cb_encounters.embedding),embedding_model=COALESCE(EXCLUDED.embedding_model,cb_encounters.embedding_model) RETURNING data`,
        [
          data.id,
          owner,
          contextKey(input),
          data,
          embedding ? JSON.stringify(embedding) : null,
          embedding
            ? process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small"
            : null,
        ],
      );
      return r.rows[0].data as Encounter;
    }
    return this.mutate((d) => {
      const existing = Object.values(d.encounters).find(
        (v) => v.owner === owner && contextKey(v.data) === contextKey(data),
      );
      if (existing) {
        data.id = existing.data.id;
        data.createdAt = existing.data.createdAt;
        data.review = existing.data.review;
        data.reviewHistory = existing.data.reviewHistory;
      }
      d.encounters[data.id] = { owner, data };
      return data;
    });
  }
  private async changeEncounter(
    owner: string,
    id: string,
    change: (current: Encounter) => Encounter,
  ): Promise<Encounter> {
    if (this.pool) {
      const connection = await this.pool.connect();
      try {
        await connection.query("BEGIN");
        const result = await connection.query(
          "SELECT data FROM cb_encounters WHERE owner_id=$1 AND id=$2 FOR UPDATE",
          [owner, id],
        );
        if (!result.rows[0])
          throw new NotFoundException("Saved encounter not found.");
        const next = change(result.rows[0].data as Encounter);
        await connection.query(
          "UPDATE cb_encounters SET data=$3 WHERE owner_id=$1 AND id=$2",
          [owner, id, next],
        );
        await connection.query("COMMIT");
        return next;
      } catch (error) {
        await connection.query("ROLLBACK");
        throw error;
      } finally {
        connection.release();
      }
    }
    return this.mutate((d) => {
      const current = d.encounters[id];
      if (!current || current.owner !== owner)
        throw new NotFoundException("Saved encounter not found.");
      const next = change(current.data);
      d.encounters[id] = { owner, data: next };
      return next;
    });
  }
  async update(
    owner: string,
    id: string,
    patch: Partial<
      Pick<
        Encounter,
        | "initialInterpretation"
        | "revisedInterpretation"
        | "assistance"
        | "checkResponse"
        | "unresolved"
      >
    >,
  ) {
    return this.changeEncounter(owner, id, (current) => {
      const next = {
        ...current,
        ...patch,
        updatedAt: new Date().toISOString(),
      };
      next.attemptStatus = attemptStatus(next);
      return next;
    });
  }
  async review(
    owner: string,
    id: string,
    rating: "again" | "hard" | "good" | "easy",
    practice: {
      interpretation?: string;
      assistance?: string[];
      unresolved?: boolean;
    } = {},
  ) {
    return this.changeEncounter(owner, id, (current) => {
      if (Date.parse(current.review.dueAt) > Date.now() + 1000)
        throw new ConflictException(
          "This card is already scheduled for later.",
        );
      return {
        ...current,
        review: scheduleReview(current.review, rating),
        unresolved: practice.unresolved ?? current.unresolved,
        reviewHistory: [
          ...(current.reviewHistory || []),
          {
            at: new Date().toISOString(),
            rating,
            interpretation: practice.interpretation || "",
            assistance: practice.assistance || [],
            unresolved: practice.unresolved ?? current.unresolved,
          },
        ].slice(-100),
        updatedAt: new Date().toISOString(),
      };
    });
  }
  async remove(owner: string, id: string) {
    if (this.pool) {
      const connection = await this.pool.connect();
      try {
        await connection.query("BEGIN");
        const deleted = await connection.query(
          "DELETE FROM cb_encounters WHERE owner_id=$1 AND id=$2 RETURNING id",
          [owner, id],
        );
        if (!deleted.rowCount)
          throw new NotFoundException("Saved encounter not found.");
        // Cache keys deliberately hide source text, so invalidate this owner's cache.
        await connection.query("DELETE FROM cb_cache WHERE owner_id=$1", [
          owner,
        ]);
        await connection.query("COMMIT");
      } catch (error) {
        await connection.query("ROLLBACK");
        throw error;
      } finally {
        connection.release();
      }
      return;
    }
    await this.mutate((d) => {
      if (!d.encounters[id] || d.encounters[id].owner !== owner)
        throw new NotFoundException("Saved encounter not found.");
      delete d.encounters[id];
      for (const [key, value] of Object.entries(d.cache))
        if (
          value.owner === owner ||
          (!value.owner && key.slice(0, -64) === owner)
        )
          delete d.cache[key];
    });
  }
  async cache<T = Explanation>(
    owner: string,
    key: string,
  ): Promise<T | undefined> {
    if (this.pool)
      return (
        await this.pool.query(
          "SELECT data FROM cb_cache WHERE owner_id=$1 AND cache_key=$2 AND expires_at>now()",
          [owner, key],
        )
      ).rows[0]?.data;
    await this.load();
    const v =
      this.local.cache[JSON.stringify([owner, key])] ||
      this.local.cache[owner + key];
    return v && v.expires > Date.now() ? (v.data as T) : undefined;
  }
  async setCache(
    owner: string,
    key: string,
    data: unknown,
    ttlSeconds = 2592000,
  ) {
    if (!Number.isFinite(ttlSeconds) || ttlSeconds < 0)
      throw new RangeError("Cache lifetime must be non-negative.");
    const serialized = JSON.stringify(data);
    if (serialized === undefined)
      throw new TypeError("Cached values must be JSON serializable.");
    if (this.pool)
      await this.pool.query(
        "INSERT INTO cb_cache(owner_id,cache_key,data,expires_at) VALUES($1,$2,$3::jsonb,now()+$4*interval '1 second') ON CONFLICT(owner_id,cache_key) DO UPDATE SET data=EXCLUDED.data,expires_at=EXCLUDED.expires_at",
        [owner, key, serialized, ttlSeconds],
      );
    else
      await this.mutate((d) => {
        d.cache[JSON.stringify([owner, key])] = {
          owner,
          data: JSON.parse(serialized),
          expires: Date.now() + ttlSeconds * 1000,
        };
        delete d.cache[owner + key];
      });
  }
  async reserve(owner: string, reservedTokens = 0): Promise<UsageReservation> {
    tokenCount(reservedTokens);
    const day = utcDay();
    const { requestLimit, tokenLimit } = usageLimits();
    if (reservedTokens > tokenLimit) throw allowanceError();
    if (this.pool) {
      const r = await this.pool.query(
        `INSERT INTO cb_usage(owner_id,day,requests,reserved_tokens) VALUES($1,$2::date,1,$3)
         ON CONFLICT(owner_id,day) DO UPDATE SET requests=cb_usage.requests+1,reserved_tokens=cb_usage.reserved_tokens+EXCLUDED.reserved_tokens
         WHERE cb_usage.requests<$4
           AND cb_usage.input_tokens+cb_usage.output_tokens+cb_usage.reserved_tokens<$5
           AND cb_usage.input_tokens+cb_usage.output_tokens+cb_usage.reserved_tokens+EXCLUDED.reserved_tokens<=$5
         RETURNING requests`,
        [owner, day, reservedTokens, requestLimit, tokenLimit],
      );
      if (!r.rowCount) throw allowanceError();
    } else {
      await this.mutate((d) => {
        const key = owner + day;
        const current = localUsage(d.usage[key]);
        const committed =
          current.inputTokens + current.outputTokens + current.reservedTokens;
        if (
          current.requests >= requestLimit ||
          committed >= tokenLimit ||
          committed + reservedTokens > tokenLimit
        )
          throw allowanceError();
        d.usage[key] = {
          ...current,
          requests: current.requests + 1,
          reservedTokens: current.reservedTokens + reservedTokens,
        };
      });
    }
    return { day, reservedTokens };
  }
  async settle(
    owner: string,
    reservation: UsageReservation,
    used: { input: number; output: number; cached: number },
  ): Promise<void> {
    const reserved = tokenCount(reservation.reservedTokens);
    const input = tokenCount(used.input);
    const output = tokenCount(used.output);
    const cached = Math.min(input, tokenCount(used.cached));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(reservation.day))
      throw new RangeError("Invalid reservation day.");
    if (this.pool) {
      const result = await this.pool.query(
        `UPDATE cb_usage SET reserved_tokens=reserved_tokens-$3,input_tokens=input_tokens+$4,output_tokens=output_tokens+$5,cached_input_tokens=cached_input_tokens+$6
         WHERE owner_id=$1 AND day=$2::date AND reserved_tokens>=$3 RETURNING requests`,
        [owner, reservation.day, reserved, input, output, cached],
      );
      if (!result.rowCount)
        throw new ConflictException(
          "The AI usage reservation could not be settled.",
        );
      return;
    }
    await this.mutate((d) => {
      const key = owner + reservation.day;
      const existing = d.usage[key];
      const current = localUsage(existing);
      if (existing === undefined || current.reservedTokens < reserved)
        throw new ConflictException(
          "The AI usage reservation could not be settled.",
        );
      d.usage[key] = {
        ...current,
        reservedTokens: current.reservedTokens - reserved,
        inputTokens: current.inputTokens + input,
        outputTokens: current.outputTokens + output,
        cachedInputTokens: current.cachedInputTokens + cached,
      };
    });
  }
  async usage(
    owner: string,
  ): Promise<UsageCounters & { requestLimit: number; tokenLimit: number }> {
    const day = utcDay();
    if (this.pool) {
      const result = await this.pool.query(
        "SELECT requests,input_tokens,output_tokens,cached_input_tokens,reserved_tokens FROM cb_usage WHERE owner_id=$1 AND day=$2::date",
        [owner, day],
      );
      const row = result.rows[0];
      return {
        ...emptyUsage(),
        ...(row
          ? {
              requests: Number(row.requests),
              inputTokens: Number(row.input_tokens),
              outputTokens: Number(row.output_tokens),
              cachedInputTokens: Number(row.cached_input_tokens),
              reservedTokens: Number(row.reserved_tokens),
            }
          : {}),
        ...usageLimits(),
      };
    }
    await this.load();
    await this.queue;
    return { ...localUsage(this.local.usage[owner + day]), ...usageLimits() };
  }
  async retrieve(
    owner: string,
    query: string,
    embedding?: number[],
    filter: { language?: string; translationLanguage?: string } = {},
  ) {
    const language = filter.language?.toLowerCase() || "";
    const translationLanguage = filter.translationLanguage?.toLowerCase() || "";
    const matchesLanguage = (item: Encounter) =>
      (!language || item.language.toLowerCase() === language) &&
      (!translationLanguage ||
        item.translationLanguage.toLowerCase() === translationLanguage);
    const words = [
      ...new Set(
        retrievalWords(query).filter((word) => !retrievalStopwords.has(word)),
      ),
    ];
    const items = (await this.list(owner)).filter(matchesLanguage);
    const lexical = items
      .map((item) => {
        const expression = new Set(retrievalWords(item.expression));
        const context = new Set(
          retrievalWords(
            [
              item.sentence,
              item.explanation.meaning,
              item.explanation.grammar,
            ].join(" "),
          ),
        );
        const exact =
          item.expression.trim().toLocaleLowerCase() ===
          query.trim().toLocaleLowerCase();
        return {
          item,
          score:
            (exact ? 8 : 0) +
            words.reduce(
              (score, word) =>
                score + (expression.has(word) ? 4 : context.has(word) ? 1 : 0),
              0,
            ),
        };
      })
      .filter((value) => value.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((value) => value.item);
    if (this.pool && embedding) {
      const r = await this.pool.query(
        "SELECT data FROM cb_encounters WHERE owner_id=$1 AND embedding IS NOT NULL AND embedding_model=$3 AND ($4='' OR lower(data->>'language')=$4) AND ($5='' OR lower(data->>'translationLanguage')=$5) ORDER BY embedding <=> $2::vector LIMIT 5",
        [
          owner,
          JSON.stringify(embedding),
          process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small",
          language,
          translationLanguage,
        ],
      );
      return [
        ...new Map(
          [
            ...lexical.slice(0, 3),
            ...r.rows.map((r) => r.data as Encounter),
          ].map((v) => [v.id, v]),
        ).values(),
      ].slice(0, 6);
    }
    return lexical;
  }
  async chats(owner: string): Promise<Chat[]> {
    if (this.pool)
      return (
        await this.pool.query(
          "SELECT data FROM cb_chats WHERE owner_id=$1 ORDER BY updated_at DESC",
          [owner],
        )
      ).rows.map((r) => r.data);
    await this.load();
    return Object.values(this.local.chats)
      .filter((v) => v.owner === owner)
      .map((v) => v.data)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  async chat(owner: string, id: string): Promise<Chat> {
    if (this.pool) {
      const r = await this.pool.query(
        "SELECT data FROM cb_chats WHERE owner_id=$1 AND id=$2",
        [owner, id],
      );
      if (!r.rows[0]) throw new NotFoundException("Conversation not found.");
      return r.rows[0].data;
    }
    await this.load();
    const v = this.local.chats[id];
    if (!v || v.owner !== owner)
      throw new NotFoundException("Conversation not found.");
    return v.data;
  }
  async saveChat(owner: string, data: Chat) {
    if (this.pool) {
      const r = await this.pool.query(
        "INSERT INTO cb_chats(id,owner_id,data) VALUES($1,$2,$3) ON CONFLICT(id) DO NOTHING RETURNING data",
        [data.id, owner, data],
      );
      if (!r.rowCount)
        throw new ConflictException("This conversation already exists.");
      return r.rows[0].data as Chat;
    }
    return this.mutate((d) => {
      if (d.chats[data.id])
        throw new ConflictException("This conversation already exists.");
      d.chats[data.id] = { owner, data };
      return data;
    });
  }
  async appendChat(
    owner: string,
    id: string,
    messages: Chat["messages"],
    expectedMessageCount: number,
  ): Promise<Chat> {
    if (!messages.length || expectedMessageCount + messages.length > 200)
      throw new ConflictException(
        "Start a new conversation to keep context manageable.",
      );
    const updatedAt = new Date().toISOString();
    if (this.pool) {
      const result = await this.pool.query(
        "UPDATE cb_chats SET data=jsonb_set(data,'{messages}',data->'messages' || $3::jsonb) || jsonb_build_object('updatedAt',$4::text),updated_at=now() WHERE owner_id=$1 AND id=$2 AND jsonb_array_length(data->'messages')=$5 RETURNING data",
        [owner, id, JSON.stringify(messages), updatedAt, expectedMessageCount],
      );
      if (result.rows[0]) return result.rows[0].data;
      await this.chat(owner, id);
      throw new ConflictException(
        "This conversation changed in another window. Reload it and send your draft again.",
      );
    }
    return this.mutate((d) => {
      const v = d.chats[id];
      if (!v || v.owner !== owner)
        throw new NotFoundException("Conversation not found.");
      if (v.data.messages.length !== expectedMessageCount)
        throw new ConflictException(
          "This conversation changed in another window. Reload it and send your draft again.",
        );
      const next = {
        ...v.data,
        messages: [...v.data.messages, ...messages],
        updatedAt,
      };
      d.chats[id] = { owner, data: next };
      return next;
    });
  }
  async deleteChat(owner: string, id: string) {
    await this.chat(owner, id);
    if (this.pool)
      await this.pool.query(
        "DELETE FROM cb_chats WHERE id=$1 AND owner_id=$2",
        [id, owner],
      );
    else
      await this.mutate((d) => {
        delete d.chats[id];
      });
  }
  async pair(owner: string) {
    const code = randomBytes(24).toString("base64url");
    const expiresAt = new Date(Date.now() + 300000).toISOString();
    if (this.pool)
      await this.pool.query(
        "INSERT INTO cb_pair_codes(hash,owner_id,expires_at) VALUES($1,$2,$3)",
        [hash(code), owner, expiresAt],
      );
    else
      await this.mutate((d) => {
        d.codes[hash(code)] = { owner, expires: Date.parse(expiresAt) };
      });
    return { code, expiresAt };
  }
  async exchange(code: string) {
    const key = hash(code);
    let owner: string | undefined;
    if (this.pool)
      owner = (
        await this.pool.query(
          "DELETE FROM cb_pair_codes WHERE hash=$1 AND expires_at>now() RETURNING owner_id",
          [key],
        )
      ).rows[0]?.owner_id;
    else
      owner = await this.mutate((d) => {
        const v = d.codes[key];
        delete d.codes[key];
        return v && v.expires > Date.now() ? v.owner : undefined;
      });
    if (!owner)
      throw new UnauthorizedException(
        "This pairing code has expired or was already used. Generate a new one.",
      );
    const token = "cb_ext_" + randomBytes(32).toString("base64url");
    const expires = new Date(Date.now() + 30 * 86400000);
    if (this.pool)
      await this.pool.query(
        "INSERT INTO cb_extension_tokens(hash,owner_id,expires_at) VALUES($1,$2,$3)",
        [hash(token), owner, expires],
      );
    else
      await this.mutate((d) => {
        d.tokens[hash(token)] = { owner: owner!, expires: expires.getTime() };
      });
    return { token };
  }
  async tokenOwner(token: string) {
    if (this.pool)
      return (
        await this.pool.query(
          "SELECT owner_id FROM cb_extension_tokens WHERE hash=$1 AND expires_at>now()",
          [hash(token)],
        )
      ).rows[0]?.owner_id as string | undefined;
    await this.load();
    const v = this.local.tokens[hash(token)];
    return v && v.expires > Date.now() ? v.owner : undefined;
  }
  async revoke(token: string) {
    if (this.pool)
      await this.pool.query("DELETE FROM cb_extension_tokens WHERE hash=$1", [
        hash(token),
      ]);
    else
      await this.mutate((d) => {
        delete d.tokens[hash(token)];
      });
  }
  async close() {
    await this.pool?.end();
  }
}
export const store = new Store();
