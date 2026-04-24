// lib/chatHelpers.ts
// Funzioni di supporto per la chat

import { supabase } from './supabaseClient'; // adatta al tuo path
import type { ChatMessage, SendMessagePayload, LineupData } from './chat';

// ─── FETCH messaggi (ultimi 100) ───────────────────────────────────────────
export async function fetchMessages(leagueId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('league_id', leagueId)
    .order('created_at', { ascending: true })
    .limit(100);

  if (error) {
    console.error('Errore fetch messaggi:', error);
    return [];
  }
  return data as ChatMessage[];
}

// ─── INVIA messaggio testo ─────────────────────────────────────────────────
export async function sendTextMessage(
  payload: Omit<SendMessagePayload, 'message_type'> & { content: string }
): Promise<void> {
  // Estrai menzioni @NomeSquadra dal testo
  const mentions = extractMentions(payload.content);

  const { error } = await supabase.from('chat_messages').insert({
    ...payload,
    message_type: 'text',
    mentions,
  });

  if (error) throw error;
}

// ─── INVIA card formazione (chiamata automatica quando si salva la rosa) ───
export async function sendLineupMessage(
  leagueId: string,
  teamId: string,
  teamName: string,
  lineupData: LineupData
): Promise<void> {
  const { error } = await supabase.from('chat_messages').insert({
    league_id: leagueId,
    team_id: teamId,
    team_name: teamName,
    message_type: 'lineup',
    lineup_data: lineupData,
    content: null,
    mentions: [],
  });

  if (error) throw error;
}

// ─── INVIA divisore nuova giornata (chiamata da admin quando apre giornata) ─
export async function sendMatchdayDivider(
  leagueId: string,
  matchdayNumber: number
): Promise<void> {
  const { error } = await supabase.from('chat_messages').insert({
    league_id: leagueId,
    team_id: null,
    team_name: 'Sistema',
    message_type: 'matchday',
    matchday_number: matchdayNumber,
    content: null,
    mentions: [],
  });

  if (error) throw error;
}

// ─── UTILITY: estrai menzioni dal testo ──────────────────────────────────
export function extractMentions(text: string): string[] {
  const regex = /@([\w\s]+?)(?=\s@|\s[^@\w]|$)/g;
  const matches: string[] = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    matches.push(match[1].trim());
  }
  return [...new Set(matches)];
}

// ─── UTILITY: formatta timestamp ──────────────────────────────────────────
export function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

export function formatDate(isoString: string): string {
  const date = new Date(isoString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Oggi';
  if (date.toDateString() === yesterday.toDateString()) return 'Ieri';
  return date.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
}

// ─── UTILITY: colore ruolo ────────────────────────────────────────────────
export function getRoleColor(role: 'P' | 'D' | 'C' | 'A'): string {
  const colors = {
    P: '#F59E0B',  // amber
    D: '#10B981',  // green
    C: '#3B82F6',  // blue
    A: '#EF4444',  // red
  };
  return colors[role];
}

// ─── UTILITY: colore voto ─────────────────────────────────────────────────
export function getVoteColor(vote: number): string {
  if (vote > 0) return '#10B981'; // verde
  if (vote < 0) return '#EF4444'; // rosso
  return '#9CA3AF';               // grigio
}

export function formatVote(vote: number): string {
  if (vote > 0) return `+${vote}`;
  return `${vote}`;
}