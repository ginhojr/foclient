import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(3333),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  FRONTEND_URL: z.string().default('http://localhost:3000'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DIRECT_URL: z.string().optional(),
  JWT_SECRET: z.string().min(16).default('foclient-jwt-super-secret-key-2026-multi-tenant-saas'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(16)
    .default('foclient-refresh-super-secret-key-2026-multi-tenant-saas'),
  JWT_EXPIRES_IN: z.string().default('8h'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  ENCRYPTION_KEY: z
    .string()
    .min(32)
    .default('8f4b2e9c1d7a6f3e5b0c8d2a4f9e1b7c3d5a8f0e2c4b6d8a1e3f5c7b9d0a2e4f'),
  WHATSAPP_DEFAULT_PROVIDER: z
    .enum(['BAILEYS', 'OPENWA', 'META_CLOUD_API'])
    .default('BAILEYS'),
  WHATSAPP_SESSIONS_DIR: z.string().default('.wa_sessions'),
  GEMINI_API_KEY: z.string().optional().default(''),
  GEMINI_MODEL: z.string().default('gemini-2.5-flash'),
  META_API_VERSION: z.string().default('v21.0'),
  META_WEBHOOK_VERIFY_TOKEN: z.string().default('foclient-meta-verify-token'),
});

export const env = envSchema.parse(process.env);
