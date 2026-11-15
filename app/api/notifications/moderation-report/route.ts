import type { NextRequest } from "next/server";
import { getRequestUser } from "../../../../lib/serverAuth";
import { supabaseServer } from "../../../../lib/supabaseServer";

export const runtime = "nodejs";

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character] ?? character);
}

export async function POST(request: NextRequest) {
  const { user } = await getRequestUser(request);
  if (!user) {
    return Response.json({ ok: false, error: "Sessione mancante." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const reportId = String(body?.reportId ?? "");
  if (!reportId) {
    return Response.json({ ok: false, error: "Segnalazione mancante." }, { status: 400 });
  }

  const { data: report, error: reportError } = await supabaseServer
    .from("chat_reports")
    .select("id,message_id,reporter_id,reason,created_at")
    .eq("id", reportId)
    .eq("reporter_id", user.id)
    .maybeSingle();

  if (reportError || !report) {
    return Response.json({ ok: false, error: "Segnalazione non disponibile." }, { status: 404 });
  }

  const { data: message, error: messageError } = await supabaseServer
    .from("messages")
    .select("id,league_id,user_id,content,created_at")
    .eq("id", report.message_id)
    .maybeSingle();

  if (messageError || !message) {
    return Response.json({ ok: false, error: "Messaggio non disponibile." }, { status: 404 });
  }

  const { data: reporter } = await supabaseServer
    .from("league_members")
    .select("team_name")
    .eq("league_id", message.league_id)
    .eq("user_id", report.reporter_id)
    .maybeSingle();

  const { data: author } = await supabaseServer
    .from("league_members")
    .select("team_name")
    .eq("league_id", message.league_id)
    .eq("user_id", message.user_id)
    .maybeSingle();

  const recipient = process.env.SUPERADMIN_EMAIL?.trim() ||
    (await supabaseServer.from("app_admins").select("email").limit(1).maybeSingle()).data?.email?.trim();
  const resendKey = process.env.RESEND_API_KEY?.trim();
  const sender = process.env.RESEND_FROM_EMAIL?.trim();

  // The report is already stored. Missing email configuration must not make
  // the user lose the report or receive a misleading failure.
  if (!recipient || !resendKey || !sender) {
    console.warn("Moderation report stored without email delivery configuration.");
    return Response.json({ ok: true, sent: false });
  }

  const reason = String(report.reason ?? "Altro");
  const content = String(message.content ?? "");
  const subject = `FantaChat: nuova segnalazione nella lega ${message.league_id}`;
  const html = `
    <h2>Nuova segnalazione chat</h2>
    <p><strong>Motivo:</strong> ${escapeHtml(reason)}</p>
    <p><strong>Segnalato da:</strong> ${escapeHtml(reporter?.team_name ?? "Squadra non disponibile")}</p>
    <p><strong>Autore:</strong> ${escapeHtml(author?.team_name ?? "Squadra non disponibile")}</p>
    <p><strong>Lega:</strong> ${escapeHtml(String(message.league_id))}</p>
    <blockquote>${escapeHtml(content).replace(/\n/g, "<br />")}</blockquote>
    <p>Apri la console di moderazione per esaminare il messaggio.</p>
  `;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: sender, to: [recipient], subject, html }),
  });

  if (!response.ok) {
    console.error("Moderation report email failed", await response.text());
    return Response.json({ ok: true, sent: false });
  }

  return Response.json({ ok: true, sent: true });
}
