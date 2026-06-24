"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppBar from "../components/AppBar";
import BottomNav from "../components/BottomNav";
import LoadingScreen from "../components/LoadingScreen";
import TeamBadge from "../components/TeamBadge";
import { useRequireApp } from "../hooks/useRequireApp";
import { supabase } from "../../lib/supabaseClient";

const PRESETS: [string, string][] = [
  ["#15803d", "#ea580c"],
  ["#0b1f6b", "#16161b"],
  ["#c8102e", "#16161b"],
  ["#1ba0d8", "#ffffff"],
  ["#5e2d91", "#ffd400"],
  ["#8e1f2f", "#f0bc42"],
  ["#0d9488", "#fde047"],
  ["#1d4ed8", "#f97316"],
];

export default function Personalizza() {
  const router = useRouter();
  const app = useRequireApp(false);

  const [primary, setPrimary] = useState("#15803d");
  const [secondary, setSecondary] = useState("#ea580c");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // precarica i colori attuali della mia squadra (se già scelti)
  useEffect(() => {
    if (!app.ready || !app.userId || !app.activeLeagueId) return;
    let off = false;
    (async () => {
      const { data } = await supabase.rpc("get_league_members", { p_league_id: app.activeLeagueId });
      if (off) return;
      const me = (data as any[] | null)?.find((m) => m.user_id === app.userId);
      if (me?.color_primary) setPrimary(me.color_primary);
      if (me?.color_secondary) setSecondary(me.color_secondary);
    })();
    return () => { off = true; };
  }, [app.ready, app.userId, app.activeLeagueId]);

  async function save() {
    if (saving || !app.activeLeagueId) return;
    setSaving(true);
    await supabase.rpc("set_team_colors", {
      p_league_id: app.activeLeagueId,
      p_color_primary: primary,
      p_color_secondary: secondary,
    });
    setSaving(false);
    setSaved(true);
    (app as any).refresh?.();
    setTimeout(() => router.push("/"), 700);
  }

  if (!app.ready || !app.userId) return <LoadingScreen />;
  if (!app.activeLeagueId) { router.push("/seleziona-lega"); return <LoadingScreen />; }

  return (
    <>
      <AppBar league={app.leagueName} team={app.teamName} onMenuOpen={app.openDrawer} />

      <main style={s.container}>
        <div style={s.card}>
          <h1 style={s.title}>Personalizza la tua squadra</h1>
          <p style={s.desc}>Scegli i due colori del tuo stemma. Compariranno in chat, classifica e home.</p>

          <div style={s.preview}>
            <span style={s.ring}>
              <TeamBadge name={app.teamName} primary={primary} secondary={secondary} size={104} />
            </span>
            <div style={s.pvname}>{app.teamName ?? "La mia squadra"}</div>
          </div>

          <div style={s.lab}>Colori</div>
          <div style={s.colors}>
            <label style={s.crow}>
              <input type="color" value={primary} onChange={(e) => setPrimary(e.target.value)} style={s.colorInput} />
              <span>Primario</span>
            </label>
            <label style={s.crow}>
              <input type="color" value={secondary} onChange={(e) => setSecondary(e.target.value)} style={s.colorInput} />
              <span>Secondario</span>
            </label>
          </div>

          <div style={s.lab}>Abbinamenti rapidi</div>
          <div style={s.presets}>
            {PRESETS.map(([p, sc], i) => (
              <button
                key={i}
                type="button"
                onClick={() => { setPrimary(p); setSecondary(sc); }}
                title="Usa questi colori"
                style={{ ...s.preset, background: `linear-gradient(135deg, ${p} 0 50%, ${sc} 50% 100%)` }}
              />
            ))}
          </div>

          <button type="button" onClick={save} disabled={saving} style={{ ...s.cta, opacity: saving ? 0.6 : 1 }}>
            {saved ? "Salvato ✓" : saving ? "Salvataggio…" : "Salva colori"}
          </button>
        </div>
      </main>

      <BottomNav />
    </>
  );
}

const s: Record<string, React.CSSProperties> = {
  container: { maxWidth: 520, margin: "0 auto", padding: "16px 14px calc(70px + env(safe-area-inset-bottom, 0px) + 20px)" },
  card: { background: "white", border: "1px solid #dbe4dd", borderRadius: 8, padding: 20, boxShadow: "0 12px 28px rgba(19,35,26,.08)" },
  title: { fontSize: 22, fontWeight: 1000, color: "#0f172a", margin: 0, textAlign: "center" },
  desc: { fontSize: 13, color: "#64748b", fontWeight: 600, textAlign: "center", margin: "6px 0 18px" },
  preview: { display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginBottom: 18 },
  ring: { borderRadius: "50%", padding: 4, border: "2px solid #e5e7eb", display: "grid", placeItems: "center" },
  pvname: { fontSize: 17, fontWeight: 1000, color: "#0f172a" },
  lab: { fontSize: 11, fontWeight: 1000, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".05em", margin: "14px 0 6px" },
  colors: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 11 },
  crow: { background: "#fff", border: "1px solid #dbe4dd", borderRadius: 8, padding: 11, display: "flex", alignItems: "center", gap: 10, fontSize: 12.5, fontWeight: 900, color: "#0f172a", cursor: "pointer" },
  colorInput: { width: 34, height: 34, border: "none", borderRadius: 8, background: "none", padding: 0, cursor: "pointer" },
  presets: { display: "flex", gap: 9, flexWrap: "wrap" },
  preset: { width: 36, height: 36, borderRadius: "50%", border: "2px solid #fff", boxShadow: "0 1px 4px rgba(0,0,0,.2)", cursor: "pointer" },
  cta: { width: "100%", border: 0, borderRadius: 8, padding: 15, fontWeight: 1000, fontSize: 16, color: "#fff", background: "#15803d", marginTop: 20, cursor: "pointer", boxShadow: "0 10px 22px rgba(21,128,61,.22)" },
};
