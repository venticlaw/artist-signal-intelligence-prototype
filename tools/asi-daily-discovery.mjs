#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const DEFAULT_DATE = new Date().toISOString().slice(0, 10);

function usage() {
  return [
    "Usage:",
    "  node tools/asi-daily-discovery.mjs --targets data/sample-target-profiles.json --rows data/sample-daily-source-rows.json --out /tmp/asi-run --date 2026-08-08",
    "",
    "Inputs:",
    "  --targets  JSON array or object with profiles[]",
    "  --rows     JSON array/object rows[] or CSV file using the ASI daily row contract",
    "  --out      Output folder for daily artifacts",
    "  --date     Optional YYYY-MM-DD run date, defaults to today",
    "  --state    Optional previous discovery-state.json for new/repeat/delta scoring",
    "  --state-out Optional state output path, defaults to <out>/discovery-state.json",
    "",
    "This tool normalizes approved/manual rows only. It does not call TikTok, scrape, authenticate, store credentials, or publish results."
  ].join("\n");
}

function parseArgs(argv) {
  const args = { date: DEFAULT_DATE };
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
  if (value && Array.isArray(value.profiles)) return value.profiles;
  if (value && Array.isArray(value.rows)) return value.rows;
  if (value && Array.isArray(value.data)) return value.data;
  return null;
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

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function clampScore(value, max) {
  return Math.max(0, Math.min(max, value));
}

function normalizeTargetProfile(profile, index) {
  if (!profile || typeof profile !== "object") {
    throw new Error(`Target profile ${index + 1} is not an object.`);
  }
  const name = String(profile.name || "").trim();
  const targetId = String(profile.targetId || profile.id || safeFileSegment(name)).trim();
  if (!name) throw new Error(`Target profile ${index + 1} needs name.`);
  if (!targetId) throw new Error(`${name} needs targetId.`);
  return {
    targetId,
    name,
    priority: String(profile.priority || "medium").trim(),
    genreLane: String(profile.genreLane || profile.genre || "Unspecified").trim(),
    regionFocus: splitList(profile.regionFocus || profile.regions),
    similarArtists: splitList(profile.similarArtists || profile.comparables),
    soundSeeds: splitList(profile.soundSeeds || profile.sounds),
    hashtagSeeds: splitList(profile.hashtagSeeds || profile.hashtags),
    exclude: splitList(profile.exclude),
    reviewGoal: String(profile.reviewGoal || "Find adjacent emerging artists with similar public signal.").trim()
  };
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

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll("\"", "\"\"")}"` : text;
}

function toCsv(rows, headers) {
  return [
    headers.map(csvEscape).join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","))
  ].join("\n") + "\n";
}

async function loadInput(path) {
  const text = await readFile(path, "utf8");
  if (path.toLowerCase().endsWith(".csv")) return parseCsv(text);
  const parsed = JSON.parse(text);
  const rows = asArray(parsed);
  if (!rows) throw new Error(`${path} must contain a JSON array or an object with profiles[], rows[], or data[].`);
  return rows;
}

function validEvidenceUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function normalizeDiscoveryRow(row, index, runDate) {
  if (!row || typeof row !== "object") throw new Error(`Source row ${index + 1} is not an object.`);
  const handle = String(row.handle || row.username || row.author || "").trim();
  const displayName = String(row.displayName || row.display_name || row.name || handle).trim();
  const caption = String(row.caption || row.description || row.text || "").trim();
  const url = String(row.url || row.videoUrl || row.video_url || "").trim();
  const observedDate = String(row.observedDate || row.observed_date || runDate).trim();
  if (!handle) throw new Error(`Source row ${index + 1} needs handle.`);
  if (!displayName) throw new Error(`${handle} needs displayName.`);
  if (!caption) throw new Error(`${handle} needs caption.`);
  if (!validEvidenceUrl(url)) throw new Error(`${handle} needs public http(s) source URL.`);
  if (!validDate(observedDate)) throw new Error(`${handle} needs observedDate as YYYY-MM-DD.`);
  return {
    targetId: String(row.targetId || row.target_id || "").trim(),
    queryOrbit: String(row.queryOrbit || row.query_orbit || "").trim(),
    querySeed: String(row.querySeed || row.query_seed || "").trim(),
    handle,
    displayName,
    caption,
    url,
    sourcePlatform: String(row.sourcePlatform || row.platform || "TikTok").trim(),
    soundTitle: String(row.soundTitle || row.sound || row.music_id || "").trim(),
    hashtags: String(row.hashtags || "").trim(),
    region: String(row.region || row.region_code || "").trim(),
    observedDate,
    views: Number(row.views || row.view_count || 0) || 0,
    likes: Number(row.likes || row.like_count || 0) || 0,
    comments: Number(row.comments || row.comment_count || 0) || 0,
    shares: Number(row.shares || row.share_count || 0) || 0,
    saves: Number(row.saves || row.save_count || 0) || 0,
    uses: Number(row.uses || row.use_count || 0) || 0
  };
}

function buildTargetQueryPlan(profiles, runDate) {
  return {
    status: "daily-target-query-plan",
    createdAt: runDate,
    cadence: "daily",
    sourcePolicy: "Approved API/vendor/manual rows only. No scraping, no browser automation, no outbound actions.",
    targets: profiles.map((profile) => ({
      targetId: profile.targetId,
      name: profile.name,
      priority: profile.priority,
      reviewGoal: profile.reviewGoal,
      querySets: [
        { orbit: "target-exact", seeds: [profile.name, ...profile.soundSeeds.slice(0, 4)] },
        { orbit: "similar-artist", seeds: profile.similarArtists },
        { orbit: "genre-scene", seeds: [profile.genreLane, ...profile.regionFocus, ...profile.hashtagSeeds] },
        { orbit: "breakout-behavior", seeds: ["original sound", "unreleased snippet", "full version", "new music", "fan comments"] }
      ],
      exclude: profile.exclude
    })),
    rowContract: {
      targetId: "target profile id",
      queryOrbit: "target-exact | similar-artist | genre-scene | breakout-behavior",
      querySeed: "seed term that produced the row",
      handle: "@candidate",
      displayName: "candidate display name",
      caption: "public caption or description",
      url: "https source URL",
      sourcePlatform: "TikTok or approved provider platform",
      soundTitle: "sound title or music id",
      hashtags: "comma-separated hashtags",
      region: "region code or public region context",
      observedDate: "YYYY-MM-DD",
      views: "number",
      likes: "number",
      comments: "number",
      shares: "number",
      saves: "number when available",
      uses: "sound-use count when available"
    }
  };
}

function dedupeSeeds(seeds) {
  const seen = new Set();
  return seeds
    .map((seed) => String(seed || "").trim())
    .filter(Boolean)
    .filter((seed) => {
      const key = seed.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function seedPriority(profile, orbit, seed, index) {
  const priorityBase = { high: 1, medium: 2, low: 3 }[profile.priority.toLowerCase()] || 2;
  const orbitBase = {
    "target-exact": 1,
    "similar-artist": 2,
    "genre-scene": 3,
    "breakout-behavior": 4
  }[orbit] || 5;
  const seedBoost = profile.name.toLowerCase() === seed.toLowerCase() ? 0 : index;
  return priorityBase * 100 + orbitBase * 10 + seedBoost;
}

function buildAnalystSearchWorksheet(queryPlan) {
  return queryPlan.targets.flatMap((target) => {
    const profilePriority = target.priority || "medium";
    return target.querySets.flatMap((querySet) => {
      const seeds = dedupeSeeds(querySet.seeds);
      return seeds.map((seed, index) => ({
        runDate: queryPlan.createdAt,
        targetId: target.targetId,
        targetName: target.name,
        targetPriority: profilePriority,
        queryOrbit: querySet.orbit,
        querySeed: seed,
        searchPriority: seedPriority({ name: target.name, priority: profilePriority }, querySet.orbit, seed, index),
        approvedSourcePath: "manual-public-review-or-approved-provider",
        analystStatus: "not-started",
        rowsCaptured: "",
        strongestCandidate: "",
        notes: "",
        policyReminder: "No scraping, login collection, outbound action, or public real-artist claims."
      }));
    });
  }).sort((a, b) => a.searchPriority - b.searchPriority);
}

function buildApprovedSourceRowTemplate(runDate) {
  return [
    {
      targetId: "",
      queryOrbit: "",
      querySeed: "",
      handle: "",
      displayName: "",
      caption: "",
      url: "",
      sourcePlatform: "TikTok",
      soundTitle: "",
      hashtags: "",
      region: "",
      observedDate: runDate,
      views: "",
      likes: "",
      comments: "",
      shares: "",
      saves: "",
      uses: ""
    }
  ];
}

function tokenSet(items) {
  return new Set(
    items
      .flatMap((item) => String(item || "").toLowerCase().split(/[^a-z0-9$&]+/))
      .map((item) => item.trim())
      .filter((item) => item.length > 2)
  );
}

function rowText(row) {
  return [
    row.targetId,
    row.queryOrbit,
    row.querySeed,
    row.handle,
    row.displayName,
    row.caption,
    row.soundTitle,
    row.hashtags,
    row.region
  ].join(" ").toLowerCase();
}

function scoreTargetFit(row, profile) {
  const profileTokens = tokenSet([
    profile.name,
    profile.genreLane,
    ...profile.regionFocus,
    ...profile.similarArtists,
    ...profile.soundSeeds,
    ...profile.hashtagSeeds
  ]);
  const text = rowText(row);
  const matches = [...profileTokens].filter((token) => text.includes(token)).length;
  const directTarget = row.targetId && row.targetId === profile.targetId ? 6 : 0;
  return clampScore((matches * 3) + directTarget, 20);
}

function scoreStats(rows) {
  return rows.reduce((sum, row) => ({
    views: sum.views + row.views,
    likes: sum.likes + row.likes,
    comments: sum.comments + row.comments,
    shares: sum.shares + row.shares,
    saves: sum.saves + row.saves,
    uses: sum.uses + row.uses
  }), { views: 0, likes: 0, comments: 0, shares: 0, saves: 0, uses: 0 });
}

function candidateKey(targetId, handle) {
  return `${String(targetId || "unmapped").toLowerCase()}::${String(handle || "").toLowerCase()}`;
}

function emptyState() {
  return {
    status: "asi-discovery-run-state",
    version: 1,
    updatedAt: null,
    candidates: {}
  };
}

async function loadState(path) {
  if (!path) return emptyState();
  const parsed = JSON.parse(await readFile(path, "utf8"));
  return {
    ...emptyState(),
    ...parsed,
    candidates: parsed?.candidates && typeof parsed.candidates === "object" ? parsed.candidates : {}
  };
}

function percentChange(current, previous) {
  if (!previous && !current) return 0;
  if (!previous) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

function buildCandidateHistory(candidate, previousState, runDate) {
  const stats = scoreStats(candidate.rows);
  const key = candidateKey(candidate.targetId, candidate.handle);
  const previous = previousState.candidates[key] || null;
  const previousStats = previous?.lastStats || { views: 0, likes: 0, comments: 0, shares: 0, saves: 0, uses: 0 };
  const deltas = {
    views: stats.views - previousStats.views,
    likes: stats.likes - previousStats.likes,
    comments: stats.comments - previousStats.comments,
    shares: stats.shares - previousStats.shares,
    saves: stats.saves - previousStats.saves,
    uses: stats.uses - previousStats.uses
  };
  return {
    key,
    isNewCandidate: !previous,
    firstSeen: previous?.firstSeen || runDate,
    lastSeen: runDate,
    previousSeen: previous?.lastSeen || null,
    runCount: (previous?.runCount || 0) + 1,
    previousStats,
    currentStats: stats,
    deltas,
    growthPct: {
      views: percentChange(stats.views, previousStats.views),
      likes: percentChange(stats.likes, previousStats.likes),
      comments: percentChange(stats.comments, previousStats.comments),
      shares: percentChange(stats.shares, previousStats.shares),
      saves: percentChange(stats.saves, previousStats.saves),
      uses: percentChange(stats.uses, previousStats.uses)
    }
  };
}

function scoreSurgeCandidate(candidate, profiles) {
  const rows = candidate.rows;
  const profile = profiles.find((item) => item.targetId === candidate.targetId) || profiles[0];
  const stats = scoreStats(rows);
  const targetFit = profile ? Math.max(...rows.map((row) => scoreTargetFit(row, profile))) : 0;
  const engagementRate = stats.views ? (stats.likes + stats.comments + stats.shares + stats.saves) / stats.views : 0;
  const absoluteVelocity = clampScore(Math.round(Math.log10(Math.max(1, stats.views)) * 5), 14);
  const history = candidate.history;
  const deltaVelocity = history
    ? clampScore(
      (history.isNewCandidate ? 6 : 0) +
      Math.round(Math.log10(Math.max(1, Math.max(0, history.deltas.views))) * 3) +
      (history.growthPct.views >= 75 ? 5 : history.growthPct.views >= 30 ? 3 : history.growthPct.views > 0 ? 1 : 0),
      20
    )
    : 0;
  const velocity = clampScore(Math.max(absoluteVelocity, deltaVelocity), 20);
  const engagementQuality = clampScore(Math.round(engagementRate * 170) + (stats.comments >= 100 ? 3 : 0) + (stats.shares >= 100 ? 3 : 0), 15);
  const repeatSignal = clampScore((rows.length > 1 ? 8 : 0) + Math.min(7, (candidate.sounds.length + candidate.tags.length)), 15);
  const sourceReliability = clampScore(rows.filter((row) => row.url).length * 4 + rows.filter((row) => row.querySeed).length * 2, 10);
  const novelty = clampScore(
    candidate.handle.toLowerCase().includes(profile?.name.toLowerCase() || "") ? 2 : history?.isNewCandidate ? 10 : 6,
    10
  );
  const catalogValidation = clampScore(rowText(rows[0]).includes("artist") || rowText(rows[0]).includes("music") || rowText(rows[0]).includes("song") ? 7 : 3, 10);
  const score = targetFit + velocity + engagementQuality + repeatSignal + sourceReliability + novelty + catalogValidation;
  const decision = score >= 75 ? "Shortlist" : score >= 55 ? "Daily review" : score >= 35 ? "Watch" : "Ignore";
  return {
    score,
    decision,
    dimensions: {
      targetFit,
      velocity,
      engagementQuality,
      repeatSignal,
      sourceReliability,
      novelty,
      catalogValidation
    },
    stats
  };
}

function clusterRows(rows, profiles, previousState, runDate) {
  const grouped = new Map();
  rows.forEach((row) => {
    const targetId = row.targetId || profiles[0]?.targetId || "unmapped";
    const key = `${targetId}::${row.handle.toLowerCase()}`;
    const current = grouped.get(key) || [];
    current.push({ ...row, targetId });
    grouped.set(key, current);
  });
  return [...grouped.values()].map((candidateRows) => {
    const first = candidateRows[0];
    const tags = [...new Set(candidateRows.flatMap((row) => row.hashtags.split(/[,\s#]+/)).filter(Boolean))].slice(0, 8);
    const sounds = [...new Set(candidateRows.map((row) => row.soundTitle).filter(Boolean))].slice(0, 4);
    const candidate = {
      targetId: first.targetId,
      querySeeds: [...new Set(candidateRows.map((row) => row.querySeed).filter(Boolean))],
      queryOrbits: [...new Set(candidateRows.map((row) => row.queryOrbit).filter(Boolean))],
      handle: first.handle,
      displayName: first.displayName,
      rows: candidateRows,
      tags,
      sounds,
      region: first.region || "Unknown",
      observedDate: first.observedDate
    };
    const history = buildCandidateHistory(candidate, previousState, runDate);
    const enrichedCandidate = { ...candidate, history };
    return { ...enrichedCandidate, surge: scoreSurgeCandidate(enrichedCandidate, profiles) };
  }).sort((a, b) => b.surge.score - a.surge.score);
}

function buildNextState(candidates, previousState, runDate) {
  const nextState = {
    ...emptyState(),
    updatedAt: runDate,
    candidates: { ...previousState.candidates }
  };
  candidates.forEach((candidate) => {
    const previous = previousState.candidates[candidate.history.key] || {};
    nextState.candidates[candidate.history.key] = {
      targetId: candidate.targetId,
      handle: candidate.handle,
      displayName: candidate.displayName,
      firstSeen: candidate.history.firstSeen,
      lastSeen: runDate,
      runCount: candidate.history.runCount,
      lastStats: candidate.history.currentStats,
      previousStats: candidate.history.previousStats,
      bestScore: Math.max(previous.bestScore || 0, candidate.surge.score),
      lastScore: candidate.surge.score,
      lastDecision: candidate.surge.decision,
      lastQuerySeeds: candidate.querySeeds,
      lastQueryOrbits: candidate.queryOrbits
    };
  });
  return nextState;
}

function buildHumanReviewQueue(candidates, profiles, runDate) {
  return {
    status: "human-review-queue",
    createdAt: runDate,
    reviewRule: "Human reviewer must validate artist identity, catalog, source confidence, duplicate status, and target-fit reason before dashboard import.",
    candidates: candidates.map((candidate) => {
      const profile = profiles.find((item) => item.targetId === candidate.targetId);
      return {
        targetId: candidate.targetId,
        targetName: profile?.name || "Unmapped target",
        handle: candidate.handle,
        displayName: candidate.displayName,
        surgeScore: candidate.surge.score,
        decision: candidate.surge.decision,
        dimensions: candidate.surge.dimensions,
        querySeeds: candidate.querySeeds,
        history: {
          isNewCandidate: candidate.history.isNewCandidate,
          firstSeen: candidate.history.firstSeen,
          previousSeen: candidate.history.previousSeen,
          runCount: candidate.history.runCount,
          deltas: candidate.history.deltas,
          growthPct: candidate.history.growthPct
        },
        strongestSignal: `${candidate.rows.length} row(s), ${candidate.surge.stats.views} visible views, ${candidate.surge.stats.comments} comments, ${candidate.surge.stats.shares} shares.`,
        reviewFields: {
          isArtistAccount: "uncertain",
          catalogFound: "uncertain",
          targetFitReason: "pending human review",
          weakestSignal: "pending human review",
          duplicateOf: "",
          reviewDecision: candidate.surge.decision,
          passReason: "",
          sourceConfidence: candidate.surge.dimensions.sourceReliability >= 8 ? "Medium" : "Low",
          nextValidationStep: "Confirm catalog and short-form repeat signal."
        },
        sourceRows: candidate.rows.map((row) => ({
          url: row.url,
          caption: row.caption,
          observedDate: row.observedDate,
          queryOrbit: row.queryOrbit,
          querySeed: row.querySeed
        }))
      };
    })
  };
}

function buildSummary(profiles, rows, candidates, runDate, statePath, worksheetRows) {
  const shortlistCount = candidates.filter((candidate) => candidate.surge.decision === "Shortlist").length;
  const dailyReviewCount = candidates.filter((candidate) => candidate.surge.decision === "Daily review").length;
  const watchCount = candidates.filter((candidate) => candidate.surge.decision === "Watch").length;
  const ignoreCount = candidates.filter((candidate) => candidate.surge.decision === "Ignore").length;
  const newCandidateCount = candidates.filter((candidate) => candidate.history.isNewCandidate).length;
  const repeatCandidateCount = candidates.filter((candidate) => !candidate.history.isNewCandidate).length;
  const risingCandidateCount = candidates.filter((candidate) => candidate.history.deltas.views > 0 || candidate.history.deltas.comments > 0 || candidate.history.deltas.shares > 0).length;
  const rowsWithMissingQuery = rows.filter((row) => !row.querySeed || !row.queryOrbit).length;
  const rowsWithMissingTarget = rows.filter((row) => !row.targetId).length;
  return {
    status: "daily-discovery-summary",
    createdAt: runDate,
    targetsSearched: profiles.length,
    searchTasksGenerated: worksheetRows.length,
    rowsReceived: rows.length,
    candidatesClustered: candidates.length,
    newCandidateCount,
    repeatCandidateCount,
    risingCandidateCount,
    shortlistCount,
    dailyReviewCount,
    watchCount,
    ignoreCount,
    topMissingSource: rowsWithMissingTarget ? "targetId" : rowsWithMissingQuery ? "querySeed/queryOrbit" : "none",
    connectorFailures: [],
    statePath,
    approvalState: {
      liveCollection: "not-approved",
      publicRealArtistClaims: "not-approved",
      backendStorage: "not-approved",
      allowedInput: "manual or approved-provider normalized rows"
    }
  };
}

async function writeJson(path, data) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  if (!args.targets || !args.rows || !args.out) {
    throw new Error(`Missing required arguments.\n\n${usage()}`);
  }
  if (!validDate(args.date)) throw new Error("--date must be YYYY-MM-DD.");

  const targetsPath = resolve(args.targets);
  const rowsPath = resolve(args.rows);
  const outputDir = resolve(args.out);
  const previousState = await loadState(args.state ? resolve(args.state) : null);
  const stateOutPath = resolve(args["state-out"] || `${outputDir}/discovery-state.json`);
  const profiles = (await loadInput(targetsPath)).map(normalizeTargetProfile);
  const rows = (await loadInput(rowsPath)).map((row, index) => normalizeDiscoveryRow(row, index, args.date));
  if (!profiles.length) throw new Error("At least one target profile is required.");
  if (!rows.length) throw new Error("At least one approved source row is required.");

  const queryPlan = buildTargetQueryPlan(profiles, args.date);
  const worksheetRows = buildAnalystSearchWorksheet(queryPlan);
  const rowTemplate = buildApprovedSourceRowTemplate(args.date);
  const clusters = clusterRows(rows, profiles, previousState, args.date);
  const reviewQueue = buildHumanReviewQueue(clusters, profiles, args.date);
  const nextState = buildNextState(clusters, previousState, args.date);
  const summary = buildSummary(profiles, rows, clusters, args.date, stateOutPath, worksheetRows);

  await writeJson(`${outputDir}/daily-query-plan.json`, queryPlan);
  await writeFile(
    `${outputDir}/analyst-search-worksheet.csv`,
    toCsv(worksheetRows, [
      "runDate",
      "targetId",
      "targetName",
      "targetPriority",
      "queryOrbit",
      "querySeed",
      "searchPriority",
      "approvedSourcePath",
      "analystStatus",
      "rowsCaptured",
      "strongestCandidate",
      "notes",
      "policyReminder"
    ]),
    "utf8"
  );
  await writeFile(
    `${outputDir}/approved-source-row-template.csv`,
    toCsv(rowTemplate, [
      "targetId",
      "queryOrbit",
      "querySeed",
      "handle",
      "displayName",
      "caption",
      "url",
      "sourcePlatform",
      "soundTitle",
      "hashtags",
      "region",
      "observedDate",
      "views",
      "likes",
      "comments",
      "shares",
      "saves",
      "uses"
    ]),
    "utf8"
  );
  await writeJson(`${outputDir}/normalized-source-rows.json`, rows);
  await writeJson(`${outputDir}/candidate-clusters.json`, clusters);
  await writeJson(`${outputDir}/human-review-queue.json`, reviewQueue);
  await writeJson(`${outputDir}/daily-summary.json`, summary);
  await writeJson(stateOutPath, nextState);

  console.log(JSON.stringify({
    status: "ok",
    outputDir,
    runDate: args.date,
    targetsSearched: summary.targetsSearched,
    searchTasksGenerated: summary.searchTasksGenerated,
    rowsReceived: summary.rowsReceived,
    candidatesClustered: summary.candidatesClustered,
    newCandidateCount: summary.newCandidateCount,
    repeatCandidateCount: summary.repeatCandidateCount,
    risingCandidateCount: summary.risingCandidateCount,
    shortlistCount: summary.shortlistCount,
    dailyReviewCount: summary.dailyReviewCount,
    watchCount: summary.watchCount
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
