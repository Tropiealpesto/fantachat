import { NextResponse } from "next/server";
import { supabaseServer } from "../../../lib/supabaseServer";

export async function POST(req: Request) {
  try {
    const { league_id, matchday_id } = await req.json();

    if (!league_id || !matchday_id) {
      return NextResponse.json({ ok: false, error: "Missing league_id or matchday_id" }, { status: 400 });
    }

    // 1) Prendiamo dati “sintesi” dal DB per il prompt
    // Classifica giornata: dalla snapshot (se esiste), altrimenti dai live scores.
    const { data: scoresSnap } = await supabaseServer
      .from("matchday_team_scores")
      .select("team_id,total_score,teams(name)")
      .eq("league_id", league_id)
      .eq("matchday_id", matchday_id);

    // Classifica generale
    const { data: table } = await supabaseServer
      .from("league_table")
      .select("team_id,total_score,teams(name)")
      .eq("league_id", league_id)
      .order("total_score", { ascending: false });

    // Info giornata
    const { data: md } = await supabaseServer
      .from("matchdays")
      .select("number")
      .eq("id", matchday_id)
      .single();

    const matchdayNumber = md?.number ?? null;

    const scores = (scoresSnap ?? [])
      .map((r: any) => ({ team: r.teams?.name ?? "?", score: Number(r.total_score ?? 0) }))
      .sort((a, b) => b.score - a.score);

    const best = scores[0];
    const worst = scores[scores.length - 1];

    const leader = table?.[0]
      ? { team: (table[0] as any).teams?.name ?? "?", total: Number((table[0] as any).total_score ?? 0) }
      : null;

    // 2) Prompt “pro”
    const prompt = `
Sei un giornalista sportivo italiano, ironico ma elegante.
Scrivi un articolo breve (max ~300-450 parole) per il "Giornale FantaChat".

Contesto:
- Giornata: ${matchdayNumber ?? "?"} (campionato 38 giornate)
- Miglior squadra di giornata: ${best ? `${best.team} (${best.score})` : "N/D"}
- Peggior squadra di giornata: ${worst ? `${worst.team} (${worst.score})` : "N/D"}
- Primo in classifica generale: ${leader ? `${leader.team} (Totale ${leader.total})` : "N/D"}

Classifica giornata (top 6 se disponibile):
${scores.slice(0, 6).map((x, i) => `${i + 1}) ${x.team} - ${x.score}`).join("\n")}

Linee guida:
- Titolo in una riga
- 3-5 paragrafi
- Sezione “MVP di giornata” (squadra)
- Sezione “Flop di giornata” (squadra)
- Chiusura con battuta o teaser (“ci vediamo alla prossima…”)
Niente volgarità, niente attacchi personali.
Rispondi in JSON con campi: title, content.
`.trim();

    // 3) Chiamata OpenAI (server-side)
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        messages: [
          { role: "system", content: "Rispondi sempre in JSON valido." },
          { role: "user", content: prompt },
        ],
        temperature: 0.8,
      }),
    });

    if (!r.ok) {
      const text = await r.text();
      return NextResponse.json({ ok: false, error: `OpenAI error: ${text}` }, { status: 500 });
    }

    const json = await r.json();
    const raw = json?.choices?.[0]?.message?.content ?? "{}";

    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // fallback: se non è JSON
      parsed = { title: `Giornale FantaChat – Giornata ${matchdayNumber ?? ""}`.trim(), content: String(raw) };
    }

    const title = String(parsed.title || `Giornale FantaChat – Giornata ${matchdayNumber ?? ""}`).trim();
    const content = String(parsed.content || "").trim();

    if (!content) {
      return NextResponse.json({ ok: false, error: "Empty article content" }, { status: 500 });
    }

    // 4) Salvataggio su Supabase (upsert)
    const { error: upErr } = await supabaseServer
      .from("matchday_articles")
      .upsert(
        { league_id, matchday_id, title, content },
        { onConflict: "league_id,matchday_id" }
      );

    if (upErr) {
      return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, title });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}
