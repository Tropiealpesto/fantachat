"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import AppBar from "../components/AppBar";
import BottomNav from "../components/BottomNav";
import { useApp } from "../components/AppContext";

type MatchdayRow = {
  id: string;
  number: number;
  status: string;
};

type ScoreRow = {
  matchday_id: string;
  total_score: number | null;
  gk_vote: number | null;
  def_vote: number | null;
  mid_vote: number | null;
  fwd_vote: number | null;
  gk_player_id: string | null;
  def_player_id: string | null;
  mid_player_id: string | null;
  fwd_player_id: string | null;
};

type StoricoCard = {
  matchday_id: string;
  matchday_number: number;
  status: string;
  total_score: number;
  gk_name: string;
  gk_vote: number | null;
  def_name: string;
  def_vote: number | null;
  mid_name: string;
  mid_vote: number | null;
  fwd_name: string;
  fwd_vote: number | null;
};

export default function StoricoPage() {
  const router = useRouter();
  const { ready, userId, activeLeagueId, leagueName, teamId, teamName } = useApp();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<StoricoCard[]>([]);

  const lastCardRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    async function run() {
      if (!ready) return;
      if (!userId) {
        router.replace("/login");
        return;
      }
      if (!activeLeagueId || !teamId) {
        router.replace("/seleziona-lega");
        return;
      }

      setLoading(true);
      setErr(null);

      const { data: scores, error: scoresErr } = await supabase
        .from("matchday_team_scores")
        .select(`
          matchday_id,
          total_score,
          gk_vote,
          def_vote,
          mid_vote,
          fwd_vote,
          gk_player_id,
          def_player_id,
          mid_player_id,
          fwd_player_id
        `)
        .eq("league_id", activeLeagueId)
        .eq("team_id", teamId);

      if (scoresErr) {
        setErr(scoresErr.message);
        setLoading(false);
        return;
      }

      const scoreRows = ((scores || []) as ScoreRow[]) ?? [];

      if (scoreRows.length === 0) {
        setRows([]);
        setLoading(false);
        return;
      }

      const matchdayIds = [...new Set(scoreRows.map((r) => r.matchday_id))];
      const playerIds = [
        ...new Set(
          scoreRows
            .flatMap((r) => [
              r.gk_player_id,
              r.def_player_id,
              r.mid_player_id,
              r.fwd_player_id,
            ])
            .filter(Boolean)
        ),
      ] as string[];

      const { data: matchdays, error: mdErr } = await supabase
        .from("matchdays")
        .select("id, number, status")
