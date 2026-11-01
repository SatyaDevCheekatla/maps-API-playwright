import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load environment variables from .env file or environment-specific .env.<environment>
const envFile = process.env.NODE_ENV ? `.env.${process.env.NODE_ENV}` : '.env';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });
// Fallback to default .env if not already loaded
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const configSchema = z.object({
  BASE_URL: z.string().url({ message: 'BASE_URL must be a valid URL string' }),
  MAPS_API_KEY: z.string().min(1, { message: 'MAPS_API_KEY is required' }),
  API_TIMEOUT: z.coerce.number().positive().default(30000),
  ENVIRONMENT: z.enum(['development', 'qa', 'staging', 'production']).default('development'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  WORKERS: z.coerce.number().int().min(1).max(16).default(2),
});

export type FrameworkConfig = z.infer<typeof configSchema>;

function loadConfig(): FrameworkConfig {
  const result = configSchema.safeParse({
    BASE_URL: process.env.BASE_URL,
    MAPS_API_KEY: process.env.MAPS_API_KEY,
    API_TIMEOUT: process.env.API_TIMEOUT,
    ENVIRONMENT: process.env.ENVIRONMENT,
    LOG_LEVEL: process.env.LOG_LEVEL,
    WORKERS: process.env.WORKERS,
  });

  if (!result.success) {
    const errorIssues = result.error.issues
      .map((issue) => ` - [${issue.path.join('.')}]: ${issue.message}`)
      .join('\n');
    throw new Error(
      `[Config Error] Framework initialization failed due to invalid environment configuration:\n${errorIssues}\nPlease verify your .env file against .env.example.`,
    );
  }

  return Object.freeze(result.data);
}

export const config: FrameworkConfig = loadConfig();

/**
 * Utility to safely redact sensitive strings (API keys, tokens, passwords)
 * for logging and reporting attachments.
 */
export function redactSensitiveData(content: unknown): unknown {
  if (content === null || content === undefined) {
    return content;
  }

  if (typeof content === 'string') {
    // Redact key parameters in URLs or JSON strings
    return content
      .replace(/([?&]key=)([^&\s]+)/gi, '$1***REDACTED***')
      .replace(/("key"\s*:\s*")([^"]+)(")/gi, '$1***REDACTED***$3')
      .replace(/("password"\s*:\s*")([^"]+)(")/gi, '$1***REDACTED***$3')
      .replace(/("token"\s*:\s*")([^"]+)(")/gi, '$1***REDACTED***$3')
      .replace(/("secret"\s*:\s*")([^"]+)(")/gi, '$1***REDACTED***$3');
  }

  if (Array.isArray(content)) {
    return content.map((item) => redactSensitiveData(item));
  }

  if (typeof content === 'object') {
    const redactedObj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(content as Record<string, unknown>)) {
      if (/key|password|token|secret|authorization/i.test(k) && typeof v === 'string') {
        redactedObj[k] = '***REDACTED***';
      } else {
        redactedObj[k] = redactSensitiveData(v);
      }
    }
    return redactedObj;
  }

  return content;
}
