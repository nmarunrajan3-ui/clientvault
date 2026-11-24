import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const STORAGE_KEY = 'clientvault_supabase_config';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

let cachedClient: SupabaseClient | null = null;
let cachedConfigStr: string | null = null;
let inMemoryConfig: SupabaseConfig | null = null;

export function getSupabaseConfig(): SupabaseConfig | null {
  // 1. Check environment variables (e.g. from Vercel / Netlify env vars)
  const envUrl = typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_SUPABASE_URL : undefined;
  const envKey = typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_SUPABASE_ANON_KEY : undefined;
  if (envUrl && envKey && typeof envUrl === 'string' && typeof envKey === 'string') {
    return { url: envUrl.trim(), anonKey: envKey.trim() };
  }

  // 2. Check in-memory config
  if (inMemoryConfig) {
    return inMemoryConfig;
  }

  // 3. Check local storage settings in browser
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.url && parsed.anonKey) {
          inMemoryConfig = { url: parsed.url.trim(), anonKey: parsed.anonKey.trim() };
          return inMemoryConfig;
        }
      }
    }
  } catch (err) {
    console.error('Error reading Supabase config from localStorage:', err);
  }

  return null;
}

export function saveSupabaseConfig(url: string, anonKey: string): void {
  inMemoryConfig = { url: url.trim(), anonKey: anonKey.trim() };
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(inMemoryConfig));
  }
  cachedClient = null;
  cachedConfigStr = null;
}

export function clearSupabaseConfig(): void {
  inMemoryConfig = null;
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
  }
  cachedClient = null;
  cachedConfigStr = null;
}

export function getSupabaseClient(): SupabaseClient | null {
  const config = getSupabaseConfig();
  if (!config) return null;

  const configStr = `${config.url}|${config.anonKey}`;
  if (cachedClient && cachedConfigStr === configStr) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(config.url, config.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
    cachedConfigStr = configStr;
    return cachedClient;
  } catch (err) {
    console.error('Failed to create Supabase client:', err);
    return null;
  }
}

export async function testSupabaseConnection(
  url: string,
  anonKey: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const client = createClient(url.trim(), anonKey.trim());
    // Attempt a light read on counters or customers
    const { error } = await client.from('counters').select('name').limit(1);
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Connection failed' };
  }
}
