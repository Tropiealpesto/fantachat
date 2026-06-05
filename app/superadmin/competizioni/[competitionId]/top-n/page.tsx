"use client";
import { useParams } from "next/navigation"; import AppBar from "../../../../components/AppBar"; import BottomNav from "../../../../components/BottomNav"; import { useRequireSuperAdmin } from "../../../../hooks/useRequireApp";
export default function TopN(){const app=useRequireSuperAdmin();const p=useParams();return <><AppBar league="FantaChat" team="SUPERADMIN" onMenuOpen={app.openDrawer}/><main style={s.container}><div style={s.card}><h1>Top N globale</h1><p>Competition ID: {String(p.competitionId)}</p><p>TODO UI: usare RPC <b>upsert_top_n</b>.</p></div></main><BottomNav/></>}
const s={container:{maxWidth:520,margin:"0 auto",padding:"16px 14px 100px"},card:{background:"white",border:"1px solid #e5e7eb",borderRadius:18,padding:16}} as const;
