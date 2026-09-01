import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

export function authClientForRequest(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!authHeader?.startsWith("Bearer ") || !supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: authHeader } },
  });
}

export async function getRequestUser(request: NextRequest) {
  const client = authClientForRequest(request);
  if (!client) return { client: null, user: null };

  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return { client, user: null };

  return { client, user: data.user };
}
