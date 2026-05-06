import { z } from "zod";

const schema = z.object({
  OPENAI_API_KEY: z.string().min(1),
  ACCESS_PASSWORD: z.string().min(1),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be ≥32 chars"),
  USE_MOCKS: z.enum(["0", "1"]).default("1"),
  DISABLE_CACHE: z.enum(["0", "1"]).default("0"),
  INTEGRATIONS_MODE: z
    .enum(["mock-domain", "mock-api", "real"])
    .default("mock-domain"),
  // Real-mode credentials (only required when INTEGRATIONS_MODE=real)
  JIRA_BASE_URL: z.string().optional(),
  JIRA_EMAIL: z.string().optional(),
  JIRA_API_TOKEN: z.string().optional(),
  HUBSPOT_PORTAL_ID: z.string().optional(),
  HUBSPOT_ACCESS_TOKEN: z.string().optional(),
});

export const env = schema.parse({
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  ACCESS_PASSWORD: process.env.ACCESS_PASSWORD,
  AUTH_SECRET: process.env.AUTH_SECRET,
  USE_MOCKS: process.env.USE_MOCKS,
  DISABLE_CACHE: process.env.DISABLE_CACHE,
  INTEGRATIONS_MODE: process.env.INTEGRATIONS_MODE,
  JIRA_BASE_URL: process.env.JIRA_BASE_URL,
  JIRA_EMAIL: process.env.JIRA_EMAIL,
  JIRA_API_TOKEN: process.env.JIRA_API_TOKEN,
  HUBSPOT_PORTAL_ID: process.env.HUBSPOT_PORTAL_ID,
  HUBSPOT_ACCESS_TOKEN: process.env.HUBSPOT_ACCESS_TOKEN,
});

export const useMocks = env.USE_MOCKS === "1";
export const integrationsMode = env.INTEGRATIONS_MODE;
export const cacheDisabled = env.DISABLE_CACHE === "1";
