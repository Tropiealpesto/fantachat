"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import AppBar from "../components/AppBar";
import BottomNav from "../components/BottomNav";
import { useApp } from "../components/AppContext";
import LoadingScreen from "../components/LoadingScreen";

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

type PlayerRow = {
  id: string;
  name: string;
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
      if (!userId) return router.replace("/login");
      if (!activeLeagueId || !teamId) return router.replace("/seleziona-lega");

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

      const scoreRows = (scores || []) as ScoreRow[];

      if (scoreRows.length === 0) {
        setRows([]);
        setLoading(false);
        return;
      }

      const matchdayIds = [...new Set(scoreRows.map((r) => r.matchday_id))];
      const playerIds = [...new Set(
        scoreRows.flatMap((r) => [
          r.gk_player_id,
          r.def_player_id,
          r.mid_player_id,
          r.fwd_player_id,
        ]).filter(Boolean)
      )] as string[];

      const { data: matchdays, error: mdErr } = await supabase
        .from("matchdays")
        .select("id, number, status")
        .eq("league_id", activeLeagueId)
        .in("id", matchdayIds)
        .order("number", { ascending: true });

      if (mdErr) {
        setErr(mdErr.message);
        setLoading(false);
        return;
      }

      let playerMap = new Map<string, string>();

      if (playerIds.length > 0) {
        const { data: players, error: pErr } = await supabase
          .from("players")
          .select("id, name")
          .in("id", playerIds);

        if (pErr) {
          setErr(pErr.message);
          setLoading(false);
          return;
        }

        (players || []).forEach((p: any) => {
          playerMap.set(String(p.id), String(p.name));
        });
      }

      const mdMap = new Map<string, MatchdayRow>();
      ((matchdays || []) as MatchdayRow[]).forEach((m) => {
        mdMap.set(m.id, m);
      });

      const merged: StoricoCard[] = scoreRows
        .map((r) => {
          const md = mdMap.get(r.matchday_id);
          if (!md) return null;

          return {
            matchday_id: r.matchday_id,
            matchday_number: md.number,
            status: md.status,
            total_score: Number(r.total_score || 0),
            gk_name: r.gk_player_id ? playerMap.get(r.gk_player_id) || "—" : "—",
            gk_vote: r.gk_vote,
            def_name: r.def_player_id ? playerMap.get(r.def_player_id) || "—" : "—",
            def_vote: r.def_vote,
            mid_name: r.mid_player_id ? playerMap.get(r.mid_player_id) || "—" : "—",
            mid_vote: r.mid_vote,
            fwd_name: r.fwd_player_id ? playerMap.get(r.fwd_player_id) || "—" : "—",
            fwd_vote: r.fwd_vote,
          };
        })
        .filter(Boolean) as StoricoCard[];

      merged.sort((a, b) => a.matchday_number - b.matchday_number);

      setRows(merged);
      setLoading
