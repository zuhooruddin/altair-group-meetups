import { z } from 'zod';

const schema = z.object({
  supabaseUrl: z.url(),
  supabaseAnonKey: z.string().min(20),
  apiUrl: z.url(),
});

export type AppConfig = z.infer<typeof schema>;

/**
 * Public, build-time configuration. Expo inlines EXPO_PUBLIC_* values, which
 * is why each is read by its full literal name. Nothing secret belongs here.
 */
export function readAppConfig():
  { ok: true; config: AppConfig } | { ok: false; problems: string[] } {
  const parsed = schema.safeParse({
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    apiUrl: process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, ''),
  });
  if (parsed.success) return { ok: true, config: parsed.data };
  const names: Record<string, string> = {
    supabaseUrl: 'EXPO_PUBLIC_SUPABASE_URL',
    supabaseAnonKey: 'EXPO_PUBLIC_SUPABASE_ANON_KEY',
    apiUrl: 'EXPO_PUBLIC_API_URL',
  };
  return {
    ok: false,
    problems: parsed.error.issues.map(
      (i) => `${names[String(i.path[0])] ?? i.path.join('.')} is missing or invalid`,
    ),
  };
}
