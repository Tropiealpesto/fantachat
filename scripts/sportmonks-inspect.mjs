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

const checks = [
  ["leagues", "/leagues", { per_page: "10" }],
  ["search_serie_a", "/leagues/search/serie a", { include: "seasons", per_page: "10" }],
  ["search_champions", "/leagues/search/champions league", { include: "seasons", per_page: "10" }],
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
  output.push(
    summarize(
      "serie_a_with_current_season",
      await request(`/leagues/${serieA.id}`, { include: "currentSeason;seasons", per_page: "10" })
    )
  );
}

const outPath = resolve(process.cwd(), "sportmonks-output.json");
writeFileSync(outPath, JSON.stringify(output, null, 2));

console.log(`Creato ${outPath}`);
console.log(JSON.stringify(output.map(({ name, ok, status, count, sample_keys, errors }) => ({ name, ok, status, count, sample_keys, errors })), null, 2));
