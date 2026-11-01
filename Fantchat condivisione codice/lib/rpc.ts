import { supabase } from "./supabaseClient";

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
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  return String(Math.round(n * 10) / 10).replace(".", ",");
}

export function signedFmt(n: number | null | undefined) {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  const rounded = Math.round(n * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${String(rounded).replace(".", ",")}`;
}
