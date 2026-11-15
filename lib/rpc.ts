import { supabase } from "./supabaseClient";
import { formatScore } from "./scoreMath.mjs";

export async function rpcJson<T>(name: string, args?: Record<string, unknown>, fallback?: T): Promise<T> {
  const { data, error } = await supabase.rpc(name, args ?? {});
  if (error) {
    console.warn(`[rpc:${name}]`, error.message);
    if (fallback !== undefined) return fallback;
    throw error;
  }
  return data as T;
}

export function fmt(n: number | null | undefined) {
  return formatScore(n);
}

export function signedFmt(n: number | null | undefined) {
  return formatScore(n, 1, true);
}
