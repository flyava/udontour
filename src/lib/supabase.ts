"use client";

import { createClient, SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Supabase 환경변수가 없습니다. .env.local 을 확인하세요.");
  }
  client = createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
  return client;
}

// 익명 세션 보장 — 각 기기 = 하나의 auth.uid()
export async function ensureAnonSession(): Promise<string> {
  const sb = getSupabase();
  const { data } = await sb.auth.getSession();
  if (data.session?.user) return data.session.user.id;
  const { data: signed, error } = await sb.auth.signInAnonymously();
  if (error) throw error;
  return signed.user!.id;
}
