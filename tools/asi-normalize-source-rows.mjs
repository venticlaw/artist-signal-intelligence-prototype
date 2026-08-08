#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const DEFAULT_DATE = new Date().toISOString().slice(0, 10);

function usage() {
  return [
    "Usage:",
    "  node tools/asi-normalize-source-rows.mjs --input data/sample-tiktok-approved-export.json --out /tmp/asi-normalized-rows.json --target-id northline-vale --query-orbit genre-scene --query-seed altrap",
    "",
    "Inputs:",
    "  --input JSON array/object rows[] / data[] or CSV from an approved manual/API/vendor export",
    "  --out   Output JSON path for ASI normalized source rows",
    "",
    "Optional defaults:",
    "  --target-id       Applied when an input row has no targetId",
    "  --query-orbit     Applied when an input row has no queryOrbit",
    "  --query-seed      Applied when an input row has no querySeed",
    "  --source-platform Applied when an input row has no sourcePlatform, defaults to TikTok",
    "  --observed-date   Applied when an input row has no observedDate, defaults to today",
    "",
    "This tool normalizes local approved/manual exports only. It does not call TikTok, scrape, authenticate, store credentials, or publish results."
  ].join("\n");
}

function parseArgs(argv) {
  const args = {
    "source-platform": "TikTok",
    "observed-date": DEFAULT_DATE
  };
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
  if (value && Array.isArray(value.rows)) return value.rows;
  if (value && Array.isArray(value.data)) return value.data;
  if (value && value.videos && Array.isArray(value.videos)) return value.videos;
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
  if (path.toLowerCase().endsWith(".csv")) return { rows: parseCsv(text), sourceMeta: { inputFormat: "csv" } };
  const parsed = JSON.parse(text);
  const rows = asArray(parsed);
  if (!rows) throw new Error("--input must be a JSON array, object with rows[] / data[] / videos[], or CSV.");
  return { rows, sourceMeta: parsed.sourceMeta || parsed.meta || { inputFormat: "json" } };
}

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function normalizeDate(value, fallback) {
  const text = String(value || "").trim();
  if (!text) return fallback;
  if (validDate(text)) return text;
  if (/^\d{8}$/.test(text)) return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
  return text;
}

function validEvidenceUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function firstValue(row, keys) {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") return value;
  }
  return "";
}

function normalizeHandle(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  return text.startsWith("@") ? text : `@${text}`;
}

function normalizeHashtags(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => typeof item === "string" ? item : firstValue(item, ["name", "hashtag_name", "hashtagName"]))
      .map((item) => String(item || "").replace(/^#/, "").trim())
      .filter(Boolean)
      .join(",");
  }
  return String(value || "")
    .split(/[\s,]+/)
    .map((item) => item.replace(/^#/, "").trim())
    .filter(Boolean)
    .join(",");
}

function numberValue(value) {
  const cleaned = String(value ?? "")
    .replaceAll(",", "")
    .trim();
  return Number(cleaned || 0) || 0;
}

function normalizeRow(row, index, defaults) {
  if (!row || typeof row !== "object") throw new Error(`Source row ${index + 1} is not an object.`);

  const handle = normalizeHandle(firstValue(row, ["handle", "username", "author", "creator", "account"]));
  const caption = String(firstValue(row, ["caption", "description", "video_description", "videoDescription", "text"])).trim();
  const url = String(firstValue(row, ["url", "videoUrl", "video_url", "share_url", "shareUrl", "embed_link"])).trim();
  const observedDate = normalizeDate(firstValue(row, ["observedDate", "observed_date", "create_date", "createDate", "published_at", "publishedAt"]) || defaults.observedDate, defaults.observedDate);
  const targetId = String(firstValue(row, ["targetId", "target_id"]) || defaults.targetId || "").trim();
  const queryOrbit = String(firstValue(row, ["queryOrbit", "query_orbit"]) || defaults.queryOrbit || "").trim();
  const querySeed = String(firstValue(row, ["querySeed", "query_seed", "keyword", "hashtag_name", "searchTerm"]) || defaults.querySeed || "").trim();

  if (!targetId) throw new Error(`Source row ${index + 1} needs targetId or --target-id.`);
  if (!queryOrbit) throw new Error(`Source row ${index + 1} needs queryOrbit or --query-orbit.`);
  if (!querySeed) throw new Error(`Source row ${index + 1} needs querySeed or --query-seed.`);
  if (!handle) throw new Error(`Source row ${index + 1} needs handle/username.`);
  if (!caption) throw new Error(`${handle} needs caption/description.`);
  if (!validEvidenceUrl(url)) throw new Error(`${handle} needs public http(s) source URL.`);
  if (!validDate(observedDate)) throw new Error(`${handle} needs observedDate as YYYY-MM-DD or create_date as YYYYMMDD.`);

  return {
    targetId,
    queryOrbit,
    querySeed,
    handle,
    displayName: String(firstValue(row, ["displayName", "display_name", "name", "nickname"]) || handle).trim(),
    caption,
    url,
    sourcePlatform: String(firstValue(row, ["sourcePlatform", "source_platform", "platform"]) || defaults.sourcePlatform || "TikTok").trim(),
    soundTitle: String(firstValue(row, ["soundTitle", "sound_title", "sound", "music_title", "musicTitle", "music_id", "musicId"])).trim(),
    hashtags: normalizeHashtags(firstValue(row, ["hashtags", "hashtag_names", "hashtagNames", "challenges"])),
    region: String(firstValue(row, ["region", "region_code", "regionCode", "country"])).trim(),
    observedDate,
    views: numberValue(firstValue(row, ["views", "view_count", "viewCount"])),
    likes: numberValue(firstValue(row, ["likes", "like_count", "likeCount"])),
    comments: numberValue(firstValue(row, ["comments", "comment_count", "commentCount"])),
    shares: numberValue(firstValue(row, ["shares", "share_count", "shareCount"])),
    saves: numberValue(firstValue(row, ["saves", "save_count", "saveCount"])),
    uses: numberValue(firstValue(row, ["uses", "use_count", "useCount", "video_count", "videoCount"]))
  };
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
  if (!validDate(args["observed-date"])) throw new Error("--observed-date must be YYYY-MM-DD.");

  const inputPath = resolve(args.input);
  const outputPath = resolve(args.out);
  const { rows, sourceMeta } = await loadInput(inputPath);
  const normalizedRows = rows.map((row, index) => normalizeRow(row, index, {
    targetId: args["target-id"],
    queryOrbit: args["query-orbit"],
    querySeed: args["query-seed"],
    sourcePlatform: args["source-platform"],
    observedDate: args["observed-date"]
  }));

  const output = {
    updated: new Date().toISOString().slice(0, 10),
    status: "local-safe-normalized-source-rows",
    rowCount: normalizedRows.length,
    sourceMeta,
    policy: {
      liveCollection: "not-performed",
      allowedInput: "manual or approved-provider export",
      scraping: "not-performed",
      credentials: "not-stored",
      publicRealArtistClaims: "not-approved"
    },
    rows: normalizedRows
  };

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({
    status: "ok",
    outputPath,
    rowCount: normalizedRows.length,
    targetIds: [...new Set(normalizedRows.map((row) => row.targetId))],
    querySeeds: [...new Set(normalizedRows.map((row) => row.querySeed))]
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
