import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getRequestUser } from "../../../../lib/serverAuth";
import { supabaseServer } from "../../../../lib/supabaseServer";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const { client, user } = await getRequestUser(request);
  if (!client || !user) return NextResponse.json({ error: "Autenticazione richiesta." }, { status: 401 });

  const userId = user.id;

  // The RPC runs the application-data cleanup in one database transaction.
  const { error: cleanupError } = await client.rpc("prepare_account_deletion", { p_user_id: userId });
  if (cleanupError) {
    return NextResponse.json({ error: "Non è stato possibile preparare la cancellazione dei dati." }, { status: 500 });
  }

  const { error } = await supabaseServer.auth.admin.deleteUser(userId);
  if (error) {
    return NextResponse.json({ error: "Non è stato possibile completare la cancellazione dell'account." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
