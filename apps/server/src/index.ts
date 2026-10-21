// Starts the API. With DATABASE_URL it uses Postgres; without it, an in-memory store, which is
// enough for local runs. Secrets come from the environment only.
import { serve } from "@hono/node-server";
import { createApp } from "./app.ts";
import { telegram } from "./notify.ts";
import { memoryStore, pgStore } from "./store.ts";

const env = process.env;
const secret = env.SESSION_SECRET ?? (env.NODE_ENV === "production" ? undefined : "dev-only-secret");
if (!secret) throw new Error("SESSION_SECRET is required in production");

const store = env.DATABASE_URL ? await pgStore(env.DATABASE_URL) : memoryStore();
const app = createApp(store, {
  secret,
  ownerKey: env.OWNER_KEY,
  origins: env.SITE_ORIGIN?.split(",").map((s) => s.trim()).filter(Boolean),
  notify: telegram(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID),
});

const port = Number(env.PORT ?? 8787);
serve({ fetch: app.fetch, port }, () => console.log(`LupinOS API on :${port} (${env.DATABASE_URL ? "postgres" : "memory"})`));
