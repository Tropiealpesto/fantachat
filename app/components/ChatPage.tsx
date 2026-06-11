"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { themeFromType } from "@/lib/competitionThemes";

type Mention = { user_id: string; team_name: string };
type CitedPlayer = { id: string; name: string; role: string; team: string };
type Meta = { mentions?: Mention[]; players?: CitedPlayer[] } | null;
type Message = {
  id: string; league_id: string; league_competition_id: string | null; user_id: string | null;
  kind: string; content: string | null; meta: Meta; matchday_id: string | null;
  matchday_number: number | null; created_at: string; team_name?: string | null;
};
type Member = { user_id: string; team_name: string; role: string };
type Competition = { id: string; name: string; competition_type: string | null };
type PlayerHit = { real_player_id: string; name: string; role: string; team: string; points: number };

type Props = {
  leagueId: string; currentUserId: string; currentTeamName: string;
  activeLeagueCompetitionId?: string | null; competitions?: Competition[];
};

const ROLE_COLORS: Record<string, { bg: string; color: string }> = {
  P: { bg: "#fef9c3", color: "#a16207" }, D: { bg: "#dcfce7", color: "#15803d" },
  C: { bg: "#dbeafe", color: "#1d4ed8" }, A: { bg: "#fee2e2", color: "#dc2626" },
};

function hue(str: string) { let h = 0; for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 360; return h; }
function shieldBg(name?: string | null) { const h = hue(name ?? "x"); return `linear-gradient(135deg,hsl(${h},55%,46%),hsl(${(h + 28) % 360},58%,30%))`; }
function initials(name?: string | null) { const n = (name ?? "?").trim(); const p = n.split(/\s+/); return (p.length === 1 ? p[0].slice(0, 2) : p[0][0] + p[p.length - 1][0]).toUpperCase(); }
function escapeRe(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function activeToken(text: string) {
  const m = text.match(/(@{1,2})([^@\s]*)$/);
  if (!m) return null;
  return { kind: m[1].length === 2 ? "player" : "person", query: m[2], start: text.length - m[0].length };
}
function playerLabel(p: { role: string; name: string; team: string }) { return p.role === "P" ? (p.team || p.name) : p.name; }
function playerSub(p: { role: string; team: string }) { return p.role === "P" ? "Portiere" : p.team; }

export default function ChatPage({ leagueId, currentUserId, activeLeagueCompetitionId, competitions = [] }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [pts, setPts] = useState<Record<string, number>>({});
  const [input, setInput] = useState("");
  const [token, setToken] = useState<{ kind: string; query: string; start: number } | null>(null);
  const [playerHits, setPlayerHits] = useState<PlayerHit[]>([]);
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [cited, setCited] = useState<CitedPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const endRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const timer = useRef<any>(null);

  const compMap = useMemo(() => new Map(competitions.map((c) => [c.id, c])), [competitions]);
  const activeComp = activeLeagueCompetitionId ? compMap.get(activeLeagueCompetitionId) : null;
  const theme = themeFromType(activeComp?.competition_type ?? null);
  const accent = theme.primary;

  async function loadMessages() {
    const { data } = await supabase.rpc("get_chat_messages", { p_league_id: leagueId, p_limit: 200 });
    setMessages((data ?? []) as Message[]);
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: "auto" }), 50);
  }

  useEffect(() => {
    let off = false;
    (async () => {
      setLoading(true);
      const [{ data: msgs }, { data: mem }] = await Promise.all([
        supabase.rpc("get_chat_messages", { p_league_id: leagueId, p_limit: 200 }),
        supabase.rpc("get_league_members", { p_league_id: leagueId }),
      ]);
      if (off) return;
      setMessages((msgs ?? []) as Message[]);
      setMembers((mem ?? []) as Member[]);
      setLoading(false);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "auto" }), 60);
    })();
    return () => { off = true; };
  }, [leagueId]);

  useEffect(() => {
    const ch = supabase
      .channel(`chat:${leagueId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `league_id=eq.${leagueId}` },
        () => { loadMessages(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [leagueId]);

  const citedIds = useMemo(
    () => Array.from(new Set(messages.flatMap((m) => (m.meta?.players ?? []).map((p) => p.id)))),
    [messages]
  );
  useEffect(() => {
    if (!activeLeagueCompetitionId || citedIds.length === 0) return;
    let off = false;
    async function run() {
      const { data } = await supabase.rpc("chat_player_points", { p_league_competition_id: activeLeagueCompetitionId, p_ids: citedIds });
      if (off || !data) return;
      const map: Record<string, number> = {};
      (data as any[]).forEach((r) => { map[r.real_player_id] = Number(r.points); });
      setPts((prev) => ({ ...prev, ...map }));
    }
    run();
    const iv = setInterval(run, 30000);
    return () => { off = true; clearInterval(iv); };
  }, [citedIds.join(","), activeLeagueCompetitionId]);

  function onChange(v: string) {
    setInput(v);
    const t = activeToken(v);
    setToken(t);
    if (t && t.kind === "player") {
      if (timer.current) clearTimeout(timer.current);
      const q = t.query;
      timer.current = setTimeout(async () => {
        if (!activeLeagueCompetitionId) return;
        const { data } = await supabase.rpc("chat_search_players", { p_league_competition_id: activeLeagueCompetitionId, p_q: q });
        setPlayerHits((data ?? []) as PlayerHit[]);
      }, 220);
    }
  }

  function startToken(kind: "person" | "player") {
    const add = kind === "person" ? "@" : "@@";
    const base = input && !input.endsWith(" ") ? input + " " : input;
    const v = base + add;
    setInput(v);
    setToken({ kind, query: "", start: v.length - add.length });
    if (kind === "player" && activeLeagueCompetitionId) {
      supabase.rpc("chat_search_players", { p_league_competition_id: activeLeagueCompetitionId, p_q: "" })
        .then(({ data }) => setPlayerHits((data ?? []) as PlayerHit[]));
    }
    taRef.current?.focus();
  }

  const peopleHits = useMemo(() => {
    if (!token || token.kind !== "person") return [];
    const q = token.query.toLowerCase();
    return members.filter((m) => (m.team_name ?? "").toLowerCase().includes(q)).slice(0, 8);
  }, [token, members]);

  function pickPerson(m: Member) {
    const t = activeToken(input);
    const before = t ? input.slice(0, t.start) : input;
    setInput(before + "@" + m.team_name + " ");
    setMentions((p) => (p.some((x) => x.user_id === m.user_id) ? p : [...p, { user_id: m.user_id, team_name: m.team_name }]));
    setToken(null); taRef.current?.focus();
  }
  function pickPlayer(p: PlayerHit) {
    const t = activeToken(input);
    const before = t ? input.slice(0, t.start) : input;
    setInput(before);
    setCited((c) => (c.some((x) => x.id === p.real_player_id) ? c : [...c, { id: p.real_player_id, name: p.name, role: p.role, team: p.team }]));
    setPts((prev) => ({ ...prev, [p.real_player_id]: Number(p.points) }));
    setToken(null); taRef.current?.focus();
  }

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    const usedMentions = mentions.filter((m) => text.includes("@" + m.team_name));
    const meta = { mentions: usedMentions, players: cited };
    setInput(""); setMentions([]); setCited([]); setToken(null);
    await supabase.rpc("send_chat_message", {
      p_league_id: leagueId, p_league_competition_id: activeLeagueCompetitionId ?? null,
      p_matchday_id: null, p_content: text, p_kind: "text", p_meta: meta,
    });
    await loadMessages();
    setSending(false);
  }

  function ptsTag(id: string) {
    const v = pts[id];
    if (v === undefined) return <span style={{ ...s.pts, ...s.ptsFlat }}>·</span>;
    const cls = v > 0 ? s.ptsUp : v < 0 ? s.ptsDown : s.ptsFlat;
    const txt = v > 0 ? "+" + v.toFixed(1) : v.toFixed(1);
    return <span style={{ ...s.pts, ...cls }}>{txt}</span>;
  }

  function renderText(content: string | null, own: boolean) {
    if (!content) return null;
    const tags = mentionsTags(content);
    if (tags.length === 0) return content;
    const re = new RegExp("(" + tags.map(escapeRe).join("|") + ")", "g");
    return content.split(re).map((part, i) =>
      tags.includes(part)
        ? <span key={i} style={{ ...s.mention, ...(own ? s.mentionOwn : { color: accent, background: "rgba(21,128,61,.14)" }) }}>{part}</span>
        : <span key={i}>{part}</span>
    );
  }
  function mentionsTags(content: string) {
    const out: string[] = [];
    for (const m of members) { const tag = "@" + m.team_name; if (content.includes(tag) && !out.includes(tag)) out.push(tag); }
    return out.sort((a, b) => b.length - a.length);
  }

  return (
    <div style={s.wrap}>
      <div style={s.stripe} />
      <div style={s.header}>
        <div>
          <div style={s.hTitle}>Chat lega</div>
          <div style={s.hSub}>{members.length} partecipanti</div>
        </div>
        {activeComp && (
          <div style={{ ...s.livePill, background: theme.badgeBg, color: theme.badgeText }}>
            <span style={{ ...s.liveDot, background: theme.badgeText }} /> {activeComp.name}
          </div>
        )}
      </div>

      <div style={s.messages}>
        {loading ? (
          <div style={s.center}>Caricamento...</div>
        ) : messages.length === 0 ? (
          <div style={s.center}>Ancora nessun messaggio. Scrivi il primo!</div>
        ) : (
          messages.map((m, i) => {
            const own = m.user_id === currentUserId;
            if (m.kind && m.kind !== "text") {
              const comp = m.league_competition_id ? compMap.get(m.league_competition_id) : null;
              const isLineup = m.kind === "lineup";
              return (
                <div key={m.id} style={s.event}>
                  <div style={s.eventIco}>{isLineup ? "🛡️" : "⚽"}</div>
                  <div>
                    <div style={s.eventTxt}>{isLineup ? `${m.team_name ?? "Un utente"} ha caricato la formazione` : (m.content ?? "Aggiornamento")}</div>
                    <div style={s.eventMeta}>
                      {comp && <span style={{ ...s.tag, ...s.tagComp }}>{comp.name}</span>}
                      {m.matchday_number != null && <span style={s.tag}>Giornata {m.matchday_number}</span>}
                    </div>
                  </div>
                </div>
              );
            }
            const prev = messages[i - 1];
            const head = !prev || prev.user_id !== m.user_id || (prev.kind && prev.kind !== "text");
            const players = m.meta?.players ?? [];
            return (
              <div key={m.id} style={{ ...s.row, justifyContent: own ? "flex-end" : "flex-start", flexDirection: own ? "row-reverse" : "row" }}>
                {head ? (
                  <div style={{ ...s.shield, background: shieldBg(m.team_name) }}>{initials(m.team_name)}</div>
                ) : (
                  <div style={{ width: 34, flexShrink: 0 }} />
                )}
                <div style={{ ...s.col, alignItems: own ? "flex-end" : "flex-start" }}>
                  {head && (
                    <div style={s.who}>
                      {!own && <span style={s.whoName}>{m.team_name ?? "Squadra"}</span>}
                      <span style={s.whoTime}>{new Date(m.created_at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}</span>
                      {own && <span style={s.whoName}>Tu</span>}
                    </div>
                  )}
                  <div style={{ ...s.bubble, ...(own ? { background: accent, color: "white", borderTopRightRadius: 5 } : { background: "#f1f5f9", color: "#0f172a", borderTopLeftRadius: 5 }) }}>
                    <span style={{ whiteSpace: "pre-wrap" }}>{renderText(m.content, own)}</span>
                    {players.map((p) => (
                      <span key={p.id} style={s.pchip}>
                        <span style={{ ...s.rb, background: (ROLE_COLORS[p.role] ?? ROLE_COLORS.C).bg, color: (ROLE_COLORS[p.role] ?? ROLE_COLORS.C).color }}>{p.role}</span>
                        <span style={s.pinfo}>
                          <span style={s.pn}>{playerLabel(p)}</span>
                          <span style={s.pt}>{playerSub(p)}</span>
                        </span>
                        {ptsTag(p.id)}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      {/* popup menzioni / giocatori */}
      {token && (token.kind === "person" ? peopleHits.length > 0 : playerHits.length > 0) && (
        <div style={s.ta}>
          <div style={s.taHead}>{token.kind === "person" ? "Menziona un partecipante" : "Cita un giocatore"}</div>
          <div style={s.taList}>
            {token.kind === "person"
              ? peopleHits.map((m) => (
                  <button key={m.user_id} type="button" onMouseDown={(e) => { e.preventDefault(); pickPerson(m); }} style={s.taRow}>
                    <span style={{ ...s.shieldSm, background: shieldBg(m.team_name) }}>{initials(m.team_name)}</span>
                    <span style={s.taName}>{m.team_name}</span>
                  </button>
                ))
              : playerHits.map((p) => (
                  <button key={p.real_player_id} type="button" onMouseDown={(e) => { e.preventDefault(); pickPlayer(p); }} style={s.taRow}>
                    <span style={{ ...s.rb, background: (ROLE_COLORS[p.role] ?? ROLE_COLORS.C).bg, color: (ROLE_COLORS[p.role] ?? ROLE_COLORS.C).color }}>{p.role}</span>
                    <span style={s.pinfo}><span style={s.taName}>{playerLabel(p)}</span><span style={s.pt}>{playerSub(p)}</span></span>
                    {ptsTag(p.real_player_id)}
                  </button>
                ))}
          </div>
        </div>
      )}

      {/* giocatori citati in attesa di invio */}
      {cited.length > 0 && (
        <div style={s.citedBar}>
          {cited.map((p) => (
            <span key={p.id} style={s.citedChip}>
              <span style={{ ...s.rbSm, background: (ROLE_COLORS[p.role] ?? ROLE_COLORS.C).bg, color: (ROLE_COLORS[p.role] ?? ROLE_COLORS.C).color }}>{p.role}</span>
              {playerLabel(p)}
              <button type="button" onClick={() => setCited((c) => c.filter((x) => x.id !== p.id))} style={s.citedX}>✕</button>
            </span>
          ))}
        </div>
      )}

      <div style={s.composer}>
        <button type="button" onClick={() => startToken("person")} style={s.tool}>@</button>
        <button type="button" onClick={() => startToken("player")} style={{ ...s.tool, fontSize: 17 }}>⚽</button>
        <textarea
          ref={taRef} value={input} onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Scrivi un messaggio…  @ persone  @@ giocatori" style={s.textarea} rows={1}
        />
        <button type="button" onClick={send} disabled={sending || !input.trim()} style={{ ...s.send, background: accent, opacity: sending || !input.trim() ? 0.5 : 1 }}>➤</button>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  wrap: { display: "flex", flexDirection: "column", height: "100%", background: "#f6f7f9" },
  stripe: { height: 4, background: "repeating-linear-gradient(90deg,#15803d 0 20px,#1f9d4d 20px 40px)" },
  header: { background: "white", borderBottom: "1px solid #e5e7eb", padding: "11px 16px", display: "flex", alignItems: "center", gap: 10 },
  hTitle: { fontWeight: 1000, color: "#0f172a", fontSize: 16 },
  hSub: { fontSize: 11, color: "#64748b", fontWeight: 700 },
  livePill: { marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, borderRadius: 999, padding: "5px 11px", fontSize: 11, fontWeight: 1000 },
  liveDot: { width: 7, height: 7, borderRadius: "50%" },
  messages: { flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 9 },
  center: { margin: "auto", color: "#9ca3af", fontWeight: 800, textAlign: "center" },
  event: { alignSelf: "center", width: "100%", maxWidth: 330, background: "white", border: "1px solid #e5e7eb", borderLeft: "4px solid #15803d", borderRadius: 14, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10, boxShadow: "0 3px 10px rgba(15,23,42,.05)" },
  eventIco: { width: 30, height: 30, borderRadius: 9, background: "#dcfce7", display: "grid", placeItems: "center", fontSize: 15, flexShrink: 0 },
  eventTxt: { fontSize: 12.5, color: "#0f172a", fontWeight: 800, lineHeight: 1.25 },
  eventMeta: { fontSize: 11, color: "#64748b", fontWeight: 800, marginTop: 3, display: "flex", gap: 6, flexWrap: "wrap" },
  tag: { background: "#f1f5f9", borderRadius: 6, padding: "1px 7px", fontWeight: 900, color: "#475569" },
  tagComp: { background: "#dcfce7", color: "#15803d" },
  row: { display: "flex", gap: 9, alignItems: "flex-end", maxWidth: "100%" },
  shield: { width: 34, height: 34, borderRadius: 11, flexShrink: 0, display: "grid", placeItems: "center", color: "white", fontWeight: 1000, fontSize: 12, border: "2px solid #fff", boxShadow: "0 2px 6px rgba(0,0,0,.18)" },
  shieldSm: { width: 28, height: 28, borderRadius: 9, display: "grid", placeItems: "center", color: "white", fontWeight: 1000, fontSize: 11, flexShrink: 0 },
  col: { display: "flex", flexDirection: "column", gap: 3, minWidth: 0, maxWidth: "78%" },
  who: { display: "flex", alignItems: "center", gap: 7, padding: "0 2px" },
  whoName: { fontSize: 12, fontWeight: 1000, color: "#0f172a" },
  whoTime: { fontSize: 10, color: "#94a3b8", fontWeight: 700 },
  bubble: { padding: "9px 12px", borderRadius: 14, fontSize: 14, fontWeight: 600, lineHeight: 1.4, display: "flex", flexDirection: "column", gap: 6, boxShadow: "0 1px 3px rgba(0,0,0,.06)" },
  mention: { fontWeight: 1000, borderRadius: 5, padding: "0 3px" },
  mentionOwn: { background: "rgba(255,255,255,.25)", color: "white" },
  pchip: { display: "inline-flex", alignItems: "center", gap: 8, background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: "5px 8px 5px 5px", boxShadow: "0 2px 6px rgba(15,23,42,.06)", alignSelf: "flex-start", maxWidth: "100%" },
  rb: { width: 24, height: 24, borderRadius: 7, display: "grid", placeItems: "center", fontWeight: 1000, fontSize: 11, flexShrink: 0 },
  rbSm: { width: 18, height: 18, borderRadius: 5, display: "grid", placeItems: "center", fontWeight: 1000, fontSize: 9, flexShrink: 0 },
  pinfo: { display: "flex", flexDirection: "column", lineHeight: 1.1, minWidth: 0 },
  pn: { fontSize: 13, fontWeight: 1000, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  pt: { fontSize: 10.5, fontWeight: 800, color: "#64748b" },
  pts: { marginLeft: 2, fontSize: 13, fontWeight: 1000, padding: "3px 9px", borderRadius: 9, flexShrink: 0 },
  ptsUp: { background: "#dcfce7", color: "#15803d" },
  ptsDown: { background: "#fee2e2", color: "#dc2626" },
  ptsFlat: { background: "#f1f5f9", color: "#64748b" },
  ta: { margin: "0 12px", background: "white", border: "1px solid #e5e7eb", borderRadius: 16, boxShadow: "0 14px 30px rgba(15,23,42,.16)", overflow: "hidden" },
  taHead: { fontSize: 10, fontWeight: 1000, color: "#64748b", textTransform: "uppercase", letterSpacing: ".04em", padding: "9px 13px 5px" },
  taList: { maxHeight: 240, overflowY: "auto", display: "flex", flexDirection: "column" },
  taRow: { display: "flex", alignItems: "center", gap: 10, padding: "9px 13px", borderTop: "1px solid #f1f5f9", background: "white", border: "none", cursor: "pointer", textAlign: "left", fontFamily: "inherit", width: "100%" },
  taName: { fontSize: 13, fontWeight: 900, color: "#0f172a" },
  citedBar: { display: "flex", gap: 6, flexWrap: "wrap", padding: "8px 12px 0" },
  citedChip: { display: "inline-flex", alignItems: "center", gap: 6, background: "white", border: "1px solid #e5e7eb", borderRadius: 999, padding: "4px 8px", fontSize: 12, fontWeight: 900, color: "#0f172a" },
  citedX: { border: "none", background: "#e5e7eb", color: "#374151", width: 18, height: 18, borderRadius: "50%", fontWeight: 900, cursor: "pointer", fontSize: 10, lineHeight: 1 },
  composer: { background: "white", borderTop: "1px solid #e5e7eb", padding: 10, display: "flex", alignItems: "center", gap: 8 },
  tool: { width: 38, height: 38, borderRadius: 12, background: "#f1f5f9", border: "none", color: "#64748b", fontWeight: 1000, fontSize: 15, cursor: "pointer", flexShrink: 0 },
  textarea: { flex: 1, border: "1px solid #e5e7eb", borderRadius: 18, padding: "10px 14px", resize: "none", fontFamily: "inherit", fontSize: 14, fontWeight: 600, maxHeight: 110 },
  send: { width: 42, height: 42, borderRadius: "50%", border: 0, color: "white", fontWeight: 900, cursor: "pointer", flexShrink: 0 },
};