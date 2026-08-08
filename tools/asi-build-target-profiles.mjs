#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

function usage() {
  return [
    "Usage:",
    "  node tools/asi-build-target-profiles.mjs --input data/sample-target-intake.json --out /tmp/target-profiles.json",
    "  node tools/asi-build-target-profiles.mjs --input data/sample-target-intake.csv --out /tmp/target-profiles.json",
    "",
    "Inputs:",
    "  --input JSON array/object with targets[] / profiles[] or CSV with target columns",
    "  --out   Output JSON path for normalized target profiles",
    "",
    "This tool shapes user-provided target artists into ASI target profiles. It does not research, scrape, enrich, authenticate, or publish."
  ].join("\n");
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    const value = argv[index + 1];
    if (key === "--help" || key === "-h") {
      args.help = true;
      continue;
    }
    if (!key.startsWith("--")) throw new Error(`Unexpected argument: ${key}`);
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${key}`);
    args[key.slice(2)] = value;
    index += 1;
  }
  return args;
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value && Array.isArray(value.targets)) return value.targets;
  if (value && Array.isArray(value.profiles)) return value.profiles;
  return null;
}

function parseCsv(text) {
  const rows = [];
  let field = "";
  let row = [];
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (quoted && char === "\"" && next === "\"") {
      field += "\"";
      index += 1;
    } else if (char === "\"") {
      quoted = !quoted;
    } else if (!quoted && char === ",") {
      row.push(field);
      field = "";
    } else if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(field);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  row.push(field);
  if (row.some((cell) => cell.trim())) rows.push(row);
  if (!rows.length) return [];
  const headers = rows[0].map((header) => header.trim());
  return rows.slice(1).map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] || ""])));
}

async function loadInput(path) {
  const text = await readFile(path, "utf8");
  if (path.toLowerCase().endsWith(".csv")) return parseCsv(text);
  const parsed = JSON.parse(text);
  const inputTargets = asArray(parsed);
  if (!inputTargets) throw new Error("--input must be a JSON array, object with targets[] / profiles[], or CSV.");
  return inputTargets;
}

function splitList(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  return String(value || "")
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function safeFileSegment(value) {
  return String(value || "target")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "target";
}

function normalizeTarget(input, index) {
  if (!input || typeof input !== "object") {
    throw new Error(`Target ${index + 1} is not an object.`);
  }
  const name = String(input.name || input.artistName || input.artist || "").trim();
  if (!name) throw new Error(`Target ${index + 1} needs name.`);
  const genreLane = String(input.genreLane || input.genre || "").trim();
  if (!genreLane) throw new Error(`${name} needs genreLane.`);

  const profile = {
    targetId: String(input.targetId || input.id || safeFileSegment(name)).trim(),
    name,
    priority: String(input.priority || "medium").trim().toLowerCase(),
    genreLane,
    regionFocus: splitList(input.regionFocus || input.regions || input.markets),
    similarArtists: splitList(input.similarArtists || input.comparables),
    soundSeeds: splitList(input.soundSeeds || input.sounds || input.songSeeds),
    hashtagSeeds: splitList(input.hashtagSeeds || input.hashtags),
    exclude: splitList(input.exclude || input.disqualifiers),
    reviewGoal: String(input.reviewGoal || "Find adjacent emerging artists with similar audience behavior, sound palette, or scene/community context.").trim(),
    sourceNotes: splitList(input.sourceNotes)
  };

  if (!["high", "medium", "low"].includes(profile.priority)) profile.priority = "medium";
  if (!profile.regionFocus.length) profile.regionFocus = ["US"];
  if (!profile.similarArtists.length && !profile.soundSeeds.length && !profile.hashtagSeeds.length) {
    throw new Error(`${name} needs at least one similar artist, sound seed, or hashtag seed.`);
  }
  if (!profile.exclude.length) {
    profile.exclude = ["major-label established acts", "non-artist creator accounts", "fan pages", "repost-only accounts"];
  }
  return profile;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  if (!args.input || !args.out) {
    throw new Error(`Missing required arguments.\n\n${usage()}`);
  }

  const inputPath = resolve(args.input);
  const outputPath = resolve(args.out);
  const inputTargets = await loadInput(inputPath);
  const profiles = inputTargets.map(normalizeTarget);
  const output = {
    updated: new Date().toISOString().slice(0, 10),
    status: "local-safe-target-profiles",
    profileCount: profiles.length,
    policy: {
      liveCollection: "not-approved",
      enrichment: "not-performed",
      publicRealArtistClaims: "not-approved"
    },
    profiles
  };

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({
    status: "ok",
    outputPath,
    profileCount: profiles.length,
    targetIds: profiles.map((profile) => profile.targetId)
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
