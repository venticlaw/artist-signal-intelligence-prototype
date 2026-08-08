const state = {
  data: null,
  defaultData: null,
  activeArtistId: null,
  buyerModeId: "distributor",
  dataSourceLabel: "Fictional fixtures"
};

const dimensionLabels = {
  momentum: "Momentum velocity",
  engagement: "Engagement quality",
  community: "Community / scene strength",
  catalog: "Catalog consistency",
  relationships: "Relationship graph",
  live: "Live / market proof",
  press: "Press / cultural relevance",
  reliability: "Data reliability"
};

const maxPoints = {
  momentum: 20,
  engagement: 15,
  community: 15,
  catalog: 10,
  relationships: 10,
  live: 10,
  press: 10,
  reliability: 10
};

const $ = (selector) => document.querySelector(selector);

const confidenceLabels = ["High", "Medium", "Low", "Insufficient"];
const sourceLabels = ["Observed", "Reported by artist/team", "Third-party public source", "Estimated", "Unknown"];

const importTemplate = {
  status: "private-browser-import",
  reviewMode: "manual-public-evidence-only",
  analyst: "ANALYST NAME OR INITIALS",
  createdAt: "YYYY-MM-DD",
  publicationApproval: "not-approved",
  dataPolicy: "Manually reviewed public evidence only. No scraping, paid/gated/login-only sources, private data, outreach, or automated collection.",
  artists: [
    {
      id: "private-review-artist-001",
      name: "PRIVATE REVIEW ARTIST NAME",
      stage: "Manual private review",
      scene: "Publicly observed scene/community context",
      summary: "Boardroom-safe summary based on manually reviewed public evidence.",
      scores: {
        momentum: 0,
        engagement: 0,
        community: 0,
        catalog: 0,
        relationships: 0,
        live: 0,
        press: 0,
        reliability: 0
      },
      confidence: "Insufficient",
      recommendation: "Needs more research",
      strategy: "State the lowest-risk next validation step.",
      disconfirmingEvidence: "State what would prove this recommendation wrong.",
      risks: ["Unknowns remain unresolved"],
      signals: [
        {
          category: "Public social velocity",
          label: "Observed",
          observedDate: "YYYY-MM-DD",
          sourceUrl: "https://public-source-url.example/path",
          freshness: "YYYY-MM-DD observed date",
          confidence: "Low",
          detail: "Analyst note with the exact public evidence observed and any unresolved unknowns."
        }
      ]
    }
  ]
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function clampScore(value, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(max, Math.round(number)));
}

function validConfidence(value) {
  return confidenceLabels.includes(value) ? value : "Insufficient";
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function validDateOrUnknown(value) {
  return value === "Unknown" || /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function validEvidenceUrl(value, sourceLabel) {
  if (sourceLabel === "Unknown") return value === "Unknown";
  return typeof value === "string" && /^https:\/\/[^\s]+$/i.test(value.trim());
}

function sourceLink(signal) {
  if (!signal.sourceUrl || signal.sourceUrl === "Unknown") {
    return '<span class="tag warning">Source URL unknown</span>';
  }
  const url = escapeHtml(signal.sourceUrl);
  return `<a class="source-link" href="${url}" target="_blank" rel="noopener noreferrer">Open source</a>`;
}

function getMode() {
  return state.data.buyerModes.find((mode) => mode.id === state.buyerModeId);
}

function getArtist() {
  return state.data.artists.find((artist) => artist.id === state.activeArtistId);
}

function weightedScore(artist, mode) {
  const weighted = Object.entries(artist.scores).reduce(
    (sum, [key, value]) => sum + value * (mode.weights[key] || 1),
    0
  );
  const max = Object.entries(maxPoints).reduce(
    (sum, [key, value]) => sum + value * (mode.weights[key] || 1),
    0
  );
  return Math.round((weighted / max) * 100);
}

function baseScore(artist) {
  return Object.values(artist.scores).reduce((sum, value) => sum + value, 0);
}

function confidenceClass(confidence) {
  return confidence === "High" ? "confidence high" : "confidence";
}

function recordLabel() {
  return state.data?.status === "private-browser-import" ? "Private browser import" : "Fictional fixture";
}

function renderModeControl() {
  const select = $("#buyerMode");
  select.innerHTML = state.data.buyerModes
    .map((mode) => `<option value="${mode.id}">${mode.label}</option>`)
    .join("");
  select.value = state.buyerModeId;
  select.addEventListener("change", (event) => {
    state.buyerModeId = event.target.value;
    renderAll();
  });
  $("#modeSummary").textContent = `${getMode().description} Data source: ${state.dataSourceLabel}.`;
}

function renderTabs() {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((item) => item.classList.remove("is-active"));
      document.querySelectorAll(".tab-panel").forEach((panel) => panel.classList.remove("is-active"));
      tab.classList.add("is-active");
      document.getElementById(tab.dataset.tab).classList.add("is-active");
    });
  });
}

function renderWatchlist() {
  const mode = getMode();
  $("#watchlistGrid").innerHTML = state.data.artists
    .map((artist) => {
      const fit = weightedScore(artist, mode);
      const base = baseScore(artist);
      return `
        <article class="artist-card ${artist.id === state.activeArtistId ? "is-active" : ""}" data-artist-id="${escapeHtml(artist.id)}" tabindex="0">
          <div class="card-topline">
            <div>
              <p class="eyebrow">${escapeHtml(recordLabel())}</p>
              <h3>${escapeHtml(artist.name)}</h3>
            </div>
            <div class="score-badge">${fit}</div>
          </div>
          <p class="summary">${escapeHtml(artist.summary)}</p>
          <div class="signal-strip">
            <div class="score-row">
              <span class="mini-label">Base score</span>
              <strong>${base}/100</strong>
            </div>
            <div class="score-row">
              <span class="mini-label">Buyer fit</span>
              <strong>${fit}/100</strong>
            </div>
            <div class="score-row">
              <span class="mini-label">Confidence</span>
              <strong class="${confidenceClass(artist.confidence)}">${escapeHtml(artist.confidence)}</strong>
            </div>
          </div>
          <div>
            <span class="mini-label">Recommended next action</span>
            <p>${escapeHtml(artist.recommendation)}</p>
          </div>
        </article>
      `;
    })
    .join("");

  document.querySelectorAll(".artist-card").forEach((card) => {
    const selectArtist = () => {
      state.activeArtistId = card.dataset.artistId;
      renderAll();
    };
    card.addEventListener("click", selectArtist);
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectArtist();
      }
    });
  });
}

function renderBrief() {
  const artist = getArtist();
  const mode = getMode();
  $("#artistBrief").innerHTML = `
    <p class="eyebrow">${escapeHtml(artist.stage)}</p>
    <h3>${escapeHtml(artist.name)}</h3>
    <p>${escapeHtml(artist.summary)}</p>
    <div class="stat-grid">
      <div class="stat"><span class="mini-label">Buyer fit</span><strong>${weightedScore(artist, mode)}</strong></div>
      <div class="stat"><span class="mini-label">Base score</span><strong>${baseScore(artist)}</strong></div>
      <div class="stat"><span class="mini-label">Confidence</span><strong>${escapeHtml(artist.confidence)}</strong></div>
      <div class="stat"><span class="mini-label">Mode</span><strong>${escapeHtml(mode.label.split(" ")[0])}</strong></div>
    </div>
    <h3>Scene and network context</h3>
    <p>${escapeHtml(artist.scene)}</p>
  `;
  $("#riskPanel").innerHTML = `
    <h3>Risks and unknowns</h3>
    <ul class="check-list">${artist.risks.map((risk) => `<li>${escapeHtml(risk)}</li>`).join("")}</ul>
  `;
}

function renderEvidence() {
  const artist = getArtist();
  $("#evidenceList").innerHTML = artist.signals
    .map(
      (signal) => `
        <article class="evidence-item">
          <div>
            <p class="eyebrow">${escapeHtml(signal.category)}</p>
            <strong>${escapeHtml(signal.label)}</strong>
          </div>
          <p>${escapeHtml(signal.detail)}</p>
          <div class="tag-row">
            <span class="tag">${escapeHtml(signal.confidence)}</span>
            <span class="tag">${escapeHtml(signal.freshness)}</span>
            <span class="tag">Observed ${escapeHtml(signal.observedDate || "Unknown")}</span>
            ${sourceLink(signal)}
            ${signal.confidence === "Low" ? '<span class="tag warning">Review required</span>' : ""}
          </div>
        </article>
      `
    )
    .join("");
}

function renderScoring() {
  const artist = getArtist();
  $("#scoreBars").innerHTML = Object.entries(maxPoints)
    .map(([key, max]) => {
      const value = artist.scores[key];
      const percent = Math.round((value / max) * 100);
      return `
        <div class="score-bar">
          <div class="score-row">
            <strong>${dimensionLabels[key]}</strong>
            <span>${value}/${max}</span>
          </div>
          <div class="bar-track" aria-hidden="true"><span style="--value: ${percent}%"></span></div>
        </div>
      `;
    })
    .join("");
}

function renderNotes() {
  const reasonInput = $("#reasonInput");
  reasonInput.innerHTML = state.data.passReasons
    .map((reason) => `<option>${reason}</option>`)
    .join("");

  const artist = getArtist();
  const saved = JSON.parse(localStorage.getItem(`asi-note-${artist.id}`) || "null");
  $("#savedNote").innerHTML = saved
    ? `
      <p class="eyebrow">Browser-local note</p>
      <h3>${escapeHtml(saved.decision)}</h3>
      <p><strong>Reason:</strong> ${escapeHtml(saved.reason)}</p>
      <p>${escapeHtml(saved.note || "No note text saved.")}</p>
      <p class="summary">This is not backend storage and will not sync across users or devices.</p>
    `
    : `
      <p class="eyebrow">No saved local note</p>
      <h3>${escapeHtml(artist.name)}</h3>
      <p class="summary">Add a decision and learning note to simulate the A&R feedback loop.</p>
    `;
}

function bindNotesForm() {
  $("#notesForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const artist = getArtist();
    const note = {
      decision: $("#decisionInput").value,
      reason: $("#reasonInput").value,
      note: $("#noteInput").value.trim(),
      savedAt: new Date().toISOString()
    };
    localStorage.setItem(`asi-note-${artist.id}`, JSON.stringify(note));
    $("#noteInput").value = "";
    renderNotes();
  });
}

function renderStrategy() {
  const artist = getArtist();
  $("#strategyPanel").innerHTML = `
    <h3>${escapeHtml(artist.recommendation)}</h3>
    <p>${escapeHtml(artist.strategy)}</p>
    <h3>Disconfirming evidence to watch</h3>
    <p>${escapeHtml(artist.disconfirmingEvidence)}</p>
  `;
}

function renderReport() {
  const artist = getArtist();
  const mode = getMode();
  const report = [
    `ASI SCOUTING REPORT PREVIEW`,
    `Status: ${state.data.status === "private-browser-import" ? "Private browser import. Do not publish without separate approval." : "Fictional fixture for public-safe prototype"}`,
    ``,
    `Artist: ${artist.name}`,
    `Buyer lens: ${mode.label}`,
    `Buyer-fit score: ${weightedScore(artist, mode)}/100`,
    `Base score: ${baseScore(artist)}/100`,
    `Confidence: ${artist.confidence}`,
    ``,
    `Boardroom summary:`,
    artist.summary,
    ``,
    `Scene/community context:`,
    artist.scene,
    ``,
    `Top signals:`,
    ...artist.signals.map((signal) => {
      const source = signal.sourceUrl && signal.sourceUrl !== "Unknown" ? ` Source: ${signal.sourceUrl}` : " Source: Unknown";
      const observed = signal.observedDate ? ` Observed: ${signal.observedDate}.` : " Observed: Unknown.";
      return `- ${signal.category}: ${signal.detail} (${signal.confidence}; ${signal.label}).${observed}${source}`;
    }),
    ``,
    `Risks:`,
    ...artist.risks.map((risk) => `- ${risk}`),
    ``,
    `Recommended strategy:`,
    artist.strategy,
    ``,
    `Disconfirming evidence:`,
    artist.disconfirmingEvidence,
    ``,
    `Approval note: This preview is not a public artist ranking or a real artist claim.`
  ].join("\n");
  $("#reportPreview").textContent = report;
}

function currentReportText() {
  return $("#reportPreview").textContent || "";
}

function safeFileSegment(value) {
  return String(value || "artist")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "artist";
}

async function copyReport() {
  const report = currentReportText();
  if (!navigator.clipboard?.writeText) {
    $("#exportStatus").textContent = "Copy is unavailable in this browser. Select the report text manually.";
    return;
  }
  await navigator.clipboard.writeText(report);
  $("#exportStatus").textContent = "Copied Markdown report to clipboard. Private imports still require publication approval.";
}

function downloadReport() {
  const artist = getArtist();
  const date = new Date().toISOString().slice(0, 10);
  const filename = `asi-report-${safeFileSegment(artist.name)}-${date}.md`;
  const blob = new Blob([currentReportText()], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  $("#exportStatus").textContent = `Downloaded ${filename}. Do not publish private artist packets without separate approval.`;
}

function renderGates() {
  $("#gateGrid").innerHTML = state.data.approvalGates
    .map(
      (gate) => `
        <article class="gate-card">
          <strong>Blocked</strong>
          <span>${escapeHtml(gate)}</span>
        </article>
      `
    )
    .join("");
}

function normalizeSignal(rawSignal, signalIndex, artistName) {
  if (!rawSignal || typeof rawSignal !== "object") {
    throw new Error(`${artistName} signal ${signalIndex + 1} is not an object.`);
  }

  const category = String(rawSignal.category || "").trim();
  const label = String(rawSignal.label || "").trim();
  const observedDate = String(rawSignal.observedDate || "").trim();
  const sourceUrl = String(rawSignal.sourceUrl || "").trim();
  const confidence = String(rawSignal.confidence || "").trim();
  const detail = String(rawSignal.detail || "").trim();
  const freshness = String(rawSignal.freshness || observedDate || "Unknown").trim();

  if (!category) throw new Error(`${artistName} signal ${signalIndex + 1} is missing category.`);
  if (!sourceLabels.includes(label)) {
    throw new Error(`${artistName} signal ${signalIndex + 1} needs a valid source label.`);
  }
  if (!confidenceLabels.includes(confidence)) {
    throw new Error(`${artistName} signal ${signalIndex + 1} needs a valid confidence label.`);
  }
  if (!validDateOrUnknown(observedDate)) {
    throw new Error(`${artistName} signal ${signalIndex + 1} needs observedDate as YYYY-MM-DD or Unknown.`);
  }
  if (!validEvidenceUrl(sourceUrl, label)) {
    throw new Error(`${artistName} signal ${signalIndex + 1} needs an https sourceUrl, or sourceUrl Unknown when label is Unknown.`);
  }
  if (detail.length < 12) {
    throw new Error(`${artistName} signal ${signalIndex + 1} needs a specific evidence detail.`);
  }

  return { category, label, freshness, confidence, detail, observedDate, sourceUrl };
}

function normalizeArtist(rawArtist, index) {
  if (!rawArtist || typeof rawArtist !== "object") {
    throw new Error(`Artist ${index + 1} is not an object.`);
  }

  const name = String(rawArtist.name || "").trim();
  if (!name) throw new Error(`Artist ${index + 1} is missing a name.`);
  if (!hasText(rawArtist.scene)) throw new Error(`${name} is missing scene/community context.`);
  if (!hasText(rawArtist.summary)) throw new Error(`${name} is missing a summary.`);
  if (!rawArtist.scores || typeof rawArtist.scores !== "object") throw new Error(`${name} is missing scores.`);
  if (!hasText(rawArtist.recommendation)) throw new Error(`${name} is missing a recommendation.`);
  if (!hasText(rawArtist.strategy)) throw new Error(`${name} is missing a strategy.`);
  if (!hasText(rawArtist.disconfirmingEvidence)) throw new Error(`${name} is missing disconfirming evidence.`);
  if (!Array.isArray(rawArtist.risks) || !rawArtist.risks.length) throw new Error(`${name} needs at least one risk or unknown.`);

  const scores = {};
  Object.entries(maxPoints).forEach(([key, max]) => {
    if (!(key in rawArtist.scores)) {
      throw new Error(`${name} is missing score dimension ${key}.`);
    }
    if (!Number.isFinite(Number(rawArtist.scores[key]))) {
      throw new Error(`${name} score ${key} must be numeric.`);
    }
    scores[key] = clampScore(rawArtist.scores?.[key], max);
  });
  if (!confidenceLabels.includes(rawArtist.confidence)) {
    throw new Error(`${name} needs a valid confidence label.`);
  }

  const signals = Array.isArray(rawArtist.signals)
    ? rawArtist.signals.map((signal, signalIndex) => normalizeSignal(signal, signalIndex, name))
    : [];

  if (!signals.length) {
    throw new Error(`${name} needs at least one source-separated signal.`);
  }

  return {
    id: String(rawArtist.id || `private-review-${index + 1}`),
    name,
    stage: String(rawArtist.stage || "Manual private review"),
    scene: String(rawArtist.scene || "Unknown scene/community context"),
    summary: String(rawArtist.summary || "No summary provided."),
    scores,
    confidence: rawArtist.confidence,
    recommendation: String(rawArtist.recommendation || "Needs more research"),
    strategy: String(rawArtist.strategy || "No strategy recommendation provided."),
    disconfirmingEvidence: String(rawArtist.disconfirmingEvidence || "No disconfirming evidence provided."),
    risks: Array.isArray(rawArtist.risks) && rawArtist.risks.length
      ? rawArtist.risks.map((risk) => String(risk))
      : ["Unknowns remain unresolved"],
    signals
  };
}

function normalizeImport(rawPacket) {
  if (!rawPacket || typeof rawPacket !== "object" || Array.isArray(rawPacket)) {
    throw new Error("Import must be a strict private-browser-import packet object.");
  }
  if (rawPacket.status !== "private-browser-import") {
    throw new Error("Import status must be private-browser-import.");
  }
  if (rawPacket.reviewMode !== "manual-public-evidence-only") {
    throw new Error("reviewMode must be manual-public-evidence-only.");
  }
  if (!hasText(rawPacket.analyst)) throw new Error("Import needs analyst name or initials.");
  if (!validDateOrUnknown(rawPacket.createdAt) || rawPacket.createdAt === "Unknown") {
    throw new Error("Import needs createdAt as YYYY-MM-DD.");
  }
  if (rawPacket.publicationApproval !== "not-approved") {
    throw new Error("publicationApproval must remain not-approved inside this prototype.");
  }
  if (!hasText(rawPacket.dataPolicy)) throw new Error("Import needs a dataPolicy statement.");

  const artistsInput = Array.isArray(rawPacket.artists) ? rawPacket.artists : [];

  if (!artistsInput.length) {
    throw new Error("Import must contain a non-empty artists array.");
  }

  return {
    ...state.defaultData,
    status: "private-browser-import",
    artists: artistsInput.map(normalizeArtist)
  };
}

function loadImportedPacket(packet, label) {
  const normalized = normalizeImport(packet);
  state.data = normalized;
  state.activeArtistId = normalized.artists[0].id;
  state.dataSourceLabel = label;
  $("#importStatus").textContent = `Loaded ${normalized.artists.length} private artist record(s) into this browser session only.`;
  renderAll();
}

function bindImportForm() {
  $("#schemaPreview").textContent = JSON.stringify(importTemplate, null, 2);

  $("#sampleImportButton").addEventListener("click", () => {
    $("#importInput").value = JSON.stringify(importTemplate, null, 2);
    $("#importStatus").textContent = "Template inserted. Replace placeholder values before private review.";
  });

  $("#resetFixturesButton").addEventListener("click", () => {
    state.data = structuredClone(state.defaultData);
    state.activeArtistId = state.data.artists[0].id;
    state.dataSourceLabel = "Fictional fixtures";
    $("#importInput").value = "";
    $("#importFile").value = "";
    $("#importStatus").textContent = "Reset to fictional fixtures.";
    renderAll();
  });

  $("#importFile").addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    $("#importInput").value = await file.text();
    $("#importStatus").textContent = `Loaded ${file.name} into the text box. Review, then load into dashboard.`;
  });

  $("#importForm").addEventListener("submit", (event) => {
    event.preventDefault();
    try {
      const text = $("#importInput").value.trim();
      if (!text) throw new Error("Paste JSON or choose a JSON file first.");
      loadImportedPacket(JSON.parse(text), "Private browser import");
    } catch (error) {
      $("#importStatus").textContent = `Import failed: ${error.message}`;
    }
  });
}

function bindExportActions() {
  $("#copyReportButton").addEventListener("click", async () => {
    try {
      await copyReport();
    } catch (error) {
      $("#exportStatus").textContent = `Copy failed: ${error.message}`;
    }
  });

  $("#downloadReportButton").addEventListener("click", () => {
    try {
      downloadReport();
    } catch (error) {
      $("#exportStatus").textContent = `Download failed: ${error.message}`;
    }
  });
}

function renderAll() {
  if (!state.data) return;
  $("#modeSummary").textContent = `${getMode().description} Data source: ${state.dataSourceLabel}.`;
  renderWatchlist();
  renderBrief();
  renderEvidence();
  renderScoring();
  renderNotes();
  renderStrategy();
  renderReport();
  renderGates();
}

async function init() {
  const response = await fetch("./data/placeholder-artists.json", { cache: "no-store" });
  state.data = await response.json();
  state.defaultData = structuredClone(state.data);
  state.activeArtistId = state.data.artists[0].id;
  renderModeControl();
  renderTabs();
  bindNotesForm();
  bindImportForm();
  bindExportActions();
  renderAll();
}

init().catch((error) => {
  document.body.innerHTML = `
    <main class="app-shell">
      <section class="detail-panel">
        <p class="eyebrow">Prototype load error</p>
        <h1>Artist Signal Intelligence</h1>
        <p>The local fixture data did not load. Serve this folder with a static file server and try again.</p>
        <pre>${escapeHtml(error.message)}</pre>
      </section>
    </main>
  `;
});
