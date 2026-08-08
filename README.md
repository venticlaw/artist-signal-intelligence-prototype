# Artist Signal Intelligence Prototype

Status: public-safe static prototype
Date: August 7, 2026

This prototype is a fictional-data A&R research dashboard for the Artist Signal Intelligence MVP. It is safe for GitHub Pages because it does not include real artist rankings, live collection, backend storage, lead capture, paid APIs, outreach, or private data.

## MVP Surface

- Label A&R prospect desk with genre-lane filtering, queue metrics, active prospect review, search, confidence filter, minimum buyer-fit filter, and sorting.
- Artist brief with scene/community context, risks, and buyer-fit stats.
- Source-separated evidence with source labels, observed dates, source URL handling, freshness, and confidence.
- Scoring model view with weighted buyer-fit rationale and strongest/weakest dimensions.
- Artist comparison table using the active buyer lens and filters.
- Browser-local A&R notes with decision states, pass/caution reasons, and human learning notes.
- Strategy recommendation and disconfirming evidence.
- Browser-local Markdown scouting report copy/download.
- Buyer requirements questionnaire with browser-local packet copy/download.
- Target Discovery workbench for daily target-artist query plans, approved source rows, surge scoring, and human review queues.
- TikTok Discovery Workbench for query planning, API adapter packet generation, approved/manual result-row clustering, and ASI private packet generation.
- Local target profile builder for turning user-provided A&R target intake into normalized search profiles.
- Local source-row normalizer for turning approved TikTok/API/vendor/manual exports into the ASI daily row contract.
- Local daily discovery packet generator for turning target profiles plus approved rows into daily query, cluster, queue, and summary JSON artifacts.
- Local review-queue converter for turning human-approved candidates into private dashboard import packets.
- Local workflow runner that chains target intake, approved export normalization, daily scoring, and optional private import conversion into one date-stamped run manifest.
- Strict private JSON import for manually reviewed public evidence.
- Approval gate view for blocked actions.

## Public Safety

- All artist records are fictional placeholders.
- No API keys, tokens, cookies, OAuth material, paid exports, or `.env` files are used.
- The app runs as static HTML, CSS, JavaScript, and local JSON.
- Notes are stored only in the visitor's browser local storage.
- Notes may persist on a shared machine; do not enter private notes on an untrusted device.
- Private import runs only in the browser session from a local JSON file or pasted JSON.
- Report copy/download runs only in the browser and creates Markdown from the currently loaded packet.
- Questionnaire packet copy/download runs only in the browser.
- TikTok Discovery Workbench does not call TikTok, scrape, login-scrape, automate browser extraction, or store results; it only generates a server-side API adapter contract and processes pasted approved/manual rows in the browser.
- Target Discovery does not run live collection; it turns pasted target profiles and approved daily source rows into a local review queue.
- Source-row normalization reads local approved/manual exports only; it does not fetch TikTok, authenticate, scrape, enrich, or store credentials.
- Review-queue conversion promotes only human-approved local candidates and keeps output as `publicationApproval: not-approved`.
- Workflow runs are local manifests only. They do not schedule, fetch, scrape, authenticate, sync, publish, or contact anyone.
- Any TikTok or licensed-provider API credentials must live in a private server-side connector, never in GitHub Pages, repo files, browser JavaScript, or static JSON.
- Approval-gated actions are displayed as blocked actions, not active controls.

## Local Run

Serve the repository root or this folder with a static file server and open `index.html`.

## Daily Discovery Packet

The local CLI creates the daily artifacts that make target-based discovery repeatable. It reads only local target profiles and approved/manual source rows.

One-command morning preparation:

```bash
node tools/asi-run-workflow.mjs \
  --target-intake data/sample-target-intake.csv \
  --runs /private/tmp/asi-workflow-runs \
  --date 2026-08-14
```

One-command scoring and private packet conversion after approved exports and human review are available:

```bash
node tools/asi-run-workflow.mjs \
  --targets data/sample-target-profiles.json \
  --source-export data/sample-tiktok-approved-export.json \
  --target-id northline-vale \
  --query-orbit genre-scene \
  --query-seed altrap \
  --reviewed-queue data/sample-human-reviewed-queue.json \
  --runs /private/tmp/asi-workflow-runs \
  --date 2026-08-13 \
  --analyst ASI
```

The workflow writes `workflow-manifest.json` inside the date-stamped run folder and `latest-workflow.json` at the run root.

Build normalized target profiles from A&R target intake:

```bash
node tools/asi-build-target-profiles.mjs \
  --input data/sample-target-intake.json \
  --out /private/tmp/asi-built-target-profiles.json
```

CSV intake is supported for spreadsheet handoffs:

```bash
node tools/asi-build-target-profiles.mjs \
  --input data/sample-target-intake.csv \
  --out /private/tmp/asi-built-target-profiles-csv.json
```

Normalize an approved TikTok/API/vendor/manual export into ASI source rows:

```bash
node tools/asi-normalize-source-rows.mjs \
  --input data/sample-tiktok-approved-export.json \
  --out /private/tmp/asi-normalized-source-rows.json \
  --target-id northline-vale \
  --query-orbit genre-scene \
  --query-seed altrap
```

Daily runner with automatic prior-state carry-forward:

```bash
node tools/asi-run-daily.mjs \
  --targets /private/tmp/asi-built-target-profiles.json \
  --runs /private/tmp/asi-runner-runs \
  --date 2026-08-08
```

When `--rows` is omitted, the runner creates a preparation packet only: query plan, analyst worksheet, row template, empty normalized rows, empty clusters, empty review queue, summary, and latest-run handoff.

Scoring run after approved rows are captured:

```bash
node tools/asi-run-daily.mjs \
  --targets data/sample-target-profiles.json \
  --rows /private/tmp/asi-normalized-source-rows.json \
  --runs /private/tmp/asi-runner-runs \
  --date 2026-08-13
```

After human review, convert approved candidates into a private dashboard import packet:

```bash
node tools/asi-review-queue-to-private-import.mjs \
  --input data/sample-human-reviewed-queue.json \
  --out /private/tmp/asi-private-import-from-reviewed-queue.json \
  --analyst ASI \
  --created-at 2026-08-13
```

Follow-up daily runner:

```bash
node tools/asi-run-daily.mjs \
  --targets data/sample-target-profiles.json \
  --rows data/sample-daily-source-rows-day-2.json \
  --runs /private/tmp/asi-runner-runs \
  --date 2026-08-09
```

The daily runner writes to `<runs>/<date>/`, automatically uses `<runs>/<previous-date>/discovery-state.json` when present, and writes `<runs>/latest-run.json` for local handoff.

First run:

```bash
node tools/asi-daily-discovery.mjs \
  --targets data/sample-target-profiles.json \
  --rows data/sample-daily-source-rows.json \
  --out /private/tmp/asi-daily-discovery-sample \
  --date 2026-08-08
```

Worksheet-only preparation can also run directly:

```bash
node tools/asi-daily-discovery.mjs \
  --targets data/sample-target-profiles.json \
  --out /private/tmp/asi-prepare-only-direct \
  --date 2026-08-10 \
  --prepare-only
```

Follow-up run with yesterday's state:

```bash
node tools/asi-daily-discovery.mjs \
  --targets data/sample-target-profiles.json \
  --rows data/sample-daily-source-rows-day-2.json \
  --state /private/tmp/asi-daily-discovery-sample/discovery-state.json \
  --out /private/tmp/asi-daily-discovery-day-2 \
  --date 2026-08-09
```

Outputs:

- `daily-query-plan.json`
- `analyst-search-worksheet.csv`
- `approved-source-row-template.csv`
- `normalized-source-rows.json`
- `candidate-clusters.json`
- `human-review-queue.json`
- `daily-summary.json`
- `discovery-state.json`

`analyst-search-worksheet.csv` gives A&R ops a prioritized daily checklist of target/search-orbit/query-seed tasks. `approved-source-row-template.csv` gives the capture columns that feed back into the scorer.

`discovery-state.json` tracks first seen, last seen, run count, previous stats, deltas, and growth percentages so repeat daily runs can distinguish new, repeat, and rising candidates. The CLI does not call TikTok, scrape, authenticate, store credentials, or publish results.

## Source Of Truth

Durable ASI planning remains under `_data/channel-work/asi/`. This prototype is a review surface, not the canonical product memory.

## Private Import

The `Private Import` tab accepts a local JSON packet shaped like the ASI intake template. Imported records are not uploaded or committed; they render only in the current browser session.

Private packets must use manually reviewed public evidence, keep publication approval as `not-approved`, and include source-separated signal details with source label, observed date, confidence, and an `https://` source URL unless the source is explicitly `Unknown`. Do not add real artist packets to this public repository or to GitHub Pages fixtures.
