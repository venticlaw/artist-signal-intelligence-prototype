#!/usr/bin/env node
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawn } from "node:child_process";

const DEFAULT_DATE = new Date().toISOString().slice(0, 10);
const DAY_MS = 24 * 60 * 60 * 1000;

function usage() {
  return [
    "Usage:",
    "  node tools/asi-run-daily.mjs --targets data/sample-target-profiles.json --rows data/sample-daily-source-rows.json --runs /tmp/asi-runs --date 2026-08-08",
    "",
    "Inputs:",
    "  --targets JSON array or object with profiles[]",
    "  --rows    Today's approved/manual source rows as JSON or CSV",
    "  --runs    Root folder for date-stamped daily run folders",
    "  --date    Optional YYYY-MM-DD run date, defaults to today",
    "",
    "Behavior:",
    "  - Writes today's packet to <runs>/<date>/",
    "  - Uses <runs>/<previous-date>/discovery-state.json when present",
    "  - Writes <runs>/latest-run.json for local handoff",
    "  - Does not collect data, scrape, authenticate, publish, or contact anyone"
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

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function previousDate(date) {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) throw new Error(`Invalid date: ${date}`);
  return new Date(parsed.getTime() - DAY_MS).toISOString().slice(0, 10);
}

async function exists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function runNode(args, cwd) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", rejectRun);
    child.on("close", (code) => {
      if (code !== 0) {
        rejectRun(new Error(stderr.trim() || `Child process exited with code ${code}`));
        return;
      }
      resolveRun({ stdout, stderr });
    });
  });
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
  if (!args.targets || !args.rows || !args.runs) {
    throw new Error(`Missing required arguments.\n\n${usage()}`);
  }
  if (!validDate(args.date)) throw new Error("--date must be YYYY-MM-DD.");

  const cwd = resolve(new URL("..", import.meta.url).pathname);
  const targetsPath = resolve(args.targets);
  const rowsPath = resolve(args.rows);
  const runsRoot = resolve(args.runs);
  const runDir = resolve(runsRoot, args.date);
  const priorDate = previousDate(args.date);
  const priorStatePath = resolve(runsRoot, priorDate, "discovery-state.json");
  const stateOutPath = resolve(runDir, "discovery-state.json");
  const hasPriorState = await exists(priorStatePath);

  await mkdir(runDir, { recursive: true });

  const discoveryArgs = [
    "tools/asi-daily-discovery.mjs",
    "--targets", targetsPath,
    "--rows", rowsPath,
    "--out", runDir,
    "--date", args.date,
    "--state-out", stateOutPath
  ];
  if (hasPriorState) {
    discoveryArgs.push("--state", priorStatePath);
  }

  const result = await runNode(discoveryArgs, cwd);
  const summary = JSON.parse(await readFile(resolve(runDir, "daily-summary.json"), "utf8"));
  const latestRun = {
    status: "asi-local-daily-run",
    runDate: args.date,
    runDir,
    targetsPath,
    rowsPath,
    priorStatePath: hasPriorState ? priorStatePath : null,
    stateOutPath,
    generatedAt: new Date().toISOString(),
    summary,
    approvalState: {
      liveCollection: "not-approved",
      allowedInput: "manual or approved-provider normalized rows",
      publicRealArtistClaims: "not-approved"
    }
  };

  await writeJson(resolve(runsRoot, "latest-run.json"), latestRun);
  console.log(JSON.stringify({
    status: "ok",
    runDate: args.date,
    runDir,
    priorStateUsed: hasPriorState,
    searchTasksGenerated: summary.searchTasksGenerated,
    rowsReceived: summary.rowsReceived,
    candidatesClustered: summary.candidatesClustered,
    newCandidateCount: summary.newCandidateCount,
    repeatCandidateCount: summary.repeatCandidateCount,
    risingCandidateCount: summary.risingCandidateCount,
    childStatus: JSON.parse(result.stdout || "{}").status || "ok"
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
