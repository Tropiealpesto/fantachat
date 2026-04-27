"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import AppBar from "../../components/AppBar";
import BottomNav from "../../components/BottomNav";
import { useApp } from "../../components/AppContext";

type Mode = "classic" | "custom";

type Rules = {
  goal: number;
  assist: number;
  yellow: number;
  red: number;
  clean_sheet_gk: number;
  clean_sheet_def: number;
  goals_conceded_gk: number;
  pen_missed: number;
  subbed_on: number;
  subbed_off: number;
};

const CLASSIC: Rules = {
  goal: 3,
  assist: 1,
  yellow: -0.5,
  red: -1,
  clean_sheet_gk: 1,
  clean_sheet_def: 1,
  goals_conceded_gk: -1,
  pen_missed: -3,
  subbed_on: 0,
  subbed_off: 0,
};

export default function AdminRegolePage() {
  const router = useRouter();
  const { ready, userId, activeLeagueId, leagueName, teamName, role, openDrawer } = useApp();

  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>("classic");
  const [rules, setRules] = useState<Rules>({ ...CLASSIC });

  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function run() {
      if (!ready) return;
      if (!userId) return router.replace("/login");
      if (!activeLeagueId) return router.replace("/seleziona-lega");
      if (role !== "admin") return router.replace("/");

      const { data, error } = await supabase.rpc("get_league_rules_config");
      if (error) {
        setMode("classic");
        setRules({ ...CLASSIC });
        setLoading(false);
        return;
      }

      const row = Array.isArray(data) ? data[0] : data;
      const m = (row?.rules_mode as Mode) || "classic";
      setMode(m);

      // se custom, carica rules salvate; altrimenti mostra classic
      const saved = row?.rules || {};
      if (m === "custom") {
        setRules({
          goal: num(saved.goal, CLASSIC.goal),
          assist: num(saved.assist, CLASSIC.assist),
          yellow: num(saved.yellow, CLASSIC.yellow),
          red: num(saved.red, CLASSIC.red),
          clean_sheet_gk: num(saved.clean_sheet_gk, CLASSIC.clean_sheet_gk),
          clean_sheet_def: num(saved.clean_sheet_def, CLASSIC.clean_sheet_def),
          goals_conceded_gk: num(saved.goals_conceded_gk, CLASSIC.goals_conceded_gk),
          pen_missed: num(saved.pen_missed, CLASSIC.pen_missed),
          subbed_on: num(saved.subbed_on, CLASSIC.subbed_on),
          subbed_off: num(saved.subbed_off, CLASSIC.subbed_off),
        });
      } else {
        setRules({ ...CLASSIC });
      }

      setLoading(false);
    }

    run();
  }, [ready, userId, activeLeagueId, role, router]);

  const effectiveRules = useMemo(() => (mode === "classic" ? CLASSIC : rules), [mode, rules]);

  function setField<K extends keyof Rules>(k: K, v: string) {
    setRules((p) => ({ ...p, [k]: parseFloat(v.replace(",", ".")) || 0 }));
  }

  async function save() {
    setMsg(null);
    setErr(null);

    setSaving(true);
    const { error } = await supabase.rpc("set_league_rules", {
      p_rules_mode: mode,
      p_rules: mode === "custom" ? effectiveRules : {},
    });
    setSaving(false);

    if (error) return setErr(error.message);
    setMsg("Regole salvate ✅");
  }

  if (!ready) return <main className="container">Caricamento...</main>;
  if (loading) return <main className="container">Caricamento...</main>;

  return (
    <>
      <AppBar league={leagueName} team={`${teamName} • ADMIN`} />
      <main className="container">
        <div className="card" style={{ padding: 16, marginTop: 12 }}>
          <div style={{ fontSize: 22, fontWeight: 1000 }}>Regole</div>
          <div style={{ marginTop: 6, color: "var(--muted)", fontWeight: 800 }}>
            Scegli tra regole standard FantaChat oppure personalizzate.
          </div>

          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            <Choice
              title="Regole classiche FantaChat"
              desc="Consigliato: esperienza standard uguale per tutti."
              active={mode === "classic"}
              onClick={() => {
                setMode("classic");
                setRules({ ...CLASSIC });
              }}
            />
            <Choice
              title="Regole personalizzate"
              desc="⚠️ Non standard: responsabilità dell’admin della lega."
              active={mode === "custom"}
              onClick={() => setMode("custom")}
              accent
            />
          </div>
        </div>

        {mode === "custom" && (
          <div className="card" style={{ padding: 16, marginTop: 12, borderLeft: "6px solid var(--accent)" }}>
            <div style={{ fontWeight: 1000, fontSize: 18 }}>Moltiplicatori (custom)</div>
            <div style={{ marginTop: 8, display: "grid", gap: 10 }}>
              <NumField label="Gol" value={rules.goal} onChange={(v) => setField("goal", v)} />
              <NumField label="Assist" value={rules.assist} onChange={(v) => setField("assist", v)} />
              <NumField label="Giallo" value={rules.yellow} onChange={(v) => setField("yellow", v)} />
              <NumField label="Rosso" value={rules.red} onChange={(v) => setField("red", v)} />
              <NumField label="Porta inviolata (GK)" value={rules.clean_sheet_gk} onChange={(v) => setField("clean_sheet_gk", v)} />
              <NumField label="Porta inviolata (DEF)" value={rules.clean_sheet_def} onChange={(v) => setField("clean_sheet_def", v)} />
              <NumField label="Gol subito (GK)" value={rules.goals_conceded_gk} onChange={(v) => setField("goals_conceded_gk", v)} />
              <NumField label="Rigore sbagliato" value={rules.pen_missed} onChange={(v) => setField("pen_missed", v)} />
              <NumField label="Subentrato" value={rules.subbed_on} onChange={(v) => setField("subbed_on", v)} />
              <NumField label="Sostituito" value={rules.subbed_off} onChange={(v) => setField("subbed_off", v)} />
            </div>
          </div>
        )}

        <div className="card" style={{ padding: 16, marginTop: 12 }}>
          <button className="btn btn-primary" style={{ width: "100%", padding: 12 }} onClick={save} disabled={saving}>
            {saving ? "Salvataggio..." : "Salva regole"}
          </button>
          {msg && <div style={{ marginTop: 12, color: "var(--primary-dark)", fontWeight: 900 }}>{msg}</div>}
          {err && <div style={{ marginTop: 12, color: "var(--accent-dark)", fontWeight: 900 }}>{err}</div>}
        </div>
      </main>
      <BottomNav />
    </>
  );
}

function Choice(props: { title: string; desc: string; active: boolean; onClick: () => void; accent?: boolean }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className="card"
      style={{
        padding: 14,
        textAlign: "left",
        cursor: "pointer",
        boxShadow: "none",
        border: "1px solid var(--border)",
        borderLeft: props.active ? `6px solid ${props.accent ? "var(--accent)" : "var(--primary)"}` : "6px solid transparent",
        background: props.active ? (props.accent ? "rgba(249,115,22,.10)" : "rgba(34,197,94,.08)") : "white",
      }}
    >
      <div style={{ fontWeight: 1000 }}>{props.title}</div>
      <div style={{ marginTop: 4, color: "var(--muted)", fontWeight: 800, fontSize: 13 }}>{props.desc}</div>
    </button>
  );
}

function NumField(props: { label: string; value: number; onChange: (v: string) => void }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 110px", gap: 10, alignItems: "center" }}>
      <div style={{ fontWeight: 900 }}>{props.label}</div>
      <input
        value={String(props.value).replace(".", ",")}
        onChange={(e) => props.onChange(e.target.value)}
        inputMode="decimal"
        style={{ padding: 12, borderRadius: 12, border: "1px solid var(--border)", fontWeight: 900 }}
      />
    </div>
  );
}

function num(v: any, fallback: number) {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
}
