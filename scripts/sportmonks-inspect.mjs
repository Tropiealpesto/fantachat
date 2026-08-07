import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const envPath = resolve(process.cwd(), ".env.local");

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

const env = { ...readLocalEnv(envPath), ...process.env };
const token = env.SPORTMONKS_API_TOKEN;
const baseUrl = "https://api.sportmonks.com/v3/football";

if (!token) {
  console.error("Manca SPORTMONKS_API_TOKEN in .env.local.");
  process.exit(1);
}

async function request(path, params = {}) {
  const url = new URL(baseUrl + path);
  url.searchParams.set("api_token", token);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url);
  const text = await response.text();
  let json;

  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }

  return {
    ok: response.ok,
    status: response.status,
    endpoint: path,
    params,
    body: json,
  };
}

function summarize(name, result) {
  const data = result.body?.data;
  const rows = Array.isArray(data) ? data : data ? [data] : [];

  return {
    name,
    ok: result.ok,
    status: result.status,
    count: rows.length,
    sample_keys: rows[0] ? Object.keys(rows[0]) : [],
    sample: rows.slice(0, 3),
    pagination: result.body?.pagination ?? null,
    rate_limit: result.body?.rate_limit ?? null,
    errors: result.body?.errors ?? result.body?.message ?? null,
  };
}

function rowsOf(summary) {
  return Array.isArray(summary?.sample) ? summary.sample : [];
}

function findNestedFixtures(scheduleRows) {
  const fixtures = [];

  for (const stage of scheduleRows) {
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

function usefulFixture(fixtures) {
  return (
    fixtures.find((fixture) => Number(fixture.state_id) === 5) ??
    fixtures.find((fixture) => Number(fixture.state_id) >= 5) ??
    fixtures.find((fixture) => fixture.starting_at) ??
    fixtures[0]
  );
}

function lastFinishedSeason(seasons = []) {
  return [...seasons]
    .filter((season) => season.finished)
    .sort((a, b) => String(b.ending_at ?? "").localeCompare(String(a.ending_at ?? "")))[0];
}

const checks = [
  ["leagues", "/leagues", { per_page: "10" }],
  ["search_serie_a", "/leagues/search/serie a", { include: "seasons", per_page: "10" }],
  ["search_champions", "/leagues/search/champions league", { include: "seasons", per_page: "10" }],
  ["search_coppa_italia", "/leagues/search/coppa italia", { include: "seasons", per_page: "10" }],
  ["fixtures_today", `/fixtures/date/${new Date().toISOString().slice(0, 10)}`, {
    include: "participants;scores;state",
    per_page: "10",
  }],
];

const output = [];

for (const [name, path, params] of checks) {
  output.push(summarize(name, await request(path, params)));
}

const serieA = output
  .find((item) => item.name === "search_serie_a")
  ?.sample?.find((league) => /serie a/i.test(league.name ?? ""));

if (serieA?.id) {
  const serieAFull = summarize(
    "serie_a_with_current_season",
    await request(`/leagues/${serieA.id}`, { include: "currentSeason;seasons", per_page: "10" })
  );

  output.push(serieAFull);

  const serieAData = rowsOf(serieAFull)[0];
  const currentSeason = serieAData?.currentseason ?? serieAData?.seasons?.find((season) => season.is_current);
  const seasonId = currentSeason?.id;

  if (seasonId) {
    output.push(
      summarize(
        "serie_a_teams_current_season",
        await request(`/teams/seasons/${seasonId}`, { include: "coaches.coach;players.player;players.position", per_page: "50" })
      )
    );

    const schedule = summarize(
      "serie_a_schedule_current_season",
      await request(`/schedules/seasons/${seasonId}`)
    );
    output.push(schedule);

    const fixtures = findNestedFixtures(rowsOf(schedule));
    const fixture = usefulFixture(fixtures);

    output.push({
      name: "serie_a_schedule_flattened",
      ok: true,
      status: 200,
      count: fixtures.length,
      sample_keys: fixtures[0] ? Object.keys(fixtures[0]) : [],
      sample: fixtures.slice(0, 5),
      pagination: null,
      rate_limit: null,
      errors: null,
    });

    if (fixture?.id) {
      output.push(
        summarize(
          "serie_a_fixture_detail_current_sample",
          await request(`/fixtures/${fixture.id}`, {
            include: "participants;scores;state;lineups.details.type;events;statistics.type;formations;coaches",
          })
        )
      );
    }
  }

  const finishedSeason = lastFinishedSeason(serieAData?.seasons ?? []);
  const finishedSeasonId = finishedSeason?.id;

  if (finishedSeasonId) {
    const finishedSchedule = summarize(
      "serie_a_schedule_last_finished_season",
      await request(`/schedules/seasons/${finishedSeasonId}`)
    );
    output.push(finishedSchedule);

    const finishedFixtures = findNestedFixtures(rowsOf(finishedSchedule));
    const finishedFixture = usefulFixture(finishedFixtures);

    output.push({
      name: "serie_a_last_finished_flattened",
      ok: true,
      status: 200,
      count: finishedFixtures.length,
      sample_keys: finishedFixtures[0] ? Object.keys(finishedFixtures[0]) : [],
      sample: finishedFixtures.slice(-5),
      pagination: null,
      rate_limit: null,
      errors: null,
    });

    if (finishedFixture?.id) {
      output.push(
        summarize(
          "serie_a_fixture_detail_finished_sample",
          await request(`/fixtures/${finishedFixture.id}`, {
            include: "participants;scores;state;lineups.details.type;events;statistics.type;formations;coaches",
          })
        )
      );
    }
  }
}

const outPath = resolve(process.cwd(), "sportmonks-output.json");
writeFileSync(outPath, JSON.stringify(output, null, 2));

console.log(`Creato ${outPath}`);
console.log(JSON.stringify(output.map(({ name, ok, status, count, sample_keys, errors }) => ({ name, ok, status, count, sample_keys, errors })), null, 2));
