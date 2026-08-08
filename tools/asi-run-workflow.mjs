#!/usr/bin/env node
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawn } from "node:child_process";

const DEFAULT_DATE = new Date().toISOString().slice(0, 10);

function usage() {
  return [
    "Usage:",
    "  node tools/asi-run-workflow.mjs --target-intake data/sample-target-intake.csv --runs /tmp/asi-workflow-runs --date 2026-08-13",
    "  node tools/asi-run-workflow.mjs --targets data/sample-target-profiles.json --source-export data/sample-tiktok-approved-export.json --target-id northline-vale --query-orbit genre-scene --query-seed altrap --reviewed-queue data/sample-human-reviewed-queue.json --runs /tmp/asi-workflow-runs --date 2026-08-13 --analyst ASI",
    "",
    "Inputs:",
    "  --targets       Existing normalized target profiles JSON",
    "  --target-intake Raw target intake JSON/CSV to normalize first",
    "  --source-export Optional approved TikTok/API/vendor/manual export JSON/CSV",
    "  --reviewed-queue Optional human-reviewed queue JSON for private import packet conversion",
    "  --runs          Root folder for date-stamped workflow runs",
    "  --date          Optional YYYY-MM-DD run date, defaults to today",
    "",
    "Source export defaults:",
    "  --target-id, --query-orbit, --query-seed, --source-platform",
    "",
    "Private import options:",
    "  --analyst Required when --reviewed-queue is provided",
    "",
    "Behavior:",
    "  - If --source-export is omitted, produces a prepare-only morning packet",
    "  - If --source-export is present, normalizes rows and scores candidates",
    "  - If --reviewed-queue is present, converts approved candidates into a private import packet",
    "  - Writes workflow-manifest.json and <runs>/latest-workflow.json",
    "  - Does not collect data, scrape, authenticate, store credentials, publish, or contact anyone"
  ].join("\n");
}

function parseArgs(argv) {
  const args = {
    date: DEFAULT_DATE,
    "source-platform": "TikTok"
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

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
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
      resolveRun({ stdout: stdout.trim(), stderr: stderr.trim() });
    });
  });
}

async function writeJson(path, data) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function parseChild(stdout) {
  try {
    return JSON.parse(stdout || "{}");
  } catch {
    return { status: "unknown", raw: stdout };
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  if (!args.runs) throw new Error(`Missing --runs.\n\n${usage()}`);
  if (!args.targets && !args["target-intake"]) throw new Error("Provide --targets or --target-intake.");
  if (args.targets && args["target-intake"]) throw new Error("Use either --targets or --target-intake, not both.");
  if (!validDate(args.date)) throw new Error("--date must be YYYY-MM-DD.");
  if (args["reviewed-queue"] && !args.analyst) throw new Error("--analyst is required when --reviewed-queue is provided.");

  const cwd = resolve(new URL("..", import.meta.url).pathname);
  const runsRoot = resolve(args.runs);
  const runDir = resolve(runsRoot, args.date);
  const artifactsDir = resolve(runDir, "workflow-artifacts");
  await mkdir(artifactsDir, { recursive: true });

  const steps = [];
  const startedAt = new Date().toISOString();
  let targetsPath = args.targets ? resolve(args.targets) : resolve(artifactsDir, "target-profiles.json");
  let normalizedRowsPath = null;
  let dailyMode = "prepare-only";
  let privateImportPath = null;

  if (args["target-intake"]) {
    const result = await runNode([
      "tools/asi-build-target-profiles.mjs",
      "--input", resolve(args["target-intake"]),
      "--out", targetsPath
    ], cwd);
    steps.push({
      id: "target-profile-build",
      status: "ok",
      outputPath: targetsPath,
      result: parseChild(result.stdout)
    });
  } else if (!await exists(targetsPath)) {
    throw new Error(`Targets file not found: ${targetsPath}`);
  } else {
    steps.push({
      id: "target-profile-build",
      status: "skipped-existing-targets",
      outputPath: targetsPath
    });
  }

  if (args["source-export"]) {
    normalizedRowsPath = resolve(artifactsDir, "normalized-source-rows.json");
    const normalizeArgs = [
      "tools/asi-normalize-source-rows.mjs",
      "--input", resolve(args["source-export"]),
      "--out", normalizedRowsPath,
      "--source-platform", args["source-platform"],
      "--observed-date", args.date
    ];
    for (const [flag, key] of [
      ["--target-id", "target-id"],
      ["--query-orbit", "query-orbit"],
      ["--query-seed", "query-seed"]
    ]) {
      if (args[key]) normalizeArgs.push(flag, args[key]);
    }
    const result = await runNode(normalizeArgs, cwd);
    steps.push({
      id: "source-export-normalize",
      status: "ok",
      outputPath: normalizedRowsPath,
      result: parseChild(result.stdout)
    });
    dailyMode = "score-rows";
  } else {
    steps.push({
      id: "source-export-normalize",
      status: "skipped-no-approved-source-export",
      outputPath: null
    });
  }

  const dailyArgs = [
    "tools/asi-run-daily.mjs",
    "--targets", targetsPath,
    "--runs", runDir,
    "--date", args.date
  ];
  if (normalizedRowsPath) {
    dailyArgs.push("--rows", normalizedRowsPath);
  } else {
    dailyArgs.push("--prepare-only");
  }
  const dailyResult = await runNode(dailyArgs, cwd);
  const dailyRunDir = resolve(runDir, args.date);
  const dailySummaryPath = resolve(dailyRunDir, "daily-summary.json");
  const dailySummary = await readJson(dailySummaryPath);
  steps.push({
    id: "daily-discovery-run",
    status: "ok",
    mode: dailyMode,
    outputDir: dailyRunDir,
    summaryPath: dailySummaryPath,
    result: parseChild(dailyResult.stdout)
  });

  if (args["reviewed-queue"]) {
    privateImportPath = resolve(artifactsDir, "private-import-packet.json");
    const result = await runNode([
      "tools/asi-review-queue-to-private-import.mjs",
      "--input", resolve(args["reviewed-queue"]),
      "--out", privateImportPath,
      "--analyst", args.analyst,
      "--created-at", args.date
    ], cwd);
    steps.push({
      id: "private-import-convert",
      status: "ok",
      outputPath: privateImportPath,
      result: parseChild(result.stdout)
    });
  } else {
    steps.push({
      id: "private-import-convert",
      status: "skipped-no-reviewed-queue",
      outputPath: null
    });
  }

  const manifest = {
    status: "asi-local-daily-workflow",
    runDate: args.date,
    runDir,
    generatedAt: new Date().toISOString(),
    startedAt,
    mode: dailyMode,
    targetsPath,
    normalizedRowsPath,
    dailyRunDir,
    privateImportPath,
    summary: dailySummary,
    steps,
    nextOperatorActions: normalizedRowsPath
      ? [
        "Review human-review-queue.json.",
        "Resolve candidate reviewFields before private import conversion.",
        "Run the workflow again with --reviewed-queue when reviewed candidates are ready."
      ]
      : [
        "Use analyst-search-worksheet.csv to gather approved/manual source rows.",
        "Save approved API/vendor/manual export locally.",
        "Run the workflow again with --source-export and source defaults."
      ],
    approvalState: {
      liveCollection: "not-approved",
      sourceInput: normalizedRowsPath ? "approved export supplied locally" : "no source rows supplied",
      scraping: "not-performed",
      credentials: "not-stored",
      backendStorage: "not-approved",
      publicRealArtistClaims: "not-approved",
      outboundActions: "not-performed"
    }
  };

  await writeJson(resolve(runDir, "workflow-manifest.json"), manifest);
  await writeJson(resolve(runsRoot, "latest-workflow.json"), manifest);

  console.log(JSON.stringify({
    status: "ok",
    mode: manifest.mode,
    runDate: manifest.runDate,
    runDir: manifest.runDir,
    targetsPath: manifest.targetsPath,
    normalizedRowsPath: manifest.normalizedRowsPath,
    dailyRunDir: manifest.dailyRunDir,
    privateImportPath: manifest.privateImportPath,
    rowsReceived: dailySummary.rowsReceived,
    candidatesClustered: dailySummary.candidatesClustered,
    searchTasksGenerated: dailySummary.searchTasksGenerated,
    steps: manifest.steps.map((step) => ({ id: step.id, status: step.status }))
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
