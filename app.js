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

const importTemplate = {
  status: "private-browser-import",
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
          freshness: "YYYY-MM-DD observed date",
          confidence: "Low",
          detail: "Analyst note. Include source URL in the note if approved for private review."
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
  return ["High", "Medium", "Low", "Insufficient"].includes(value) ? value : "Insufficient";
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
        <article class="artist-card ${artist.id === state.activeArtistId ? "is-active" : ""}" data-artist-id="${artist.id}" tabindex="0">
          <div class="card-topline">
            <div>
              <p class="eyebrow">Fictional fixture</p>
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
    `Status: Fictional fixture for public-safe prototype`,
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
    ...artist.signals.map((signal) => `- ${signal.category}: ${signal.detail} (${signal.confidence})`),
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

function normalizeArtist(rawArtist, index) {
  if (!rawArtist || typeof rawArtist !== "object") {
    throw new Error(`Artist ${index + 1} is not an object.`);
  }

  const name = String(rawArtist.name || "").trim();
  if (!name) throw new Error(`Artist ${index + 1} is missing a name.`);

  const scores = {};
  Object.entries(maxPoints).forEach(([key, max]) => {
    scores[key] = clampScore(rawArtist.scores?.[key], max);
  });

  const signals = Array.isArray(rawArtist.signals)
    ? rawArtist.signals.map((signal) => ({
        category: String(signal.category || "Uncategorized signal"),
        label: String(signal.label || "Unknown"),
        freshness: String(signal.freshness || "Unknown"),
        confidence: validConfidence(signal.confidence),
        detail: String(signal.detail || "No detail provided.")
      }))
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
    confidence: validConfidence(rawArtist.confidence),
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
  const artistsInput = Array.isArray(rawPacket?.artists)
    ? rawPacket.artists
    : rawPacket?.artist
      ? [rawPacket.artist]
      : Array.isArray(rawPacket)
        ? rawPacket
        : [];

  if (!artistsInput.length) {
    throw new Error("Import must contain an artists array, an artist object, or an array of artists.");
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
