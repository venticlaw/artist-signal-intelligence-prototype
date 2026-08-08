#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const DEFAULT_DATE = new Date().toISOString().slice(0, 10);
const VALID_CONFIDENCE = new Set(["High", "Medium", "Low", "Insufficient"]);
const IMPORTABLE_DECISIONS = new Set(["shortlist", "watch", "more research", "daily review"]);

function usage() {
  return [
    "Usage:",
    "  node tools/asi-review-queue-to-private-import.mjs --input data/sample-human-reviewed-queue.json --out /tmp/asi-private-import.json --analyst ASI",
    "",
    "Inputs:",
    "  --input Human-reviewed ASI review queue JSON",
    "  --out   Output private-browser-import packet path",
    "  --analyst Analyst name or initials for the private import packet",
    "",
    "Optional:",
    "  --created-at YYYY-MM-DD, defaults to today",
    "",
    "This tool converts human-approved local review queue candidates into a private dashboard import packet. It does not collect data, scrape, publish, contact anyone, or create public real-artist claims."
  ].join("\n");
}

function parseArgs(argv) {
  const args = { "created-at": DEFAULT_DATE };
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

function safeFileSegment(value) {
  return String(value || "artist")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "artist";
}

function clampScore(value, max) {
  return Math.max(0, Math.min(max, Number(value) || 0));
}

function yes(value) {
  return String(value || "").trim().toLowerCase() === "yes";
}

function text(value) {
  return String(value || "").trim();
}

function hasReviewedText(value) {
  const normalized = text(value).toLowerCase();
  return normalized && !normalized.includes("pending human review") && normalized !== "uncertain";
}

function sourceRows(candidate) {
  return Array.isArray(candidate.sourceRows) ? candidate.sourceRows : [];
}

function mapConfidence(value) {
  const confidence = text(value);
  return VALID_CONFIDENCE.has(confidence) ? confidence : "Low";
}

function importable(candidate) {
  const fields = candidate.reviewFields || {};
  const decision = text(fields.reviewDecision || candidate.decision).toLowerCase();
  return (
    yes(fields.isArtistAccount) &&
    yes(fields.catalogFound) &&
    !text(fields.duplicateOf) &&
    IMPORTABLE_DECISIONS.has(decision) &&
    hasReviewedText(fields.targetFitReason) &&
    hasReviewedText(fields.weakestSignal) &&
    sourceRows(candidate).length > 0
  );
}

function requireQueue(queue) {
  if (!queue || typeof queue !== "object" || Array.isArray(queue)) {
    throw new Error("--input must be a human-review-queue object.");
  }
  if (queue.status !== "human-review-queue") {
    throw new Error("Queue status must be human-review-queue.");
  }
  if (!Array.isArray(queue.candidates)) {
    throw new Error("Queue needs candidates[].");
  }
  return queue;
}

function summarizeSkipped(candidates) {
  return candidates
    .filter((candidate) => !importable(candidate))
    .map((candidate) => ({
      handle: candidate.handle || "unknown",
      displayName: candidate.displayName || candidate.handle || "Unknown candidate",
      reason: "Not importable until human reviewer sets isArtistAccount=yes, catalogFound=yes, non-pass reviewDecision, targetFitReason, weakestSignal, and at least one source row."
    }));
}

function scoreMap(candidate) {
  const dimensions = candidate.dimensions || {};
  return {
    momentum: clampScore(dimensions.velocity, 20),
    engagement: clampScore(dimensions.engagementQuality, 15),
    community: clampScore(Math.round((Number(dimensions.targetFit) || 0) * 0.75), 15),
    catalog: clampScore(dimensions.catalogValidation, 10),
    relationships: 0,
    live: 0,
    press: 0,
    reliability: clampScore(dimensions.sourceReliability, 10)
  };
}

function signalFromRow(row, index, candidate, confidence) {
  const url = text(row.url);
  const observedDate = text(row.observedDate || candidate.history?.lastSeen || DEFAULT_DATE);
  if (!url.startsWith("https://")) {
    throw new Error(`${candidate.displayName || candidate.handle} source row ${index + 1} needs https url.`);
  }
  if (!validDate(observedDate)) {
    throw new Error(`${candidate.displayName || candidate.handle} source row ${index + 1} needs observedDate YYYY-MM-DD.`);
  }
  const query = [row.queryOrbit, row.querySeed].map(text).filter(Boolean).join(" / ");
  const caption = text(row.caption);
  return {
    category: "Public short-form signal",
    label: "Observed",
    observedDate,
    sourceUrl: url,
    freshness: `Observed ${observedDate}`,
    confidence,
    detail: `${caption || "Approved public source row observed."} Query context: ${query || "not provided"}.`
  };
}

function candidateToArtist(candidate, index, createdAt) {
  const fields = candidate.reviewFields || {};
  const name = text(candidate.displayName || candidate.handle);
  const confidence = mapConfidence(fields.sourceConfidence);
  const stats = candidate.history?.currentStats || candidate.stats || {};
  const views = Number(stats.views || candidate.history?.deltas?.views || 0) || 0;
  const comments = Number(stats.comments || candidate.history?.deltas?.comments || 0) || 0;
  const shares = Number(stats.shares || candidate.history?.deltas?.shares || 0) || 0;
  const targetName = text(candidate.targetName || candidate.targetId || "target artist");
  const strongestSignal = text(candidate.strongestSignal || fields.strongestSignal || "Approved public-source signal observed.");
  const weakestSignal = text(fields.weakestSignal);
  const targetFitReason = text(fields.targetFitReason);
  const nextValidationStep = text(fields.nextValidationStep || "Continue source-separated validation before any buyer-facing claim.");

  return {
    id: `private-review-${safeFileSegment(name)}-${createdAt}-${index + 1}`,
    name,
    stage: "Human-reviewed discovery candidate",
    scene: `Private ASI candidate surfaced against ${targetName}. Human reviewer fit note: ${targetFitReason}`,
    summary: `${name} was promoted from the ASI human review queue after reviewer validation. Current public-source packet shows ${views} visible views, ${comments} comments, and ${shares} shares across approved source row(s).`,
    scores: scoreMap(candidate),
    confidence,
    recommendation: `${text(fields.reviewDecision || candidate.decision)} for private A&R review only. Do not publish or contact without separate approval.`,
    strategy: nextValidationStep,
    disconfirmingEvidence: `Downgrade or pass if follow-up validation contradicts artist identity, catalog ownership, source reliability, or target fit. Reviewer weakest signal: ${weakestSignal}`,
    risks: [
      "Private review packet only; no public ranking or buyer-facing claim approved",
      "Short-form engagement may reflect trend behavior rather than artist demand",
      weakestSignal
    ],
    developments: [
      {
        date: createdAt,
        type: "Human review queue promotion",
        detail: strongestSignal,
        sourceUrl: sourceRows(candidate)[0]?.url || "Unknown",
        confidence,
        buyerRelevance: "Candidate is ready for private dashboard review after human validation.",
        scoreImpact: "Momentum, engagement, source reliability, and target fit"
      }
    ],
    relationships: [
      {
        type: "Target fit context",
        name: targetName,
        evidence: targetFitReason,
        sourceUrl: sourceRows(candidate)[0]?.url || "Unknown",
        confidence,
        scoreUse: "Context only until additional source validation"
      }
    ],
    feedbackLearning: {
      expectedPassReason: text(fields.passReason || "Unreliable or incomplete data"),
      missingContext: "Catalog depth, official social identity, audience geography, management/team context, and repeat signal outside the source row set.",
      misleadingSignalRisk: "Visible short-form velocity can overstate buyer fit if the account is not the artist account or the sound is not artist-owned.",
      suggestedModelAdjustment: "Keep human approval required before converting review queue candidates into private dashboard records."
    },
    signals: sourceRows(candidate).map((row, rowIndex) => signalFromRow(row, rowIndex, candidate, confidence))
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  if (!args.input || !args.out || !args.analyst) {
    throw new Error(`Missing required arguments.\n\n${usage()}`);
  }
  if (!validDate(args["created-at"])) throw new Error("--created-at must be YYYY-MM-DD.");

  const queue = requireQueue(JSON.parse(await readFile(resolve(args.input), "utf8")));
  const importableCandidates = queue.candidates.filter(importable);
  if (!importableCandidates.length) {
    throw new Error("No candidates are importable. Human review must approve artist identity, catalog, review decision, target-fit reason, weakest signal, and source rows first.");
  }

  const packet = {
    status: "private-browser-import",
    reviewMode: "manual-public-evidence-only",
    analyst: text(args.analyst),
    createdAt: args["created-at"],
    publicationApproval: "not-approved",
    dataPolicy: "Manually reviewed public evidence only. No scraping, paid/gated/login-only sources, private data, outreach, or automated collection.",
    artists: importableCandidates.map((candidate, index) => candidateToArtist(candidate, index, args["created-at"])),
    skippedCandidates: summarizeSkipped(queue.candidates),
    approvalGates: [
      "No public rankings or claims about real artists",
      "No outreach to artists, labels, distributors, managers, playlist teams, or brand partners",
      "No scraping private, gated, paid, login-only, or ToS-sensitive sources",
      "No backend storage, public lead capture, live automation, payment, DNS, legal filing, Drive movement, outbound sends, or deletion"
    ]
  };

  await mkdir(dirname(resolve(args.out)), { recursive: true });
  await writeFile(resolve(args.out), `${JSON.stringify(packet, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({
    status: "ok",
    outputPath: resolve(args.out),
    artistCount: packet.artists.length,
    skippedCount: packet.skippedCandidates.length,
    artistIds: packet.artists.map((artist) => artist.id)
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
