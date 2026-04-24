'use client';

// components/ChatPage.tsx
// Chat in tempo reale per FantaChat
// Integra: messaggi utente, card formazioni, divisori giornata, @menzioni

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient'; // adatta al tuo path
import {
  fetchMessages,
  sendTextMessage,
  formatTime,
  formatDate,
  getRoleColor,
  getVoteColor,
  formatVote,
  extractMentions,
} from '@/lib/chatHelpers';
import type { ChatMessage, LineupData } from '@/lib/chat';

// ─── PROPS ────────────────────────────────────────────────────────────────
interface ChatPageProps {
  leagueId: string;
  currentTeamId: string;
  currentTeamName: string;
  allTeamNames?: string[]; // per autocomplete @menzioni
}

// ─── SUB-COMPONENTI ───────────────────────────────────────────────────────

// Card formazione compatta
function LineupCard({ data, teamName }: { data: LineupData; teamName: string }) {
  const roles: { key: keyof LineupData; label: 'P' | 'D' | 'C' | 'A'; nameKey: keyof LineupData; voteKey: keyof LineupData }[] = [
    { key: 'gk_name', label: 'P', nameKey: 'gk_name', voteKey: 'gk_vote' },
    { key: 'def_name', label: 'D', nameKey: 'def_name', voteKey: 'def_vote' },
    { key: 'mid_name', label: 'C', nameKey: 'mid_name', voteKey: 'mid_vote' },
    { key: 'fwd_name', label: 'A', nameKey: 'fwd_name', voteKey: 'fwd_vote' },
  ];

  return (
    <div style={{
      background: 'white',
      borderRadius: '10px',
      border: '1px solid #E5E7EB',
      overflow: 'hidden',
      width: '100%',
      maxWidth: '280px',
    }}>
      {/* Header card */}
      <div style={{
        background: 'linear-gradient(135deg, #1a5c2e 0%, #2d7a45 100%)',
        padding: '8px 12px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span style={{ color: 'white', fontSize: '12px', fontWeight: 700 }}>
          📋 {teamName}
        </span>
        <span style={{
          background: 'rgba(255,255,255,0.2)',
          color: 'white',
          fontSize: '11px',
          padding: '2px 6px',
          borderRadius: '4px',
        }}>
          G{data.matchday_number}
        </span>
      </div>

      {/* Giocatori */}
      <div style={{ padding: '8px 10px' }}>
        {roles.map(({ label, nameKey, voteKey }) => {
          const name = data[nameKey] as string;
          const vote = data[voteKey] as number;
          return (
            <div key={label} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '4px 0',
              borderBottom: label !== 'A' ? '1px solid #F3F4F6' : 'none',
            }}>
              {/* Badge ruolo */}
              <span style={{
                width: '20px',
                height: '20px',
                borderRadius: '4px',
                background: getRoleColor(label),
                color: 'white',
                fontSize: '10px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                {label}
              </span>
              {/* Nome giocatore */}
              <span style={{
                flex: 1,
                fontSize: '13px',
                color: '#1F2937',
                fontWeight: 500,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {name}
              </span>
              {/* Voto */}
              <span style={{
                fontSize: '13px',
                fontWeight: 700,
                color: getVoteColor(vote),
                minWidth: '28px',
                textAlign: 'right',
              }}>
                {formatVote(vote)}
              </span>
            </div>
          );
        })}

        {/* Totale */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '6px',
          paddingTop: '6px',
          borderTop: '1.5px solid #E5E7EB',
        }}>
          <span style={{ fontSize: '11px', color: '#6B7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Totale
          </span>
          <span style={{
            fontSize: '15px',
            fontWeight: 800,
            color: getVoteColor(data.total_score),
          }}>
            {formatVote(data.total_score)}
          </span>
        </div>
      </div>
    </div>
  );
}

// Divisore nuova giornata
function MatchdayDivider({ matchdayNumber }: { matchdayNumber: number }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      margin: '20px 0 12px',
      padding: '0 4px',
    }}>
      <div style={{ flex: 1, height: '2px', background: 'linear-gradient(to right, transparent, #16A34A)' }} />
      <div style={{
        background: '#16A34A',
        color: 'white',
        fontSize: '12px',
        fontWeight: 700,
        padding: '4px 14px',
        borderRadius: '20px',
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
        boxShadow: '0 2px 8px rgba(22,163,74,0.3)',
      }}>
        ⚽ Giornata {matchdayNumber}
      </div>
      <div style={{ flex: 1, height: '2px', background: 'linear-gradient(to left, transparent, #16A34A)' }} />
    </div>
  );
}

// Singolo messaggio
function MessageBubble({
  message,
  isOwn,
  showHeader,
}: {
  message: ChatMessage;
  isOwn: boolean;
  showHeader: boolean;
}) {
  // Evidenzia @menzioni nel testo
  const renderContent = (text: string) => {
    const parts = text.split(/(@[\w\s]+?)(?=\s|$)/g);
    return parts.map((part, i) => {
      if (part.startsWith('@')) {
        return (
          <span key={i} style={{
            background: '#DCFCE7',
            color: '#15803D',
            borderRadius: '4px',
            padding: '0 3px',
            fontWeight: 600,
          }}>
            {part}
          </span>
        );
      }
      return part;
    });
  };

  if (message.message_type === 'matchday') {
    return <MatchdayDivider matchdayNumber={message.matchday_number!} />;
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: isOwn ? 'row-reverse' : 'row',
      alignItems: 'flex-end',
      gap: '8px',
      marginBottom: '6px',
      padding: '0 4px',
      animation: 'fadeSlideIn 0.2s ease-out',
    }}>
      {/* Avatar */}
      {!isOwn && (
        <div style={{
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #16A34A, #F97316)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: '11px',
          fontWeight: 700,
          flexShrink: 0,
          marginBottom: '2px',
          opacity: showHeader ? 1 : 0,
        }}>
          {message.team_name.charAt(0).toUpperCase()}
        </div>
      )}

      <div style={{ maxWidth: '75%', minWidth: '60px' }}>
        {/* Nome squadra */}
        {!isOwn && showHeader && (
          <div style={{
            fontSize: '11px',
            fontWeight: 700,
            color: '#374151',
            marginBottom: '3px',
            paddingLeft: '2px',
          }}>
            {message.team_name}
          </div>
        )}

        {/* Contenuto messaggio */}
        {message.message_type === 'lineup' && message.lineup_data ? (
          <LineupCard data={message.lineup_data} teamName={message.team_name} />
        ) : (
          <div style={{
            background: isOwn ? 'linear-gradient(135deg, #16A34A, #15803D)' : 'white',
            color: isOwn ? 'white' : '#1F2937',
            borderRadius: isOwn ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
            padding: '8px 12px',
            fontSize: '14px',
            lineHeight: '1.5',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            border: isOwn ? 'none' : '1px solid #F3F4F6',
            wordBreak: 'break-word',
          }}>
            {renderContent(message.content || '')}
          </div>
        )}

        {/* Timestamp */}
        <div style={{
          fontSize: '10px',
          color: '#9CA3AF',
          marginTop: '3px',
          textAlign: isOwn ? 'right' : 'left',
          paddingLeft: isOwn ? '0' : '2px',
          paddingRight: isOwn ? '2px' : '0',
        }}>
          {formatTime(message.created_at)}
        </div>
      </div>
    </div>
  );
}

// ─── COMPONENTE PRINCIPALE ────────────────────────────────────────────────
export default function ChatPage({
  leagueId,
  currentTeamId,
  currentTeamName,
  allTeamNames = [],
}: ChatPageProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionCursorPos, setMentionCursorPos] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom
  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  // Carica messaggi iniziali
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const msgs = await fetchMessages(leagueId);
      setMessages(msgs);
      setLoading(false);
      setTimeout(() => scrollToBottom(false), 50);
    };
    load();
  }, [leagueId, scrollToBottom]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`chat:${leagueId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `league_id=eq.${leagueId}`,
        },
        (payload) => {
          const newMsg = payload.new as ChatMessage;
          setMessages((prev) => {
            // Evita duplicati
            if (prev.find((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          setTimeout(() => scrollToBottom(), 100);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [leagueId, scrollToBottom]);

  // Gestione input con autocomplete @menzioni
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const pos = e.target.selectionStart || 0;
    setInputText(val);

    // Cerca @ nel testo prima del cursore
    const textBeforeCursor = val.substring(0, pos);
    const atMatch = textBeforeCursor.match(/@(\w*)$/);
    if (atMatch) {
      setMentionSearch(atMatch[1]);
      setMentionCursorPos(pos - atMatch[0].length);
      setShowMentions(true);
    } else {
      setShowMentions(false);
    }
  };

  // Inserisci menzione selezionata
  const insertMention = (teamName: string) => {
    const before = inputText.substring(0, mentionCursorPos);
    const after = inputText.substring(inputText.indexOf(' ', mentionCursorPos) === -1
      ? inputText.length
      : inputText.indexOf(' ', mentionCursorPos));
    const newText = `${before}@${teamName} ${after}`;
    setInputText(newText.trimEnd() + ' ');
    setShowMentions(false);
    inputRef.current?.focus();
  };

  // Filtra team per menzione
  const filteredTeams = allTeamNames.filter((t) =>
    t.toLowerCase().includes(mentionSearch.toLowerCase()) &&
    t !== currentTeamName
  );

  // Invia messaggio
  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || sending) return;

    setSending(true);
    setInputText('');
    setShowMentions(false);

    try {
      await sendTextMessage({
        league_id: leagueId,
        team_id: currentTeamId,
        team_name: currentTeamName,
        content: text,
        mentions: extractMentions(text),
      });
    } catch (err) {
      console.error('Errore invio messaggio:', err);
      setInputText(text); // ripristina se errore
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (showMentions && filteredTeams.length > 0) {
        insertMention(filteredTeams[0]);
      } else {
        handleSend();
      }
    }
    if (e.key === 'Escape') setShowMentions(false);
  };

  // Raggruppa messaggi: mostra header solo se cambia mittente o passa >5min
  const shouldShowHeader = (msg: ChatMessage, prevMsg: ChatMessage | undefined): boolean => {
    if (!prevMsg) return true;
    if (prevMsg.message_type === 'matchday') return true;
    if (prevMsg.team_id !== msg.team_id) return true;
    const diff = new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime();
    return diff > 5 * 60 * 1000;
  };

  // Raggruppa per data
  const groupedMessages = messages.reduce<{ date: string; msgs: ChatMessage[] }[]>(
    (acc, msg) => {
      const date = formatDate(msg.created_at);
      const last = acc[acc.length - 1];
      if (!last || last.date !== date) {
        acc.push({ date, msgs: [msg] });
      } else {
        last.msgs.push(msg);
      }
      return acc;
    },
    []
  );

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: '#F9FAFB',
      position: 'relative',
    }}>
      {/* Keyframe animation */}
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* Header chat */}
      <div style={{
        background: 'white',
        borderBottom: '1px solid #E5E7EB',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        flexShrink: 0,
      }}>
        <div style={{
          width: '36px',
          height: '36px',
          borderRadius: '10px',
          background: 'linear-gradient(135deg, #16A34A, #F97316)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '18px',
        }}>
          💬
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: '15px', color: '#111827' }}>
            Chat Lega
          </div>
          <div style={{ fontSize: '12px', color: '#6B7280' }}>
            {messages.length > 0 ? `${messages.length} messaggi` : 'Nessun messaggio ancora'}
          </div>
        </div>
      </div>

      {/* Feed messaggi */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 10px',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
            <div style={{
              width: '28px', height: '28px',
              borderRadius: '50%',
              border: '3px solid #E5E7EB',
              borderTopColor: '#16A34A',
              animation: 'spin 0.8s linear infinite',
            }} />
          </div>
        ) : messages.length === 0 ? (
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#9CA3AF',
            gap: '12px',
          }}>
            <div style={{ fontSize: '40px' }}>💬</div>
            <div style={{ fontSize: '14px', textAlign: 'center' }}>
              Nessun messaggio ancora.<br />
              Inizia la conversazione!
            </div>
          </div>
        ) : (
          <>
            {groupedMessages.map(({ date, msgs }) => (
              <div key={date}>
                {/* Separatore data */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  margin: '10px 0',
                }}>
                  <div style={{ flex: 1, height: '1px', background: '#E5E7EB' }} />
                  <span style={{
                    fontSize: '11px',
                    color: '#9CA3AF',
                    fontWeight: 600,
                    background: '#F9FAFB',
                    padding: '0 6px',
                  }}>
                    {date}
                  </span>
                  <div style={{ flex: 1, height: '1px', background: '#E5E7EB' }} />
                </div>

                {msgs.map((msg, i) => {
                  const isOwn = msg.team_id === currentTeamId;
                  const prev = i > 0 ? msgs[i - 1] : undefined;
                  const showHeader = shouldShowHeader(msg, prev);

                  return (
                    <MessageBubble
                      key={msg.id}
                      message={msg}
                      isOwn={isOwn}
                      showHeader={showHeader}
                    />
                  );
                })}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Autocomplete menzioni */}
      {showMentions && filteredTeams.length > 0 && (
        <div style={{
          position: 'absolute',
          bottom: '72px',
          left: '10px',
          right: '10px',
          background: 'white',
          borderRadius: '12px',
          border: '1px solid #E5E7EB',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.1)',
          overflow: 'hidden',
          zIndex: 10,
        }}>
          <div style={{
            padding: '8px 12px',
            fontSize: '11px',
            color: '#9CA3AF',
            fontWeight: 600,
            borderBottom: '1px solid #F3F4F6',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
          }}>
            Squadre
          </div>
          {filteredTeams.slice(0, 5).map((team) => (
            <button
              key={team}
              onClick={() => insertMention(team)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                width: '100%',
                padding: '10px 12px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                borderBottom: '1px solid #F9FAFB',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#F0FDF4')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
            >
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #16A34A, #F97316)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '12px',
                fontWeight: 700,
              }}>
                {team.charAt(0)}
              </div>
              <span style={{ fontSize: '14px', color: '#111827', fontWeight: 500 }}>
                @{team}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Input area */}
      <div style={{
        background: 'white',
        borderTop: '1px solid #E5E7EB',
        padding: '10px 12px',
        display: 'flex',
        gap: '10px',
        alignItems: 'flex-end',
        flexShrink: 0,
      }}>
        <div style={{
          flex: 1,
          background: '#F9FAFB',
          borderRadius: '22px',
          border: '1.5px solid #E5E7EB',
          padding: '10px 14px',
          transition: 'border-color 0.2s',
        }}
          onFocus={(e) => {
            const el = e.currentTarget;
            el.style.borderColor = '#16A34A';
            el.style.background = 'white';
          }}
          onBlur={(e) => {
            const el = e.currentTarget;
            el.style.borderColor = '#E5E7EB';
            el.style.background = '#F9FAFB';
          }}
        >
          <textarea
            ref={inputRef}
            value={inputText}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Scrivi un messaggio... usa @squadra per citare"
            rows={1}
            style={{
              width: '100%',
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: '14px',
              color: '#111827',
              resize: 'none',
              fontFamily: 'inherit',
              lineHeight: '1.4',
              maxHeight: '80px',
              overflowY: 'auto',
            }}
          />
        </div>

        {/* Bottone invia */}
        <button
          onClick={handleSend}
          disabled={!inputText.trim() || sending}
          style={{
            width: '42px',
            height: '42px',
            borderRadius: '50%',
            background: inputText.trim()
              ? 'linear-gradient(135deg, #16A34A, #15803D)'
              : '#E5E7EB',
            border: 'none',
            cursor: inputText.trim() ? 'pointer' : 'default',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s',
            flexShrink: 0,
            boxShadow: inputText.trim() ? '0 2px 8px rgba(22,163,74,0.3)' : 'none',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13"
              stroke={inputText.trim() ? 'white' : '#9CA3AF'}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}