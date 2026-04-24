// types/chat.ts
// Tipi TypeScript per il sistema di chat FantaChat

export type MessageType = 'text' | 'lineup' | 'matchday' | 'standings';

export interface LineupData {
  matchday_number: number;
  gk_name: string;
  gk_vote: number;
  gk_real_team_name?: string;
  def_name: string;
  def_vote: number;
  def_real_team_name?: string;
  mid_name: string;
  mid_vote: number;
  mid_real_team_name?: string;
  fwd_name: string;
  fwd_vote: number;
  fwd_real_team_name?: string;
  total_score: number;
}

export interface ChatMessage {
  id: string;
  league_id: string;
  team_id: string | null;
  team_name: string;
  message_type: MessageType;
  content: string | null;
  lineup_data: LineupData | null;
  matchday_number: number | null;
  mentions: string[];
  created_at: string;
  updated_at: string;
}

export interface SendMessagePayload {
  league_id: string;
  team_id: string;
  team_name: string;
  message_type: MessageType;
  content?: string;
  lineup_data?: LineupData;
  matchday_number?: number;
  mentions?: string[];
}