"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

// ─── TIPI ─────────────────────────────────────────────────────────────────────

type MessageType = "text" | "matchday" | "lineup_notification";

type MentionType = "team" | "player";

type MentionData = {
  type: MentionType;
  team_name: string;
  // Per team: formazione completa
  players?: { role: string; name: string; points: number | null }[];
  total?: number;
  // Per player: singolo giocatore
  player_name?: string;
  player_role?: string;
  player_team?: string;
  player_points?: number | null;
};

type ChatMessage = {
  id: string;
  league_id: string;
  user_id: string | null;
  matchday_id: string | null;
  content: string | null;
  message_type: MessageType;
  matchday_number?: number;
  team_name?: string;
  mentions_data?: MentionData[];
  created_at: string;
};

type LeagueMember = {
  user_id: string;
  team_name: string;
};

type LineupPlayer = {
  role: string;
  name: string;
  points: number | null;
};

type TeamLineup = {
  team_name: string;
  players: LineupPlayer[];
  total: number;
};

// Autocomplete step
type AutocompleteStep = "teams" | "team_options" | "players";
type AutocompleteState = {
  step: AutocompleteStep;
  selectedTeam?: { user_id: string; team_name: string };
  players?: LineupPlayer[];
};

// ─── PROPS ────────────────────────────────────────────────────────────────────

interface ChatPageProps {
  leagueId: string;
  currentUserId: string;
  currentTeamName: string;
}

// ─── ROLE COLORS ──────────────────────────────────────────────────────────────

const ROLE_COLORS: Record<string, { bg: string; color: string }> = {
  P: { bg: "#fefce8", color: "#a16207" },
  D: { bg: "#e8f5ee", color: "#1a5c33" },
  C: { bg: "#e6f1fb", color: "#0c447c" },
  A: { bg: "#fcebeb", color: "#a32d2d" },
};

// ─── COMPONENTE PRINCIPALE ────────────────────────────────────────────────────

export default function ChatPage({ leagueId, currentUserId, currentTeamName }: ChatPageProps) {
  const router = useRouter();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [members, setMembers] = useState<LeagueMember[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Autocomplete
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autoState, setAutoState] = useState<AutocompleteState>({ step: "teams" });
  const [mentionInsertPos, setMentionInsertPos] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
  }, []);

  // ─── LOAD INIZIALE ───────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      setLoading(true);

      // Membri lega
      const { data: membersData } = await supabase
        .from("league_members")
        .select("user_id, team_name")
        .eq("league_id", leagueId);
      setMembers((membersData ?? []) as LeagueMember[]);

      // Messaggi
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("league_id", leagueId)
        .order("created_at", { ascending: true })
        .limit(200);

      setMessages((data ?? []) as ChatMessage[]);
      setLoading(false);
      setTimeout(() => scrollToBottom(false), 50);
    }
    load();
  }, [leagueId, scrollToBottom]);

  // ─── REALTIME ─────────────────────────────────────────────────────────────

  useEffect(() => {
    const channel = supabase
      .channel(`chat:${leagueId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `league_id=eq.${leagueId}`,
      }, (payload) => {
        const newMsg = payload.new as ChatMessage;
        setMessages((prev) => {
          if (prev.find((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
        setTimeout(() => scrollToBottom(), 100);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [leagueId, scrollToBottom]);

  // ─── MAPPA UTENTE → TEAM NAME ─────────────────────────────────────────────

  const userTeamMap = useMemo(() => {
    const m = new Map<string, string>();
    members.forEach((mem) => m.set(mem.user_id, mem.team_name));
    return m;
  }, [members]);

  // ─── INPUT HANDLER ────────────────────────────────────────────────────────

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const pos = e.target.selectionStart || 0;
    setInputText(val);

    // Cerca @ nel testo prima del cursore
    const textBefore = val.substring(0, pos);
    const atMatch = textBefore.match(/@(\w*)$/);

    if (atMatch) {
      setMentionInsertPos(pos - atMatch[0].length);
      setShowAutocomplete(true);
      setAutoState({ step: "teams" });
    } else {
      setShowAutocomplete(false);
    }
  };

  // ─── AUTOCOMPLETE: seleziona squadra ──────────────────────────────────────

  async function selectTeam(member: LeagueMember) {
    // Carica la lineup corrente di questa squadra
    const players = await fetchTeamLineup(leagueId, member.user_id);

    setAutoState({
      step: "team_options",
      selectedTeam: member,
      players,
    });
  }

  // ─── AUTOCOMPLETE: inserisci formazione completa ──────────────────────────

  function insertTeamMention(member: LeagueMember) {
    const before = inputText.substring(0, mentionInsertPos);
    const afterPos = inputText.indexOf(" ", mentionInsertPos + 1);
    const after = afterPos === -1 ? "" : inputText.substring(afterPos);
    const token = `@team:${member.user_id}:${member.team_name}`;
    setInputText(`${before}${token} ${after}`.trimEnd() + " ");
    setShowAutocomplete(false);
    inputRef.current?.focus();
  }

  // ─── AUTOCOMPLETE: inserisci giocatore ────────────────────────────────────

  function insertPlayerMention(member: LeagueMember, player: LineupPlayer) {
    const before = inputText.substring(0, mentionInsertPos);
    const afterPos = inputText.indexOf(" ", mentionInsertPos + 1);
    const after = afterPos === -1 ? "" : inputText.substring(afterPos);
    const token = `@player:${member.user_id}:${player.name}`;
    setInputText(`${before}${token} ${after}`.trimEnd() + " ");
    setShowAutocomplete(false);
    inputRef.current?.focus();
  }

  // ─── INVIA MESSAGGIO ──────────────────────────────────────────────────────

  async function handleSend() {
    const text = inputText.trim();
    if (!text || sending) return;

    setSending(true);
    setInputText("");
    setShowAutocomplete(false);

    // Trova la giornata open corrente
    const { data: leagueRow } = await supabase
      .from("leagues").select("season_id").eq("id", leagueId).single();

    let matchdayId: string | null = null;
    if (leagueRow?.season_id) {
      const { data: md } = await supabase
        .from("matchdays")
        .select("id")
        .eq("season_id", leagueRow.season_id)
        .eq("status", "open")
        .order("number", { ascending: false })
        .limit(1)
        .maybeSingle();
      matchdayId = md?.id ?? null;
    }

    // Risolvi le menzioni per salvare i dati
    const mentionsData = await resolveMentions(text, leagueId, members);

    // Salva con il contenuto che contiene i token @team: e @player:
    await supabase.from("messages").insert({
      league_id: leagueId,
      user_id: currentUserId,
      matchday_id: matchdayId,
      content: text,
      message_type: "text",
      mentions_data: mentionsData.length > 0 ? mentionsData : null,
    });

    setSending(false);
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === "Escape") setShowAutocomplete(false);
  };

  // ─── RAGGRUPPAMENTO PER DATA ─────────────────────────────────────────────

  const groupedMessages = useMemo(() => {
    const groups: { date: string; msgs: ChatMessage[] }[] = [];
    for (const msg of messages) {
      const date = formatDate(msg.created_at);
      const last = groups[groups.length - 1];
      if (!last || last.date !== date) groups.push({ date, msgs: [msg] });
      else last.msgs.push(msg);
    }
    return groups;
  }, [messages]);

  // ─── RENDER ───────────────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#F9FAFB", position: "relative" }}>

      {/* Header */}
      <div style={headerStyle}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg,#16A34A,#F97316)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>💬</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#111827" }}>Chat Lega</div>
          <div style={{ fontSize: 12, color: "#6B7280" }}>
            {members.length} partecipanti
          </div>
        </div>
      </div>

      {/* Messaggi */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 10px", display: "flex", flexDirection: "column" }}>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", flex: 1, color: "#9ca3af" }}>Caricamento...</div>
        ) : messages.length === 0 ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#9CA3AF", gap: 12 }}>
            <div style={{ fontSize: 40 }}>💬</div>
            <div style={{ fontSize: 14, textAlign: "center" }}>Nessun messaggio ancora.<br />Inizia la conversazione!</div>
          </div>
        ) : (
          <>
            {groupedMessages.map(({ date, msgs }) => (
              <div key={date}>
                <DateDivider date={date} />
                {msgs.map((msg, i) => {
                  const prev = i > 0 ? msgs[i - 1] : undefined;
                  const isOwn = msg.user_id === currentUserId;
                  const showHeader = shouldShowHeader(msg, prev);
                  const teamName = msg.user_id ? userTeamMap.get(msg.user_id) ?? "Squadra" : "Sistema";

                  if (msg.message_type === "matchday") {
                    return <MatchdayDivider key={msg.id} number={msg.matchday_number ?? 0} />;
                  }

                  if (msg.message_type === "lineup_notification") {
                    return (
                      <LineupNotification
                        key={msg.id}
                        teamName={msg.team_name ?? teamName}
                        onClick={() => router.push("/live")}
                      />
                    );
                  }

                  return (
                    <MessageBubble
                      key={msg.id}
                      message={msg}
                      teamName={teamName}
                      isOwn={isOwn}
                      showHeader={showHeader}
                      members={members}
                      leagueId={leagueId}
                    />
                  );
                })}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Autocomplete */}
      {showAutocomplete && (
        <div style={autocompleteStyle}>
          {autoState.step === "teams" && (
            <>
              <div style={autoHeaderStyle}>Seleziona squadra</div>
              {members.filter(m => m.user_id !== currentUserId).map((m) => (
                <button key={m.user_id} onClick={() => selectTeam(m)} style={autoItemStyle}>
                  <div style={autoAvatarStyle}>{m.team_name.charAt(0)}</div>
                  <span style={{ fontSize: 14, color: "#111827", fontWeight: 500 }}>{m.team_name}</span>
                </button>
              ))}
            </>
          )}

          {autoState.step === "team_options" && autoState.selectedTeam && (
            <>
              <div style={autoHeaderStyle}>{autoState.selectedTeam.team_name}</div>

              {/* Opzione: formazione completa */}
              <button
                onClick={() => insertTeamMention(autoState.selectedTeam!)}
                style={{ ...autoItemStyle, borderBottom: "1px solid #f3f4f6" }}
              >
                <span style={{ fontSize: 16 }}>📋</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>Formazione completa</div>
                  <div style={{ fontSize: 11, color: "#6b7280" }}>Mostra tutti i giocatori e punteggi</div>
                </div>
              </button>

              {/* Singoli giocatori */}
              {(autoState.players ?? []).map((p) => {
                const rc = ROLE_COLORS[p.role] ?? { bg: "#f3f4f6", color: "#666" };
                return (
                  <button
                    key={p.name}
                    onClick={() => insertPlayerMention(autoState.selectedTeam!, p)}
                    style={autoItemStyle}
                  >
                    <div style={{ width: 22, height: 22, borderRadius: 5, background: rc.bg, color: rc.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700 }}>{p.role}</div>
                    <span style={{ fontSize: 14, color: "#111827" }}>{p.name}</span>
                    <span style={{ marginLeft: "auto", fontSize: 13, fontWeight: 700, color: (p.points ?? 0) > 0 ? "#15803d" : (p.points ?? 0) < 0 ? "#c2410c" : "#6b7280" }}>
                      {p.points != null ? signedFmt(p.points) : "—"}
                    </span>
                  </button>
                );
              })}

              <button onClick={() => setAutoState({ step: "teams" })} style={{ ...autoItemStyle, color: "#6b7280", fontSize: 13 }}>
                ← Indietro
              </button>
            </>
          )}
        </div>
      )}

      {/* Input */}
      <div style={inputAreaStyle}>
        <div style={inputWrapStyle}>
          <textarea
            ref={inputRef}
            value={inputText}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Scrivi... usa @ per menzionare"
            rows={1}
            style={textareaStyle}
          />
        </div>
        <button
          onClick={handleSend}
          disabled={!inputText.trim() || sending}
          style={{
            ...sendBtnStyle,
            background: inputText.trim() ? "linear-gradient(135deg,#16A34A,#15803D)" : "#E5E7EB",
            boxShadow: inputText.trim() ? "0 2px 8px rgba(22,163,74,0.3)" : "none",
            cursor: inputText.trim() ? "pointer" : "default",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13" stroke={inputText.trim() ? "white" : "#9CA3AF"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ─── SUB-COMPONENTS ───────────────────────────────────────────────────────────

function MatchdayDivider({ number }: { number: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0 12px", padding: "0 4px" }}>
      <div style={{ flex: 1, height: 2, background: "linear-gradient(to right, transparent, #16A34A)" }} />
      <div style={{ background: "#16A34A", color: "white", fontSize: 12, fontWeight: 700, padding: "4px 14px", borderRadius: 20, letterSpacing: "0.05em", textTransform: "uppercase", whiteSpace: "nowrap", boxShadow: "0 2px 8px rgba(22,163,74,0.3)" }}>
        ⚽ Giornata {number}
      </div>
      <div style={{ flex: 1, height: 2, background: "linear-gradient(to left, transparent, #16A34A)" }} />
    </div>
  );
}

function LineupNotification({ teamName, onClick }: { teamName: string; onClick: () => void }) {
  return (
    <div style={{ display: "flex", justifyContent: "center", margin: "4px 0" }}>
      <button onClick={onClick} style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 20, padding: "5px 14px", fontSize: 12, color: "#6b7280", display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontFamily: "inherit" }}>
        👕
        <span><b style={{ color: "#111827" }}>{teamName}</b> ha caricato la formazione</span>
      </button>
    </div>
  );
}

function DateDivider({ date }: { date: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "10px 0" }}>
      <div style={{ flex: 1, height: 1, background: "#E5E7EB" }} />
      <span style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600, background: "#F9FAFB", padding: "0 6px" }}>{date}</span>
      <div style={{ flex: 1, height: 1, background: "#E5E7EB" }} />
    </div>
  );
}

function MessageBubble({ message, teamName, isOwn, showHeader, members, leagueId }: {
  message: ChatMessage; teamName: string; isOwn: boolean; showHeader: boolean;
  members: LeagueMember[]; leagueId: string;
}) {
  const content = message.content ?? "";
  const mentionsData = (message.mentions_data ?? []) as MentionData[];

  // Parse e render contenuto con menzioni
  const renderContent = () => {
    // Trova token @team:uid:name e @player:uid:name
    const parts = content.split(/(@(?:team|player):[^:\s]+:[^\s]+)/g);

    return parts.map((part, i) => {
      const teamMatch = part.match(/^@team:([^:]+):(.+)$/);
      if (teamMatch) {
        const [, uid, name] = teamMatch;
        return (
          <span key={i} style={{ background: isOwn ? "rgba(255,255,255,0.2)" : "#DCFCE7", color: isOwn ? "white" : "#15803D", borderRadius: 4, padding: "1px 5px", fontWeight: 600 }}>
            @{name}
          </span>
        );
      }

      const playerMatch = part.match(/^@player:([^:]+):(.+)$/);
      if (playerMatch) {
        const [, uid, name] = playerMatch;
        return (
          <span key={i} style={{ background: isOwn ? "rgba(255,255,255,0.2)" : "#DCFCE7", color: isOwn ? "white" : "#15803D", borderRadius: 4, padding: "1px 5px", fontWeight: 600 }}>
            @{name}
          </span>
        );
      }

      return part;
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: isOwn ? "row-reverse" : "row", alignItems: "flex-end", gap: 8, marginBottom: 6, padding: "0 4px" }}>
      {/* Avatar */}
      {!isOwn && (
        <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg, #16A34A, #F97316)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 11, fontWeight: 700, flexShrink: 0, opacity: showHeader ? 1 : 0 }}>
          {teamName.charAt(0).toUpperCase()}
        </div>
      )}

      <div style={{ maxWidth: "80%", minWidth: 60 }}>
        {/* Nome */}
        {!isOwn && showHeader && (
          <div style={{ fontSize: 11, fontWeight: 700, color: "#374151", marginBottom: 3, paddingLeft: 2 }}>{teamName}</div>
        )}

        {/* Bubble */}
        <div style={{
          background: isOwn ? "linear-gradient(135deg, #16A34A, #15803D)" : "white",
          color: isOwn ? "white" : "#1F2937",
          borderRadius: isOwn ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
          padding: "8px 12px", fontSize: 14, lineHeight: 1.5,
          boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
          border: isOwn ? "none" : "1px solid #F3F4F6",
          wordBreak: "break-word",
        }}>
          {renderContent()}
        </div>

        {/* Mention cards sotto la bubble */}
        {mentionsData.map((m, idx) => (
          <div key={idx} style={{ marginTop: 6, ...(isOwn ? { marginLeft: "auto" } : {}) }}>
            {m.type === "team" && m.players && (
              <TeamCard teamName={m.team_name} players={m.players} total={m.total ?? 0} />
            )}
            {m.type === "player" && (
              <PlayerCard name={m.player_name ?? "—"} role={m.player_role ?? ""} team={m.player_team ?? ""} points={m.player_points ?? null} />
            )}
          </div>
        ))}

        {/* Timestamp */}
        <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 3, textAlign: isOwn ? "right" : "left", paddingLeft: isOwn ? 0 : 2, paddingRight: isOwn ? 2 : 0 }}>
          {formatTime(message.created_at)}
        </div>
      </div>
    </div>
  );
}

function TeamCard({ teamName, players, total }: { teamName: string; players: { role: string; name: string; points: number | null }[]; total: number }) {
  return (
    <div style={{ background: "white", borderRadius: 10, border: "1px solid #E5E7EB", overflow: "hidden", maxWidth: 260 }}>
      <div style={{ background: "linear-gradient(135deg,#1a5c2e,#2d7a45)", padding: "7px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: "white", fontSize: 12, fontWeight: 700 }}>📋 {teamName}</span>
      </div>
      <div style={{ padding: "8px 10px" }}>
        {players.map((p, i) => {
          const rc = ROLE_COLORS[p.role] ?? { bg: "#f3f4f6", color: "#666" };
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", borderBottom: i < players.length - 1 ? "1px solid #F3F4F6" : "none" }}>
              <span style={{ width: 20, height: 20, borderRadius: 4, background: rc.bg, color: rc.color, fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{p.role}</span>
              <span style={{ flex: 1, fontSize: 13, color: "#111827" }}>{p.name}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: (p.points ?? 0) > 0 ? "#15803d" : (p.points ?? 0) < 0 ? "#c2410c" : "#6b7280" }}>
                {p.points != null ? signedFmt(p.points) : "—"}
              </span>
            </div>
          );
        })}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6, paddingTop: 6, borderTop: "1.5px solid #E5E7EB" }}>
          <span style={{ fontSize: 11, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>Totale</span>
          <span style={{ fontSize: 15, fontWeight: 800, color: total > 0 ? "#15803d" : total < 0 ? "#c2410c" : "#6b7280" }}>{signedFmt(total)}</span>
        </div>
      </div>
    </div>
  );
}

function PlayerCard({ name, role, team, points }: { name: string; role: string; team: string; points: number | null }) {
  const rc = ROLE_COLORS[role] ?? { bg: "#f3f4f6", color: "#666" };
  return (
    <div style={{ background: "white", borderRadius: 10, border: "1px solid #E5E7EB", overflow: "hidden", maxWidth: 220 }}>
      <div style={{ padding: "10px 12px", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 28, height: 28, borderRadius: 6, background: rc.bg, color: rc.color, fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{role}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{name}</div>
          <div style={{ fontSize: 11, color: "#6B7280" }}>{roleLabel(role)} · {team}</div>
        </div>
        <div style={{ fontSize: 18, fontWeight: 800, color: (points ?? 0) > 0 ? "#15803d" : (points ?? 0) < 0 ? "#c2410c" : "#6b7280", flexShrink: 0 }}>
          {points != null ? signedFmt(points) : "—"}
        </div>
      </div>
    </div>
  );
}

// ─── DATA FETCHING ────────────────────────────────────────────────────────────

async function fetchTeamLineup(leagueId: string, userId: string): Promise<LineupPlayer[]> {
  // Trova la giornata open
  const { data: leagueRow } = await supabase
    .from("leagues").select("season_id").eq("id", leagueId).single();

  if (!leagueRow?.season_id) return [];

  const { data: md } = await supabase
    .from("matchdays")
    .select("id")
    .eq("season_id", leagueRow.season_id)
    .in("status", ["open", "completed", "locked"])
    .order("number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!md) return [];

  const { data: lineup } = await supabase
    .from("lineups")
    .select(`
      lineup_players(
        role,
        real_players!inner(name, team),
        scores!left(points)
      )
    `)
    .eq("league_id", leagueId)
    .eq("matchday_id", md.id)
    .eq("user_id", userId)
    .maybeSingle();

  if (!lineup) return [];

  return ((lineup as any).lineup_players ?? []).map((lp: any) => ({
    role: lp.role,
    name: lp.real_players?.name ?? "—",
    points: lp.scores?.[0]?.points != null ? Number(lp.scores[0].points) : null,
  }));
}

async function resolveMentions(
  text: string, leagueId: string, members: LeagueMember[]
): Promise<MentionData[]> {
  const mentions: MentionData[] = [];

  // Trova @team:uid:name
  const teamMatches = text.matchAll(/@team:([^:]+):([^\s]+)/g);
  for (const match of teamMatches) {
    const uid = match[1];
    const name = match[2];
    const players = await fetchTeamLineup(leagueId, uid);
    const total = players.reduce((s, p) => s + (p.points ?? 0), 0);
    mentions.push({ type: "team", team_name: name, players, total });
  }

  // Trova @player:uid:name
  const playerMatches = text.matchAll(/@player:([^:]+):([^\s]+)/g);
  for (const match of playerMatches) {
    const uid = match[1];
    const playerName = match[2];
    const lineup = await fetchTeamLineup(leagueId, uid);
    const player = lineup.find(p => p.name === playerName);
    const member = members.find(m => m.user_id === uid);

    mentions.push({
      type: "player",
      team_name: member?.team_name ?? "—",
      player_name: playerName,
      player_role: player?.role ?? "",
      player_team: "", // could be fetched if needed
      player_points: player?.points ?? null,
    });
  }

  return mentions;
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function shouldShowHeader(msg: ChatMessage, prev?: ChatMessage): boolean {
  if (!prev) return true;
  if (prev.message_type !== "text") return true;
  if (prev.user_id !== msg.user_id) return true;
  const diff = new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime();
  return diff > 5 * 60 * 1000;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Oggi";
  if (d.toDateString() === yesterday.toDateString()) return "Ieri";
  return d.toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
}

function signedFmt(n: number): string {
  const v = Math.round(n * 10) / 10;
  if (v > 0) return `+${String(v).replace(".", ",")}`;
  return String(v).replace(".", ",");
}

function roleLabel(role: string) {
  if (role === "P") return "Portiere";
  if (role === "D") return "Difensore";
  if (role === "C") return "Centrocampista";
  if (role === "A") return "Attaccante";
  return role;
}

// ─── STILI ────────────────────────────────────────────────────────────────────

const headerStyle: React.CSSProperties = {
  background: "white", borderBottom: "1px solid #E5E7EB",
  padding: "12px 16px", display: "flex", alignItems: "center",
  gap: 10, flexShrink: 0,
};

const autocompleteStyle: React.CSSProperties = {
  position: "absolute", bottom: 72, left: 10, right: 10,
  background: "white", borderRadius: 12, border: "1px solid #E5E7EB",
  boxShadow: "0 -4px 20px rgba(0,0,0,0.1)", overflow: "hidden",
  maxHeight: 300, overflowY: "auto", zIndex: 10,
};

const autoHeaderStyle: React.CSSProperties = {
  padding: "8px 12px", fontSize: 11, color: "#9CA3AF", fontWeight: 600,
  borderBottom: "1px solid #F3F4F6", letterSpacing: "0.05em", textTransform: "uppercase",
};

const autoItemStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 10, width: "100%",
  padding: "10px 12px", background: "none", border: "none",
  cursor: "pointer", textAlign: "left", borderBottom: "1px solid #F9FAFB",
  fontFamily: "inherit",
};

const autoAvatarStyle: React.CSSProperties = {
  width: 28, height: 28, borderRadius: 8,
  background: "linear-gradient(135deg,#16A34A,#F97316)",
  display: "flex", alignItems: "center", justifyContent: "center",
  color: "white", fontSize: 12, fontWeight: 700,
};

const inputAreaStyle: React.CSSProperties = {
  background: "white", borderTop: "1px solid #E5E7EB",
  padding: "10px 12px", display: "flex", gap: 10,
  alignItems: "flex-end", flexShrink: 0,
};

const inputWrapStyle: React.CSSProperties = {
  flex: 1, background: "#F9FAFB", borderRadius: 22,
  border: "1.5px solid #E5E7EB", padding: "10px 14px",
};

const textareaStyle: React.CSSProperties = {
  width: "100%", border: "none", outline: "none",
  background: "transparent", fontSize: 14, color: "#111827",
  resize: "none", fontFamily: "inherit", lineHeight: 1.4,
  maxHeight: 80, overflowY: "auto",
};

const sendBtnStyle: React.CSSProperties = {
  width: 42, height: 42, borderRadius: "50%",
  border: "none", display: "flex", alignItems: "center",
  justifyContent: "center", flexShrink: 0,
  transition: "all 0.2s",
};