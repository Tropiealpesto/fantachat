"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useRouter } from "next/navigation";
import AppBar from "../components/AppBar";
import BottomNav from "../components/BottomNav";
import { useApp } from "../components/AppContext";

type Row = {
  league_id: string;
  leagues: { name: string } | null;
  team_id: string;
  teams: { name: string } | null;
  role: string;
};

export default function SelezionaLegaPage() {
  const router = useRouter();
  const { ready, userId } = useApp();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [os, setOs] = useState<"ios" | "android">("ios");

  useEffect(() => {
    async function run() {
      if (!ready) return;
      if (!userId) return router.replace("/login");

      setErr(null);
      setMsg(null);
      setLoading(true);

      await supabase.rpc("claim_invites_for_me");

      const { data, error } = await supabase
        .from("memberships")
        .select("league_id, leagues(name), team_id, teams(name), role");

      if (error) setErr(error.message);
      setRows((data || []) as any);
      setLoading(false);
    }

    run();
  }, [ready, userId, router]);

  async function setLeague(leagueId: string) {
    setErr(null);
    setMsg(null);

    const { error } = await supabase.rpc("set_active_league", {
      p_league_id: leagueId,
    });

    if (error) {
      setErr(error.message);
      return;
    }

    setMsg("Lega selezionata ✅");
    setTimeout(() => router.replace("/"), 300);
  }

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (!ready || loading) return <main className="container" style={{ padding: 20, fontFamily: "'Nunito', sans-serif" }}>Caricamento...</main>;

  return (
    <>
      <style>{
        .fc-page {
          font-family: 'Nunito', sans-serif;
          max-width: 480px;
          margin: 0 auto;
          padding: 16px 16px 100px;
        }

        .fc-section-title {
          font-size: 22px;
          font-weight: 900;
          color: var(--color-text-primary, #111);
          margin: 0 0 4px;
          letter-spacing: -0.3px;
        }

        .fc-section-desc {
          font-size: 13px;
          color: var(--muted, #888);
          margin: 0 0 16px;
          font-weight: 700;
          line-height: 1.5;
        }

        .fc-league-list {
          display: grid;
          gap: 10px;
          margin-bottom: 14px;
        }

        .fc-league-item {
          display: flex;
          align-items: center;
          gap: 12px;
          background: var(--card-bg, #fff);
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          padding: 13px 15px;
          cursor: pointer;
          text-align: left;
          width: 100%;
          transition: border-color 0.15s;
          font-family: 'Nunito', sans-serif;
        }

        .fc-league-item:hover {
          border-color: #1a7a3e;
        }

        .fc-league-dot {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: #e8f5ee;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .fc-league-info {
          flex: 1;
          min-width: 0;
        }

        .fc-league-name {
          font-size: 14px;
          font-weight: 800;
          color: var(--color-text-primary, #111);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .fc-league-meta {
          font-size: 12px;
          color: var(--muted, #888);
          margin-top: 2px;
          font-weight: 700;
        }

        .fc-badge-admin {
          font-size: 10px;
          font-weight: 800;
          background: #fff4ea;
          color: #e07b1a;
          padding: 2px 8px;
          border-radius: 20px;
          letter-spacing: 0.3px;
          text-transform: uppercase;
          flex-shrink: 0;
          border: 1px solid #f5c990;
        }

        .fc-badge-active {
          font-size: 10px;
          font-weight: 800;
          background: #1a7a3e;
          color: white;
          padding: 2px 8px;
          border-radius: 20px;
          letter-spacing: 0.3px;
          text-transform: uppercase;
          flex-shrink: 0;
        }

        .fc-btn-create {
          width: 100%;
          padding: 15px;
          background: #1a7a3e;
          color: white;
          border: none;
          border-radius: 14px;
          font-family: 'Nunito', sans-serif;
          font-size: 15px;
          font-weight: 800;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-bottom: 20px;
          text-decoration: none;
        }

        .fc-divider {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 18px;
        }

        .fc-divider-line {
          flex: 1;
          height: 1px;
          background: #e5e7eb;
        }

        .fc-divider-text {
          font-size: 11px;
          color: var(--muted, #888);
          text-transform: uppercase;
          letter-spacing: 0.8px;
          font-weight: 800;
        }

        .fc-install-card {
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          padding: 16px;
        }

        .fc-install-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 14px;
        }

        .fc-install-icon {
          width: 38px;
          height: 38px;
          background: #e07b1a;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .fc-install-title {
          font-size: 14px;
          font-weight: 800;
          color: var(--color-text-primary, #111);
          margin: 0;
        }

        .fc-install-sub {
          font-size: 12px;
          color: var(--muted, #888);
          margin: 2px 0 0;
          font-weight: 700;
        }

        .fc-os-tab {
          display: flex;
          gap: 6px;
          margin-bottom: 14px;
        }

        .fc-os-btn {
          flex: 1;
          padding: 7px 0;
          font-size: 12px;
          font-weight: 800;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
          background: white;
          color: #888;
          cursor: pointer;
          font-family: 'Nunito', sans-serif;
          transition: all 0.15s;
        }

        .fc-os-btn.active {
          background: #e07b1a;
          color: white;
          border-color: #e07b1a;
        }

        .fc-steps {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .fc-step {
          display: flex;
          align-items: flex-start;
          gap: 10px;
        }

        .fc-step-num {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: #e07b1a;
          color: white;
          font-size: 11px;
          font-weight: 800;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          margin-top: 1px;
          font-family: 'Nunito', sans-serif;
        }

        .fc-step-label {
          font-size: 13px;
          font-weight: 800;
          color: var(--color-text-primary, #111);
          margin: 0 0 2px;
        }

        .fc-step-desc {
          font-size: 12px;
          color: var(--muted, #888);
          margin: 0;
          line-height: 1.4;
          font-weight: 700;
        }

        .fc-step-inline {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          padding: 2px 7px;
          font-size: 11px;
          font-weight: 800;
          color: var(--color-text-primary, #111);
          vertical-align: middle;
        }

        .fc-msg-success {
          margin-top: 12px;
          color: #1a7a3e;
          font-weight: 900;
          font-size: 14px;
        }

        .fc-msg-error {
          margin-top: 12px;
          color: #e07b1a;
          font-weight: 900;
          font-size: 14px;
        }

        .fc-empty {
          color: var(--muted, #888);
          font-weight: 800;
          font-size: 14px;
          padding: 8px 0;
        }
      }
      </style>

      <AppBar
        league="FantaChat"
        team="Seleziona lega"
        right={
          <button
            onClick={logout}
            style={{
              fontSize: 14,
              color: "#e07b1a",
              background: "#fff4ea",
              border: "1px solid #f5c990",
              borderRadius: 20,
              padding: "5px 14px",
              cursor: "pointer",
              fontFamily: "'Nunito', sans-serif",
              fontWeight: 800,
            }}
          >
            Esci
          </button>
        }
      />

      <main className="container">
        <div className="fc-page">
          <h1 className="fc-section-title">Selezione lega</h1>
          <p className="fc-section-desc">Scegli la lega attiva. Puoi crearne una nuova in basso.</p>

          {err && <div className="fc-msg-error">{err}</div>}
          {msg && <div className="fc-msg-success">{msg}</div>}

          <div className="fc-league-list">
            {rows.length === 0 ? (
              <div className="fc-empty">Non sei ancora in nessuna lega.</div>
            ) : (
              rows.map((r, i) => (
                <button
                  key={i}
                  className="fc-league-item"
                  onClick={() => setLeague(r.league_id)}
                >
                  <div className="fc-league-dot">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1a7a3e" strokeWidth="2">
                      <circle cx="12" cy="12" r="9" />
                      <path d="M12 7v5l3 3" />
                    </svg>
                  </div>
                  <div className="fc-league-info">
                    <div className="fc-league-name">{r.leagues?.name || "Lega"}</div>
                    <div className="fc-league-meta">{r.teams?.name || "Squadra"}</div>
                  </div>
                  <span className="fc-badge-admin">{String(r.role).toUpperCase()}</span>
                  <span style={{ color: "#aaa", fontSize: 16 }}>›</span>
                </button>
              ))
            )}
          </div>

          <a
            href="/crea-lega"
            className="fc-btn-create"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Crea nuova lega
          </a>

          <div className="fc-divider">
            <div className="fc-divider-line" />
            <span className="fc-divider-text">Aggiungi alla home</span>
            <div className="fc-divider-line" />
          </div>

          <div className="fc-install-card">
            <div className="fc-install-header">
              <div className="fc-install-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <rect x="5" y="2" width="14" height="20" rx="2" />
                  <line x1="12" y1="18" x2="12" y2="18" strokeWidth="3" strokeLinecap="round" />
                </svg>
              </div>
              <div>
                <p className="fc-install-title">Installa l'app sul telefono</p>
                <p className="fc-install-sub">Accesso rapido dalla home screen</p>
              </div>
            </div>

            <div className="fc-os-tab">
              <button
                className={`fc-os-btn${os === "ios" ? " active" : ""}`}
                onClick={() => setOs("ios")}
              >
                iPhone (Safari)
              </button>
              <button
                className={`fc-os-btn${os === "android" ? " active" : ""}`}
                onClick={() => setOs("android")}
              >
                Android (Chrome)
              </button>
            </div>

            {os === "ios" ? (
              <div className="fc-steps">
                <div className="fc-step">
                  <div className="fc-step-num">1</div>
                  <div>
                    <p className="fc-step-label">Apri Safari</p>
                    <p className="fc-step-desc">Assicurati di usare Safari, non Chrome o altri browser.</p>
                  </div>
                </div>
                <div className="fc-step">
                  <div className="fc-step-num">2</div>
                  <div>
                    <p className="fc-step-label">Tocca "Condividi"</p>
                    <p className="fc-step-desc">
                      Premi l'icona{" "}
                      <span className="fc-step-inline">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
                          <polyline points="16 6 12 2 8 6" />
                          <line x1="12" y1="2" x2="12" y2="15" />
                        </svg>
                        Condividi
                      </span>{" "}
                      nella barra in basso.
                    </p>
                  </div>
                </div>
                <div className="fc-step">
                  <div className="fc-step-num">3</div>
                  <div>
                    <p className="fc-step-label">Aggiungi a Home</p>
                    <p className="fc-step-desc">
                      Scorri e tocca <span className="fc-step-inline">+ Aggiungi a Home</span>, poi conferma.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="fc-steps">
                <div className="fc-step">
                  <div className="fc-step-num">1</div>
                  <div>
                    <p className="fc-step-label">Apri Chrome</p>
                    <p className="fc-step-desc">Assicurati di usare Google Chrome come browser.</p>
                  </div>
                </div>
                <div className="fc-step">
                  <div className="fc-step-num">2</div>
                  <div>
                    <p className="fc-step-label">Tocca il menu</p>
                    <p className="fc-step-desc">
                      Premi i tre puntini <span className="fc-step-inline">⋮</span> in alto a destra.
                    </p>
                  </div>
                </div>
                <div className="fc-step">
                  <div className="fc-step-num">3</div>
                  <div>
                    <p className="fc-step-label">Aggiungi a Home</p>
                    <p className="fc-step-desc">
                      Tocca <span className="fc-step-inline">Aggiungi a schermata Home</span> e conferma.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <BottomNav />
    </>
  );
}