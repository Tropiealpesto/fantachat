"use client";

import { useCallback, useEffect, useState } from "react";
import AppBar from "../../components/AppBar";
import BottomNav from "../../components/BottomNav";
import CompetitionBadge from "../../components/CompetitionBadge";
import { useRequireLeagueAdmin } from "../../hooks/useRequireApp";
import { supabase } from "../../../lib/supabaseClient";
import { humanError } from "../../../lib/humanError";

type Report = {
  id: string;
  message_id: string;
  reporter_team_name: string;
  author_team_name: string;
  content: string | null;
  reason: string;
  status: "open" | "reviewed" | "dismissed";
  created_at: string;
};

export default function ModerationPage() {
  const app = useRequireLeagueAdmin();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    if (!app.activeLeagueId) return;
    setLoading(true);
    const { data, error } = await supabase.rpc("get_chat_reports", { p_league_id: app.activeLeagueId });
    if (error) setFeedback(humanError(error, "Non è stato possibile caricare le segnalazioni."));
    else setReports((data ?? []) as Report[]);
    setLoading(false);
  }, [app.activeLeagueId]);

  useEffect(() => {
    if (!app.ready || !app.activeLeagueId) return;
    let cancelled = false;

    async function run() {
      setLoading(true);
      const { data, error } = await supabase.rpc("get_chat_reports", { p_league_id: app.activeLeagueId });
      if (cancelled) return;
      if (error) setFeedback(humanError(error, "Non è stato possibile caricare le segnalazioni."));
      else setReports((data ?? []) as Report[]);
      setLoading(false);
    }

    void run();
    return () => { cancelled = true; };
  }, [app.ready, app.activeLeagueId]);

  async function resolve(id: string, status: "reviewed" | "dismissed") {
    const { error } = await supabase.rpc("resolve_chat_report", { p_report_id: id, p_status: status });
    if (error) {
      setFeedback(humanError(error, "Non è stato possibile aggiornare la segnalazione."));
      return;
    }
    setFeedback(status === "reviewed" ? "Messaggio nascosto e segnalazione archiviata." : "Segnalazione archiviata.");
    await loadReports();
  }

  return (
    <>
      <AppBar league={app.leagueName} team={`${app.teamName} · ADMIN`} onMenuOpen={app.openDrawer} />
      <main style={s.container}>
        <section style={s.hero}>
          <CompetitionBadge name={app.competitionName} type={app.competitionType} />
          <h1 style={s.title}>Moderazione chat</h1>
          <p style={s.subtitle}>Esamina le segnalazioni della lega e nascondi i messaggi non conformi.</p>
        </section>

        {feedback && <div role="status" style={s.feedback}>{feedback}</div>}

        <section style={s.list}>
          {loading ? <p style={s.empty}>Caricamento...</p> : reports.length === 0 ? <p style={s.empty}>Nessuna segnalazione.</p> : reports.map((report) => (
            <article key={report.id} style={{ ...s.report, opacity: report.status === "open" ? 1 : .7 }}>
              <div style={s.reportHead}>
                <strong>{report.status === "open" ? "Da esaminare" : report.status === "reviewed" ? "Nascosta" : "Archiviata"}</strong>
                <span>{new Date(report.created_at).toLocaleString("it-IT")}</span>
              </div>
              <p style={s.content}>{report.content || "Messaggio vuoto"}</p>
              <p style={s.meta}>Segnalato da {report.reporter_team_name} · autore {report.author_team_name} · motivo: {report.reason}</p>
              {report.status === "open" && (
                <div style={s.actions}>
                  <button type="button" onClick={() => resolve(report.id, "reviewed")} style={s.hide}>Nascondi messaggio</button>
                  <button type="button" onClick={() => resolve(report.id, "dismissed")} style={s.dismiss}>Archivia</button>
                </div>
              )}
            </article>
          ))}
        </section>
      </main>
      <BottomNav />
    </>
  );
}

const s: Record<string, React.CSSProperties> = {
  container: { width: "100%", maxWidth: 620, margin: "0 auto", padding: "12px 14px calc(72px + env(safe-area-inset-bottom, 0px) + 18px)", display: "grid", gap: 10, boxSizing: "border-box" },
  hero: { background: "white", border: "1px solid rgba(226,232,240,.92)", borderRadius: 12, padding: 14, boxShadow: "0 3px 12px rgba(15,23,42,.035)" },
  title: { margin: "12px 0 3px", color: "#0f172a", fontSize: 22, lineHeight: 1.05, fontWeight: 900 },
  subtitle: { margin: 0, color: "#64748b", fontSize: 12.5, lineHeight: 1.35, fontWeight: 750 },
  feedback: { background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 10, padding: "9px 11px", color: "#9a3412", fontSize: 12, fontWeight: 800 },
  list: { display: "grid", gap: 9 },
  report: { background: "white", border: "1px solid #e2e8f0", borderRadius: 12, padding: 13, boxShadow: "0 2px 10px rgba(15,23,42,.035)" },
  reportHead: { display: "flex", justifyContent: "space-between", gap: 10, color: "#0f172a", fontSize: 12 },
  content: { margin: "11px 0 7px", color: "#0f172a", fontSize: 14, lineHeight: 1.4, whiteSpace: "pre-wrap", overflowWrap: "anywhere" },
  meta: { margin: 0, color: "#64748b", fontSize: 11.5, lineHeight: 1.35, fontWeight: 700 },
  actions: { display: "flex", gap: 7, marginTop: 12 },
  hide: { border: 0, borderRadius: 8, padding: "8px 10px", background: "#b42318", color: "white", font: "inherit", fontSize: 11, fontWeight: 900, cursor: "pointer" },
  dismiss: { border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 10px", background: "white", color: "#475569", font: "inherit", fontSize: 11, fontWeight: 900, cursor: "pointer" },
  empty: { margin: 0, padding: 20, textAlign: "center", color: "#64748b", fontWeight: 800 },
};
