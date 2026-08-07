const state = {
  data: null,
  activeArtistId: null,
  buyerModeId: "distributor"
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
  $("#modeSummary").textContent = getMode().description;
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
              <h3>${artist.name}</h3>
            </div>
            <div class="score-badge">${fit}</div>
          </div>
          <p class="summary">${artist.summary}</p>
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
              <strong class="${confidenceClass(artist.confidence)}">${artist.confidence}</strong>
            </div>
          </div>
          <div>
            <span class="mini-label">Recommended next action</span>
            <p>${artist.recommendation}</p>
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
    <p class="eyebrow">${artist.stage}</p>
    <h3>${artist.name}</h3>
    <p>${artist.summary}</p>
    <div class="stat-grid">
      <div class="stat"><span class="mini-label">Buyer fit</span><strong>${weightedScore(artist, mode)}</strong></div>
      <div class="stat"><span class="mini-label">Base score</span><strong>${baseScore(artist)}</strong></div>
      <div class="stat"><span class="mini-label">Confidence</span><strong>${artist.confidence}</strong></div>
      <div class="stat"><span class="mini-label">Mode</span><strong>${mode.label.split(" ")[0]}</strong></div>
    </div>
    <h3>Scene and network context</h3>
    <p>${artist.scene}</p>
  `;
  $("#riskPanel").innerHTML = `
    <h3>Risks and unknowns</h3>
    <ul class="check-list">${artist.risks.map((risk) => `<li>${risk}</li>`).join("")}</ul>
  `;
}

function renderEvidence() {
  const artist = getArtist();
  $("#evidenceList").innerHTML = artist.signals
    .map(
      (signal) => `
        <article class="evidence-item">
          <div>
            <p class="eyebrow">${signal.category}</p>
            <strong>${signal.label}</strong>
          </div>
          <p>${signal.detail}</p>
          <div class="tag-row">
            <span class="tag">${signal.confidence}</span>
            <span class="tag">${signal.freshness}</span>
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
      <h3>${saved.decision}</h3>
      <p><strong>Reason:</strong> ${saved.reason}</p>
      <p>${saved.note || "No note text saved."}</p>
      <p class="summary">This is not backend storage and will not sync across users or devices.</p>
    `
    : `
      <p class="eyebrow">No saved local note</p>
      <h3>${artist.name}</h3>
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
    <h3>${artist.recommendation}</h3>
    <p>${artist.strategy}</p>
    <h3>Disconfirming evidence to watch</h3>
    <p>${artist.disconfirmingEvidence}</p>
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
          <span>${gate}</span>
        </article>
      `
    )
    .join("");
}

function renderAll() {
  if (!state.data) return;
  $("#modeSummary").textContent = getMode().description;
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
  state.activeArtistId = state.data.artists[0].id;
  renderModeControl();
  renderTabs();
  bindNotesForm();
  renderAll();
}

init().catch((error) => {
  document.body.innerHTML = `
    <main class="app-shell">
      <section class="detail-panel">
        <p class="eyebrow">Prototype load error</p>
        <h1>Artist Signal Intelligence</h1>
        <p>The local fixture data did not load. Serve this folder with a static file server and try again.</p>
        <pre>${error.message}</pre>
      </section>
    </main>
  `;
});
