import { z } from "zod";

const ConfigSchema = z.object({
  DATABASE_URL: z.string().min(1),
  DATABASE_URL_SSL: z.union([z.literal("true"), z.literal("false")]).optional().default("false"),
  REDIS_URL: z.string().optional(),
  PLATFORM_API_KEY: z.string().optional(),
  ADMIN_WEBHOOK_SECRET: z.string().optional(),
  AMAZON_NOTIFICATIONS_SECRET: z.string().optional(),
  SP_API_ENDPOINT: z.string().url().optional(),
  SP_API_AWS_REGION: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  SP_API_ACCESS_TOKEN: z.string().optional(),
  SP_API_MARKETPLACE_ID: z.string().default("ATVPDKIKX0DER"),
  SP_API_LISTINGS_API_VERSION: z.string().default("2021-08-01"),
  SP_API_APPLICATION_ID: z.string().optional(),
  LWA_CLIENT_ID: z.string().optional(),
  LWA_CLIENT_SECRET: z.string().optional(),
  WEB_APP_URL: z.string().url().optional(),
  OAUTH_REDIRECT_URI: z.string().url().optional(),
  OAUTH_STATE_TTL_SECONDS: z.coerce.number().default(600),
  AMAZON_WRITE_OUTBOX_BATCH_LIMIT: z.coerce.number().default(50),
  AMAZON_WRITE_OUTBOX_MAX_ATTEMPTS: z.coerce.number().default(10),
  AMAZON_WRITE_OUTBOX_BASE_BACKOFF_SECONDS: z.coerce.number().default(60),
  AMAZON_WRITE_OUTBOX_MAX_BACKOFF_SECONDS: z.coerce.number().default(3600),
  SP_API_ENABLED: z.union([z.literal("true"), z.literal("false")]).default("false"),
  SP_API_DRY_RUN: z.union([z.literal("true"), z.literal("false")]).default("true"),
});

type Config = z.infer<typeof ConfigSchema>;

let cachedConfig: Config | null = null;

export function getConfig(): Config {
  if (cachedConfig) return cachedConfig;
  const parsed = ConfigSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      `Invalid configuration: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ")}`
    );
  }
  cachedConfig = parsed.data;
  return cachedConfig;
}

export function isSpApiEnabled(): boolean {
  return getConfig().SP_API_ENABLED === "true";
}

export function isSpApiDryRun(): boolean {
  return getConfig().SP_API_DRY_RUN === "true";
}
