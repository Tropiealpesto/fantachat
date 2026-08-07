import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const SPORTMONKS_SERIE_A_ID = 384;
const SERIE_A_SLUG = "serie-a";
const SPORTMONKS_BASE_URL = "https://api.sportmonks.com/v3/football";

const STAT_TYPES = {
  goals: ["Goals"],
  assists: ["Assists"],
  yellow: ["Yellowcards", "Yellow Cards"],
  red: ["Redcards", "Red Cards"],
  penMissed: ["Penalty Missed", "Penalties Missed"],
  penSaved: ["Penalty Saved", "Penalties Saved"],
  xg: ["Expected Goals (xG)", "Expected Goals"],
  xa: ["Expected Assists (xA)", "Expected Assists"],
  npxg: ["Non-Penalty Expected Goals", "npxG"],
  passesCompleted: ["Accurate Passes", "Successful Passes"],
  passAccuracy: ["Accurate Passes Percentage", "Successful Passes Percentage"],
  tackles: ["Tackles"],
  interceptions: ["Interceptions"],
  saves: ["Saves"],
  possession: ["Ball Possession %"],
};

function readLocalEnv(path) {
  if (!existsSync(path)) return {};

  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1)];
      })
  );
}

const env = { ...readLocalEnv(resolve(process.cwd(), ".env.local")), ...process.env };

for (const key of ["SPORTMONKS_API_TOKEN", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
  if (!env[key]) {
    console.error(`Manca ${key} in .env.local.`);
    process.exit(1);
  }
}

function supabaseJwtRole(key) {
  try {
    const payload = JSON.parse(Buffer.from(key.split(".")[1] ?? "", "base64url").toString("utf8"));
    return payload.role ?? null;
  } catch {
    return null;
  }
}

if (supabaseJwtRole(env.SUPABASE_SERVICE_ROLE_KEY) !== "service_role") {
  console.error("SUPABASE_SERVICE_ROLE_KEY non sembra una service role key valida.");
  process.exit(1);
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

let selectedMatchday = 0;
let statsWindowHoursBefore = 8;
let statsWindowHoursAfter = 3;
let expectedLineupsWindowHours = 72;

async function sportmonks(path, params = {}) {
  const url = new URL(SPORTMONKS_BASE_URL + path);
  url.searchParams.set("api_token", env.SPORTMONKS_API_TOKEN);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url);
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      `Sportmonks ${response.status} ${path}: ${JSON.stringify(body.errors ?? body.message ?? body)}`
    );
  }

  return body.data;
}

async function selectOne(table, lookup, columns = "*") {
  let query = supabase.from(table).select(columns).limit(1);
  for (const [key, value] of Object.entries(lookup)) query = query.eq(key, value);

  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`${table} select: ${error.message}`);
  return data;
}

async function updateById(table, id, values, columns = "*") {
  const { data, error } = await supabase.from(table).update(values).eq("id", id).select(columns).single();
  if (error) throw new Error(`${table} update: ${error.message}`);
  return data;
}

async function insertOne(table, values, columns = "*") {
  const { data, error } = await supabase.from(table).insert(values).select(columns).single();
  if (error) throw new Error(`${table} insert: ${error.message}`);
  return data;
}

async function upsertByLookup(table, lookup, values, columns = "*") {
  const existing = await selectOne(table, lookup, "id");
  if (existing?.id) return updateById(table, existing.id, values, columns);
  return insertOne(table, { ...lookup, ...values }, columns);
}

function flattenFixtures(scheduleRows) {
  const fixtures = [];

  for (const stage of scheduleRows ?? []) {
    for (const round of stage.rounds ?? []) {
      for (const fixture of round.fixtures ?? []) {
        fixtures.push({
          ...fixture,
          stage_name: stage.name ?? null,
          round_name: round.name ?? null,
        });
      }
    }
  }

  return fixtures;
}

function roleFromPosition(position) {
  const name = String(position?.developer_name ?? position?.code ?? position?.name ?? "").toLowerCase();
  if (name.includes("defender")) return "D";
  if (name.includes("midfielder")) return "C";
  if (name.includes("attacker") || name.includes("forward")) return "A";
  return null;
}

function roleFromPositionId(positionId) {
  const id = Number(positionId);
  if (id === 24) return "P";
  if (id === 25) return "D";
  if (id === 26) return "C";
  if (id === 27) return "A";
  return null;
}

function scoreForParticipant(fixture, participantId) {
  return fixture.scores?.find(
    (score) => score.participant_id === participantId && score.description === "CURRENT"
  )?.score?.goals ?? null;
}

function participantByLocation(fixture, location) {
  return fixture.participants?.find((team) => team.meta?.location === location);
}

function fixtureStatus(stateId) {
  const id = Number(stateId);
  if (id === 1) return "scheduled";
  if (id === 2 || id === 3 || id === 22) return "live";
  if (id >= 5) return "completed";
  return "scheduled";
}

function matchdayNumber(fixture) {
  const parsed = Number.parseInt(String(fixture.round_name ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function statValue(details, names) {
  const wanted = names.map((name) => name.toLowerCase());
  const found = details.find((detail) => {
    const type = String(detail.type?.name ?? detail.type?.developer_name ?? "").toLowerCase();
    return wanted.some((name) => type === name || type.includes(name));
  });

  const value = found?.data?.value;
  return typeof value === "number" ? value : Number(value ?? 0) || 0;
}

function eventCount(events, playerId, names) {
  const wanted = names.map((name) => name.toLowerCase());
  return (events ?? []).filter((event) => {
    if (event.player_id !== playerId) return false;
    const type = String(event.type?.name ?? event.type?.developer_name ?? event.info ?? "").toLowerCase();
    return wanted.some((name) => type === name || type.includes(name));
  }).length;
}

function teamStatValue(statistics, participantId, names) {
  const wanted = names.map((name) => name.toLowerCase());
  const found = (statistics ?? []).find((stat) => {
    if (stat.participant_id !== participantId) return false;
    const type = String(stat.type?.name ?? stat.type?.developer_name ?? "").toLowerCase();
    return wanted.some((name) => type === name || type.includes(name));
  });

  const value = found?.data?.value;
  return typeof value === "number" ? value : Number(value ?? 0) || 0;
}

function displayName(person) {
  return person?.display_name ?? person?.common_name ?? person?.name ?? [person?.firstname, person?.lastname].filter(Boolean).join(" ");
}

function imageUrl(...values) {
  const value = values.find((item) => typeof item === "string" && item.trim());
  if (!value || /\/placeholder\.png$/i.test(value)) return null;
  return value;
}

async function ensureSerieA() {
  const league = await sportmonks(`/leagues/${SPORTMONKS_SERIE_A_ID}`, {
    include: "currentSeason;seasons",
  });

  const currentSeason = league.currentseason ?? league.seasons?.find((season) => season.is_current);
  if (!currentSeason?.id) throw new Error("Sportmonks non ha restituito la stagione corrente della Serie A.");

  const competition = await upsertByLookup(
    "competitions",
    { slug: SERIE_A_SLUG },
    {
      name: "Serie A",
      type: "campionato",
      default_total_matchdays: 38,
      theme_key: "campionato",
      active: true,
      sportmonks_league_id: league.id,
    },
    "id,name,slug,sportmonks_league_id"
  );

  const season = await upsertByLookup(
    "seasons",
    { competition_id: competition.id, sportmonks_id: currentSeason.id },
    {
      name: currentSeason.name ?? "Stagione corrente",
      total_matchdays: 38,
      active: true,
    },
    "id,name,sportmonks_id"
  );

  return { league, competition, season };
}

async function importTeamsPlayersAndCoaches(competition, season) {
  const teams = await sportmonks(`/teams/seasons/${season.sportmonks_id}`, {
    include: "coaches.coach;players.player;players.position",
    per_page: "50",
  });

  let teamCount = 0;
  let playerCount = 0;
  let keeperCount = 0;
  let coachCount = 0;

  for (const team of teams ?? []) {
    const realTeam = await upsertByLookup(
      "real_teams",
      { competition_id: competition.id, sportmonks_id: team.id },
      {
        name: team.name,
        country: "Italia",
        logo_url: imageUrl(team.image_path),
        short_code: team.short_code ?? null,
        active: true,
      },
      "id,name,sportmonks_id"
    );

    await upsertByLookup(
      "competition_real_teams",
      { competition_id: competition.id, real_team_id: realTeam.id },
      { active: true },
      "id"
    ).catch(() => null);

    teamCount += 1;

    await upsertByLookup(
      "real_players",
      {
        competition_id: competition.id,
        real_team_id: realTeam.id,
        role: "P",
        source: "sportmonks_team_keeper",
      },
      {
        name: team.name,
        team: team.name,
        active: true,
        sportmonks_id: null,
        sportmonks_team_id: team.id,
        sportmonks_position_id: 24,
        sportmonks_detailed_position_id: null,
        image_url: imageUrl(team.image_path),
      },
      "id"
    );
    keeperCount += 1;

    for (const squadPlayer of team.players ?? []) {
      const role = roleFromPosition(squadPlayer.position);
      const player = squadPlayer.player;
      const name = displayName(player);

      if (!role || !player?.id || !name) continue;

      const realPlayer = await upsertByLookup(
        "real_players",
        { competition_id: competition.id, sportmonks_id: player.id },
        {
          name,
          role,
          team: team.name,
          active: true,
          real_team_id: realTeam.id,
          sportmonks_team_id: team.id,
          sportmonks_position_id: squadPlayer.position_id ?? player.position_id ?? null,
          sportmonks_detailed_position_id: squadPlayer.detailed_position_id ?? player.detailed_position_id ?? null,
          image_url: imageUrl(player.image_path, squadPlayer.image_path),
          source: "sportmonks_player",
        },
        "id"
      );

      await upsertByLookup(
        "competition_players",
        { competition_id: competition.id, real_player_id: realPlayer.id },
        { active: true },
        "id"
      ).catch(() => null);

      playerCount += 1;
    }

    const activeCoach = (team.coaches ?? []).find((item) => item.active) ?? team.coaches?.[0];
    const coach = activeCoach?.coach;
    const coachName = displayName(coach);

    if (coach?.id && coachName) {
      await upsertByLookup(
        "real_coaches",
        { competition_id: competition.id, real_team_id: realTeam.id },
        {
          name: coachName,
          active: true,
          sportmonks_id: coach.id,
          sportmonks_team_id: team.id,
          image_url: imageUrl(coach.image_path, activeCoach.image_path),
        },
        "id"
      );
      coachCount += 1;
    }
  }

  return { teamCount, playerCount, keeperCount, coachCount };
}

async function getOrCreateMatchday(seasonId, number) {
  return upsertByLookup(
    "matchdays",
    { season_id: seasonId, number },
    { status: "open" },
    "id,number,status"
  );
}

async function importFixtures(competition, season) {
  const schedule = await sportmonks(`/schedules/seasons/${season.sportmonks_id}`);
  const fixtures = flattenFixtures(schedule).filter((fixture) => matchdayNumber(fixture));
  let fixtureCount = 0;

  for (const fixture of fixtures) {
    const number = matchdayNumber(fixture);
    await getOrCreateMatchday(season.id, number);

    const home = participantByLocation(fixture, "home");
    const away = participantByLocation(fixture, "away");
    if (!home?.id || !away?.id) continue;

    const homeTeam = await selectOne("real_teams", {
      competition_id: competition.id,
      sportmonks_id: home.id,
    }, "id");
    const awayTeam = await selectOne("real_teams", {
      competition_id: competition.id,
      sportmonks_id: away.id,
    }, "id");

    if (!homeTeam?.id || !awayTeam?.id) continue;

    await upsertByLookup(
      "fixtures",
      { competition_id: competition.id, season_id: season.id, sportmonks_id: fixture.id },
      {
        matchday_number: number,
        home_team_id: homeTeam.id,
        away_team_id: awayTeam.id,
        starts_at: fixture.starting_at ? new Date(`${fixture.starting_at}Z`).toISOString() : null,
        status: fixtureStatus(fixture.state_id),
        sportmonks_state_id: fixture.state_id ?? null,
        home_score: scoreForParticipant(fixture, home.id),
        away_score: scoreForParticipant(fixture, away.id),
        result_info: fixture.result_info ?? null,
        name: fixture.name ?? `${home.name} vs ${away.name}`,
        updated_at: new Date().toISOString(),
      },
      "id"
    );

    fixtureCount += 1;
  }

  return { fixtureCount };
}

async function findTeamBySportmonks(competitionId, sportmonksTeamId) {
  return selectOne("real_teams", { competition_id: competitionId, sportmonks_id: sportmonksTeamId }, "id,name");
}

async function findPlayerBySportmonks(competitionId, sportmonksPlayerId) {
  return selectOne("real_players", { competition_id: competitionId, sportmonks_id: sportmonksPlayerId }, "id,role,real_team_id");
}

async function findKeeperByTeam(competitionId, realTeamId) {
  return selectOne(
    "real_players",
    { competition_id: competitionId, real_team_id: realTeamId, role: "P", source: "sportmonks_team_keeper" },
    "id,role,real_team_id"
  );
}

async function importStatsForFixture(competition, season, fixture) {
  const detail = await sportmonks(`/fixtures/${fixture.sportmonks_id}`, {
    include: "participants;scores;state;lineups.details.type;events.type;statistics.type;formations;coaches",
  });

  const home = participantByLocation(detail, "home");
  const away = participantByLocation(detail, "away");
  if (!home?.id || !away?.id) return { playerStats: 0, keeperStats: 0, coachStats: 0 };

  const homeGoals = scoreForParticipant(detail, home.id);
  const awayGoals = scoreForParticipant(detail, away.id);
  const teamScores = new Map([
    [home.id, { goalsFor: homeGoals ?? 0, goalsAgainst: awayGoals ?? 0 }],
    [away.id, { goalsFor: awayGoals ?? 0, goalsAgainst: homeGoals ?? 0 }],
  ]);

  let playerStats = 0;
  let keeperStats = 0;
  let coachStats = 0;

  for (const lineup of detail.lineups ?? []) {
    const realPlayer = await findPlayerBySportmonks(competition.id, lineup.player_id);
    if (!realPlayer?.id || realPlayer.role === "P") continue;

    const details = lineup.details ?? [];
    const conceded = teamScores.get(lineup.team_id)?.goalsAgainst ?? 0;
    const yellow = statValue(details, STAT_TYPES.yellow) || eventCount(detail.events, lineup.player_id, STAT_TYPES.yellow);
    const red = statValue(details, STAT_TYPES.red) || eventCount(detail.events, lineup.player_id, STAT_TYPES.red);

    await upsertByLookup(
      "player_stats",
      {
        competition_id: competition.id,
        season_id: season.id,
        matchday_number: fixture.matchday_number,
        real_player_id: realPlayer.id,
      },
      {
        goals: statValue(details, STAT_TYPES.goals),
        assists: statValue(details, STAT_TYPES.assists),
        yellow,
        red,
        pen_missed: statValue(details, STAT_TYPES.penMissed),
        pen_saved: statValue(details, STAT_TYPES.penSaved),
        goals_conceded: conceded,
        clean_sheet: conceded === 0,
        xg: statValue(details, STAT_TYPES.xg) || null,
        xa: statValue(details, STAT_TYPES.xa) || null,
        passes_completed: statValue(details, STAT_TYPES.passesCompleted),
        pass_accuracy: statValue(details, STAT_TYPES.passAccuracy) || null,
        tackles: statValue(details, STAT_TYPES.tackles),
        interceptions: statValue(details, STAT_TYPES.interceptions),
        npxg: statValue(details, STAT_TYPES.npxg) || null,
        saves: statValue(details, STAT_TYPES.saves),
        save_pct: null,
        sportmonks_fixture_id: detail.id,
        source: "sportmonks",
        updated_at: new Date().toISOString(),
      },
      "id"
    );

    playerStats += 1;
  }

  for (const participant of [home, away]) {
    const realTeam = await findTeamBySportmonks(competition.id, participant.id);
    if (!realTeam?.id) continue;

    const keeper = await findKeeperByTeam(competition.id, realTeam.id);
    const score = teamScores.get(participant.id);
    const saves = teamStatValue(detail.statistics, participant.id, STAT_TYPES.saves);
    const conceded = score?.goalsAgainst ?? 0;
    const savePct = saves + conceded > 0 ? (saves / (saves + conceded)) * 100 : null;

    if (keeper?.id) {
      await upsertByLookup(
        "player_stats",
        {
          competition_id: competition.id,
          season_id: season.id,
          matchday_number: fixture.matchday_number,
          real_player_id: keeper.id,
        },
        {
          goals: 0,
          assists: 0,
          yellow: 0,
          red: 0,
          pen_missed: 0,
          pen_saved: statValue([], STAT_TYPES.penSaved),
          goals_conceded: conceded,
          clean_sheet: conceded === 0,
          xg: null,
          xa: null,
          passes_completed: 0,
          pass_accuracy: null,
          tackles: 0,
          interceptions: 0,
          npxg: null,
          saves,
          save_pct: savePct,
          sportmonks_fixture_id: detail.id,
          source: "sportmonks",
          updated_at: new Date().toISOString(),
        },
        "id"
      );
      keeperStats += 1;
    }

    const result =
      score.goalsFor > score.goalsAgainst ? "win" :
      score.goalsFor < score.goalsAgainst ? "loss" :
      "draw";

    await upsertByLookup(
      "coach_stats",
      {
        competition_id: competition.id,
        season_id: season.id,
        matchday_number: fixture.matchday_number,
        real_team_id: realTeam.id,
      },
      {
        result,
        npxg: teamStatValue(detail.statistics, participant.id, STAT_TYPES.npxg) || null,
        possession: teamStatValue(detail.statistics, participant.id, STAT_TYPES.possession) || null,
        sportmonks_fixture_id: detail.id,
        updated_at: new Date().toISOString(),
      },
      "id"
    );
    coachStats += 1;
  }

  await upsertByLookup(
    "fixtures",
    { competition_id: competition.id, season_id: season.id, sportmonks_id: detail.id },
    {
      matchday_number: fixture.matchday_number,
      home_team_id: fixture.home_team_id,
      away_team_id: fixture.away_team_id,
      starts_at: fixture.starts_at,
      status: fixtureStatus(detail.state_id),
      sportmonks_state_id: detail.state_id ?? null,
      home_score: homeGoals,
      away_score: awayGoals,
      result_info: detail.result_info ?? null,
      name: detail.name ?? fixture.name,
      updated_at: new Date().toISOString(),
    },
    "id"
  );

  return { playerStats, keeperStats, coachStats };
}

async function importStats(competition, season) {
  let query = supabase
    .from("fixtures")
    .select("id,sportmonks_id,matchday_number,home_team_id,away_team_id,starts_at,name,status")
    .eq("competition_id", competition.id)
    .eq("season_id", season.id)
    .not("sportmonks_id", "is", null);

  if (selectedMatchday > 0) {
    query = query.eq("matchday_number", selectedMatchday);
  } else {
    const from = new Date(Date.now() - statsWindowHoursBefore * 60 * 60 * 1000).toISOString();
    const to = new Date(Date.now() + statsWindowHoursAfter * 60 * 60 * 1000).toISOString();
    query = query.gte("starts_at", from).lte("starts_at", to);
  }

  const { data: fixtures, error } = await query.order("matchday_number", { ascending: true });
  if (error) throw new Error(`fixtures stats select: ${error.message}`);

  const playableFixtures = fixtures ?? [];

  const totals = { fixtures: 0, playerStats: 0, keeperStats: 0, coachStats: 0, recalcs: 0 };

  for (const fixture of playableFixtures) {
    const result = await importStatsForFixture(competition, season, fixture);
    totals.fixtures += 1;
    totals.playerStats += result.playerStats;
    totals.keeperStats += result.keeperStats;
    totals.coachStats += result.coachStats;
  }

  const matchdays = [...new Set(playableFixtures.map((fixture) => fixture.matchday_number))].filter(Boolean);
  for (const number of matchdays) {
    const matchday = await selectOne("matchdays", { season_id: season.id, number }, "id");
    if (!matchday?.id) continue;

    const { data: leagueCompetitions, error: lcError } = await supabase
      .from("league_competitions")
      .select("id")
      .eq("competition_id", competition.id)
      .eq("season_id", season.id)
      .eq("status", "active");

    if (lcError) throw new Error(`league_competitions select: ${lcError.message}`);

    for (const leagueCompetition of leagueCompetitions ?? []) {
      const { error: recalcError } = await supabase.rpc("recalc_competition_matchday", {
        p_league_competition_id: leagueCompetition.id,
        p_matchday_id: matchday.id,
      });
      if (recalcError) throw new Error(`recalc_competition_matchday: ${recalcError.message}`);
      totals.recalcs += 1;
    }
  }

  return totals;
}

function expectedLineupStatus(typeId) {
  const id = Number(typeId);
  if (id === 77614) return "starter";
  if (id === 77615) return "candidate";
  if (id === 11) return "starter";
  if (id === 12) return "substitute";
  return "unknown";
}

async function fixturesForExpectedLineups(competition, season) {
  let query = supabase
    .from("fixtures")
    .select("id,sportmonks_id,matchday_number,starts_at,name")
    .eq("competition_id", competition.id)
    .eq("season_id", season.id)
    .not("sportmonks_id", "is", null);

  if (selectedMatchday > 0) {
    query = query.eq("matchday_number", selectedMatchday);
  } else {
    const from = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    const to = new Date(Date.now() + expectedLineupsWindowHours * 60 * 60 * 1000).toISOString();
    query = query.gte("starts_at", from).lte("starts_at", to);
  }

  const { data, error } = await query.order("starts_at", { ascending: true });
  if (error) throw new Error(`fixtures expected lineups select: ${error.message}`);
  return data ?? [];
}

async function importExpectedLineupsForFixture(competition, season, fixture) {
  const detail = await sportmonks(`/fixtures/${fixture.sportmonks_id}`, {
    include: "expectedLineups",
  });
  const rows = detail.expectedlineups ?? detail.expectedLineups ?? [];
  let count = 0;

  for (const item of rows) {
    if (!item?.team_id || !item?.player_name) continue;

    const realTeam = await findTeamBySportmonks(competition.id, item.team_id);
    const realPlayer = item.player_id
      ? await findPlayerBySportmonks(competition.id, item.player_id)
      : null;

    await upsertByLookup(
      "fixture_expected_lineups",
      {
        competition_id: competition.id,
        season_id: season.id,
        sportmonks_fixture_id: fixture.sportmonks_id,
        sportmonks_team_id: item.team_id,
        sportmonks_player_id: item.player_id ?? null,
        type_id: item.type_id ?? null,
      },
      {
        fixture_id: fixture.id,
        matchday_number: fixture.matchday_number,
        real_team_id: realTeam?.id ?? null,
        real_player_id: realPlayer?.id ?? null,
        player_name: item.player_name,
        jersey_number: item.jersey_number ?? null,
        role: roleFromPositionId(item.position_id),
        sportmonks_position_id: item.position_id ?? null,
        sportmonks_detailed_position_id: item.detailed_position_id ?? null,
        formation_field: item.formation_field ?? null,
        formation_position: item.formation_position ?? null,
        lineup_status: expectedLineupStatus(item.type_id),
        raw: item,
        updated_at: new Date().toISOString(),
      },
      "id"
    );

    count += 1;
  }

  return count;
}

async function importExpectedLineups(competition, season) {
  const fixtures = await fixturesForExpectedLineups(competition, season);
  const totals = { fixtures: fixtures.length, expectedLineups: 0 };

  for (const fixture of fixtures) {
    totals.expectedLineups += await importExpectedLineupsForFixture(competition, season, fixture);
  }

  return totals;
}

export async function runSportmonksSync(options = {}) {
  const onlyCatalog = Boolean(options.catalog);
  const onlyFixtures = Boolean(options.fixtures);
  const onlyStats = Boolean(options.stats);
  const onlyExpectedLineups = Boolean(options.expectedLineups);
  const shouldRunAll = !onlyCatalog && !onlyFixtures && !onlyStats && !onlyExpectedLineups;

  selectedMatchday = Number(options.matchday ?? 0);
  statsWindowHoursBefore = Number(options.statsWindowHoursBefore ?? 8);
  statsWindowHoursAfter = Number(options.statsWindowHoursAfter ?? 3);
  expectedLineupsWindowHours = Number(options.expectedLineupsWindowHours ?? 72);

  const { competition, season } = await ensureSerieA();
  const summary = {
    competition: competition.name,
    season: season.name,
    catalog: null,
    fixtures: null,
    stats: null,
    expectedLineups: null,
  };

  if (shouldRunAll || onlyCatalog) {
    summary.catalog = await importTeamsPlayersAndCoaches(competition, season);
  }

  if (shouldRunAll || onlyFixtures) {
    summary.fixtures = await importFixtures(competition, season);
  }

  if (shouldRunAll || onlyStats) {
    summary.stats = await importStats(competition, season);
  }

  if (onlyExpectedLineups) {
    summary.expectedLineups = await importExpectedLineups(competition, season);
  }

  return summary;
}

function parseCliOptions(argv) {
  const args = new Set(argv);
  return {
    catalog: args.has("--catalog"),
    fixtures: args.has("--fixtures"),
    stats: args.has("--stats"),
    expectedLineups: args.has("--expected-lineups"),
    matchday: Number(argv.find((arg) => arg.startsWith("--matchday="))?.split("=")[1] ?? 0),
  };
}

async function main() {
  const summary = await runSportmonksSync(parseCliOptions(process.argv.slice(2)));
  console.log(JSON.stringify(summary, null, 2));
}

const entrypoint = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";

if (import.meta.url === entrypoint) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
