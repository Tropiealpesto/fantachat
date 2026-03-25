"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useRouter } from "next/navigation";
import AppBar from "../components/AppBar";
import BottomNav from "../components/BottomNav";
import { useApp } from "../components/AppContext";
import "./seleziona-lega.css";

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