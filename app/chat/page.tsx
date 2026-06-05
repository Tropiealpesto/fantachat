"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useRequireApp } from "../hooks/useRequireApp";
import ChatPage from "../components/ChatPage";
import BottomNav from "../components/BottomNav";
type Competition={id:string;name:string;competition_type:string|null};
export default function Chat(){const app=useRequireApp(false);const[competitions,setCompetitions]=useState<Competition[]>([]);useEffect(()=>{if(!app.activeLeagueId)return;supabase.rpc("get_league_competitions",{p_league_id:app.activeLeagueId}).then(({data})=>setCompetitions(((data??[]) as any[]).map(r=>({id:r.id,name:r.name,competition_type:r.competition_type}))));},[app.activeLeagueId]);if(!app.activeLeagueId||!app.userId)return <div style={{display:"grid",placeItems:"center",height:"100dvh",color:"#9ca3af"}}>Caricamento...</div>;return <><div style={{height:"calc(100dvh - 70px)"}}><ChatPage leagueId={app.activeLeagueId} currentUserId={app.userId} currentTeamName={app.teamName} activeLeagueCompetitionId={app.activeLeagueCompetitionId} competitions={competitions}/></div><BottomNav/></>}
