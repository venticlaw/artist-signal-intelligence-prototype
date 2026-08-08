const state = {
  data: null,
  defaultData: null,
  activeArtistId: null,
  buyerModeId: "distributor",
  dataSourceLabel: "Fictional fixtures",
  filters: {
    search: "",
    confidence: "all",
    minimumFit: 0,
    sort: "buyerFit"
  },
  questionnairePacket: "",
  discovery: {
    candidates: [],
    packet: null
  }
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
const confidenceRank = { High: 4, Medium: 3, Low: 2, Insufficient: 1 };

const discoverySampleRows = [
  {
    handle: "@fictional_signal_a",
    displayName: "Fictional Signal A",
    caption: "new hook demo from the east side alt rnb scene #altrnb #unsignedartist",
    url: "https://www.tiktok.com/@fictional_signal_a/video/0000000000000000001",
    soundTitle: "Original sound - Fictional Signal A",
    hashtags: "altrnb,unsignedartist,eastside",
    region: "US",
    observedDate: "2026-08-08",
    views: 18400,
    likes: 2100,
    comments: 184,
    shares: 72
  },
  {
    handle: "@fictional_signal_a",
    displayName: "Fictional Signal A",
    caption: "fans asking when the full version drops #altrnb #newmusic",
    url: "https://www.tiktok.com/@fictional_signal_a/video/0000000000000000002",
    soundTitle: "Original sound - Fictional Signal A",
    hashtags: "altrnb,newmusic",
    region: "US",
    observedDate: "2026-08-08",
    views: 9600,
    likes: 980,
    comments: 116,
    shares: 35
  },
  {
    handle: "@fictional_signal_b",
    displayName: "Fictional Signal B",
    caption: "bedroom pop chorus getting stitched by local creators #bedroompop #unsigned",
    url: "https://www.tiktok.com/@fictional_signal_b/video/0000000000000000003",
    soundTitle: "Original sound - Fictional Signal B",
    hashtags: "bedroompop,unsigned",
    region: "CA",
    observedDate: "2026-08-08",
    views: 22600,
    likes: 1700,
    comments: 88,
    shares: 141
  }
];

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
      developments: [
        {
          date: "YYYY-MM-DD",
          type: "Public development",
          detail: "Publicly observed artist development.",
          sourceUrl: "https://public-source-url.example/path",
          confidence: "Low",
          buyerRelevance: "Why this matters for the selected buyer lens.",
          scoreImpact: "Which score dimension this should affect."
        }
      ],
      relationships: [
        {
          type: "Collaborator / scene / venue / curator / brand context",
          name: "PUBLIC RELATIONSHIP CONTEXT",
          evidence: "Public evidence supporting this relationship edge.",
          sourceUrl: "https://public-source-url.example/path",
          confidence: "Low",
          scoreUse: "Context only until reviewed"
        }
      ],
      feedbackLearning: {
        expectedPassReason: "Weak evidence",
        missingContext: "What an A&R reviewer may need before trusting this recommendation.",
        misleadingSignalRisk: "Which signal might be overweighted.",
        suggestedModelAdjustment: "Proposed scoring or taxonomy change. Human approval required before use."
      },
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

function externalSourceLink(url) {
  if (!url || url === "Unknown") return '<span class="tag warning">Source URL unknown</span>';
  const escapedUrl = escapeHtml(url);
  return `<a class="source-link" href="${escapedUrl}" target="_blank" rel="noopener noreferrer">Open source</a>`;
}

function currentSavedNote() {
  const artist = getArtist();
  try {
    return JSON.parse(localStorage.getItem(`asi-note-${artist.id}`) || "null");
  } catch {
    return null;
  }
}

function getMode() {
  return state.data.buyerModes.find((mode) => mode.id === state.buyerModeId);
}

function getArtist() {
  return state.data.artists.find((artist) => artist.id === state.activeArtistId);
}

function artistSearchText(artist) {
  return [
    artist.name,
    artist.stage,
    artist.scene,
    artist.summary,
    artist.recommendation,
    artist.strategy,
    artist.disconfirmingEvidence,
    ...(artist.risks || []),
    ...(artist.signals || []).flatMap((signal) => [signal.category, signal.label, signal.detail])
  ].join(" ").toLowerCase();
}

function filteredArtists() {
  const mode = getMode();
  const query = state.filters.search.trim().toLowerCase();
  return [...state.data.artists]
    .filter((artist) => {
      const fit = weightedScore(artist, mode);
      const confidenceMatch = state.filters.confidence === "all" || artist.confidence === state.filters.confidence;
      const fitMatch = fit >= state.filters.minimumFit;
      const searchMatch = !query || artistSearchText(artist).includes(query);
      return confidenceMatch && fitMatch && searchMatch;
    })
    .sort((a, b) => {
      if (state.filters.sort === "baseScore") return baseScore(b) - baseScore(a);
      if (state.filters.sort === "confidence") return (confidenceRank[b.confidence] || 0) - (confidenceRank[a.confidence] || 0);
      if (state.filters.sort === "name") return a.name.localeCompare(b.name);
      return weightedScore(b, mode) - weightedScore(a, mode);
    });
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

function bindWatchlistControls() {
  $("#searchInput").addEventListener("input", (event) => {
    state.filters.search = event.target.value;
    renderAll();
  });

  $("#confidenceFilter").addEventListener("change", (event) => {
    state.filters.confidence = event.target.value;
    renderAll();
  });

  $("#minimumFit").addEventListener("input", (event) => {
    state.filters.minimumFit = clampScore(event.target.value, 100);
    renderAll();
  });

  $("#sortInput").addEventListener("change", (event) => {
    state.filters.sort = event.target.value;
    renderAll();
  });
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
  const artists = filteredArtists();
  const total = state.data.artists.length;
  const highConfidence = artists.filter((artist) => artist.confidence === "High").length;
  const bestFit = artists[0] ? weightedScore(artists[0], mode) : 0;
  $("#queueSummary").innerHTML = `
    <span>${artists.length}/${total} visible</span>
    <span>${highConfidence} high confidence</span>
    <span>Top fit ${bestFit}</span>
  `;

  $("#watchlistGrid").innerHTML = artists.length
    ? artists
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
    .join("")
    : `
      <article class="detail-panel empty-state">
        <p class="eyebrow">No visible records</p>
        <h3>Adjust filters</h3>
        <p class="summary">No artists match the current search, confidence, and buyer-fit filters.</p>
      </article>
    `;

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

function renderTimeline() {
  const artist = getArtist();
  const developments = artist.developments || [];
  const relationships = artist.relationships || [];

  $("#timelineList").innerHTML = developments.length
    ? developments.map((item) => `
      <article class="timeline-item">
        <div class="timeline-marker" aria-hidden="true"></div>
        <div>
          <div class="card-topline">
            <div>
              <p class="eyebrow">${escapeHtml(item.type || "Public development")}</p>
              <h3>${escapeHtml(item.date || "Unknown date")}</h3>
            </div>
            <span class="tag">${escapeHtml(validConfidence(item.confidence))}</span>
          </div>
          <p>${escapeHtml(item.detail || "No development detail supplied.")}</p>
          <div class="tag-row">
            <span class="tag">${escapeHtml(item.buyerRelevance || "Buyer relevance unknown")}</span>
            <span class="tag">${escapeHtml(item.scoreImpact || "Score impact pending")}</span>
            ${externalSourceLink(item.sourceUrl)}
          </div>
        </div>
      </article>
    `).join("")
    : `
      <article class="detail-panel empty-state">
        <p class="eyebrow">No timeline items</p>
        <h3>Development history pending</h3>
        <p class="summary">Private packets can add granular public developments with source URLs, confidence, and score impact.</p>
      </article>
    `;

  $("#networkPanel").innerHTML = `
    <h3>Community / network edges</h3>
    ${relationships.length
      ? `<div class="network-list">${relationships.map((edge) => `
        <article class="network-edge">
          <p class="eyebrow">${escapeHtml(edge.type || "Relationship context")}</p>
          <h3>${escapeHtml(edge.name || "Unnamed context")}</h3>
          <p>${escapeHtml(edge.evidence || "No relationship evidence supplied.")}</p>
          <div class="tag-row">
            <span class="tag">${escapeHtml(validConfidence(edge.confidence))}</span>
            <span class="tag">${escapeHtml(edge.scoreUse || "Context only")}</span>
            ${externalSourceLink(edge.sourceUrl)}
          </div>
        </article>
      `).join("")}</div>`
      : `<p class="summary">No relationship edges supplied. Add only public, evidence-backed collaborators, venues, scene context, curator context, or brand/music context.</p>`
    }
    <h3>Relationship guardrail</h3>
    <p class="summary">Do not infer private management, label interest, deal terms, revenue, personal demographics, or private relationships.</p>
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
  const mode = getMode();
  $("#scoreBars").innerHTML = Object.entries(maxPoints)
    .map(([key, max]) => {
      const value = artist.scores[key];
      const percent = Math.round((value / max) * 100);
      const weight = mode.weights[key] || 1;
      return `
        <div class="score-bar">
          <div class="score-row">
            <strong>${dimensionLabels[key]}</strong>
            <span>${value}/${max} x ${weight}</span>
          </div>
          <div class="bar-track" aria-hidden="true"><span style="--value: ${percent}%"></span></div>
        </div>
      `;
    })
    .join("");

  const strongest = Object.entries(artist.scores).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const weakest = Object.entries(artist.scores).sort((a, b) => a[1] - b[1]).slice(0, 3);
  $("#scoreExplainer").innerHTML = `
    <h3>Why this score</h3>
    <p>${escapeHtml(mode.label)} emphasizes dimensions differently from the base score. Buyer fit is ${weightedScore(artist, mode)}/100 and base score is ${baseScore(artist)}/100.</p>
    <h3>Strongest dimensions</h3>
    <ul class="check-list">${strongest.map(([key, value]) => `<li>${escapeHtml(dimensionLabels[key])}: ${value}/${maxPoints[key]}</li>`).join("")}</ul>
    <h3>Weakest dimensions</h3>
    <ul class="check-list">${weakest.map(([key, value]) => `<li>${escapeHtml(dimensionLabels[key])}: ${value}/${maxPoints[key]}</li>`).join("")}</ul>
    <h3>Guardrails</h3>
    <ul class="check-list">
      <li>Source categories stay separate.</li>
      <li>Unknowns remain visible.</li>
      <li>Suspicious or impossible values lower confidence.</li>
      <li>Human review is required before score-rule changes.</li>
    </ul>
  `;
}

function renderCompare() {
  const mode = getMode();
  const artists = filteredArtists();
  const rows = artists.map((artist) => `
    <tr>
      <td><button class="table-link" type="button" data-artist-id="${escapeHtml(artist.id)}">${escapeHtml(artist.name)}</button></td>
      <td>${weightedScore(artist, mode)}</td>
      <td>${baseScore(artist)}</td>
      <td>${escapeHtml(artist.confidence)}</td>
      <td>${escapeHtml(artist.stage)}</td>
      <td>${escapeHtml(artist.recommendation)}</td>
      <td>${escapeHtml(artist.risks[0] || "No risk listed")}</td>
    </tr>
  `).join("");

  $("#compareTable").innerHTML = `
    <thead>
      <tr>
        <th>Artist</th>
        <th>Buyer fit</th>
        <th>Base</th>
        <th>Confidence</th>
        <th>Stage</th>
        <th>Next action</th>
        <th>Top risk</th>
      </tr>
    </thead>
    <tbody>
      ${rows || '<tr><td colspan="7">No artists match the current filters.</td></tr>'}
    </tbody>
  `;

  document.querySelectorAll(".table-link").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeArtistId = button.dataset.artistId;
      renderAll();
      document.querySelector('[data-tab="brief"]').click();
    });
  });
}

function renderNotes() {
  const reasonInput = $("#reasonInput");
  reasonInput.innerHTML = state.data.passReasons
    .map((reason) => `<option>${reason}</option>`)
    .join("");

  const artist = getArtist();
  const saved = currentSavedNote();
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

function renderLearning() {
  const artist = getArtist();
  const saved = currentSavedNote();
  const learning = artist.feedbackLearning || {};
  const selectedReason = saved?.reason || learning.expectedPassReason || "No reviewer reason saved yet";
  const selectedDecision = saved?.decision || "No saved decision";
  const reviewerNote = saved?.note || "No human learning note saved for this artist yet.";
  const proposedAdjustment = learning.suggestedModelAdjustment || "No model adjustment proposed until reviewer feedback accumulates.";

  $("#learningPanel").innerHTML = `
    <h3>Human review state</h3>
    <div class="stat-grid two-col">
      <div class="stat"><span class="mini-label">Decision</span><strong>${escapeHtml(selectedDecision)}</strong></div>
      <div class="stat"><span class="mini-label">Reason</span><strong>${escapeHtml(selectedReason)}</strong></div>
    </div>
    <h3>Reviewer learning note</h3>
    <p>${escapeHtml(reviewerNote)}</p>
    <h3>What the system should learn</h3>
    <ul class="check-list">
      <li>Missing context: ${escapeHtml(learning.missingContext || "Not specified.")}</li>
      <li>Misleading signal risk: ${escapeHtml(learning.misleadingSignalRisk || "Not specified.")}</li>
      <li>Proposed model adjustment: ${escapeHtml(proposedAdjustment)}</li>
    </ul>
  `;

  $("#feedbackPanel").innerHTML = `
    <h3>Learning guardrails</h3>
    <ul class="check-list">
      <li>Feedback proposes changes only.</li>
      <li>No automatic model-weight updates.</li>
      <li>No sensitive demographic inference.</li>
      <li>No private relationship assumptions.</li>
      <li>No unsupported reputation claims.</li>
      <li>Josh or an approved reviewer validates scoring changes before use.</li>
    </ul>
    <h3>Review cadence</h3>
    <p class="summary">Review recurring pass reasons after 25 artist reviews or once per week, whichever comes first.</p>
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
    renderLearning();
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
    `Granular developments:`,
    ...(artist.developments?.length
      ? artist.developments.map((item) => `- ${item.date}: ${item.detail} (${item.confidence}). Source: ${item.sourceUrl || "Unknown"}`)
      : [`- No timeline developments supplied.`]),
    ``,
    `Relationship / network context:`,
    ...(artist.relationships?.length
      ? artist.relationships.map((edge) => `- ${edge.type}: ${edge.name}. ${edge.evidence} (${edge.confidence}; ${edge.scoreUse || "Context only"}). Source: ${edge.sourceUrl || "Unknown"}`)
      : [`- No relationship edges supplied.`]),
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
    `Human feedback / model learning:`,
    `- Expected pass reason: ${artist.feedbackLearning?.expectedPassReason || "Not specified"}`,
    `- Missing context: ${artist.feedbackLearning?.missingContext || "Not specified"}`,
    `- Misleading signal risk: ${artist.feedbackLearning?.misleadingSignalRisk || "Not specified"}`,
    `- Suggested model adjustment: ${artist.feedbackLearning?.suggestedModelAdjustment || "No automatic change. Human approval required."}`,
    ``,
    `Approval note: This preview is not a public artist ranking or a real artist claim.`
  ].join("\n");
  $("#reportPreview").textContent = report;
}

function buildQuestionnairePacket() {
  return [
    `# ASI Buyer Requirements Packet`,
    ``,
    `Status: Local draft only`,
    `Generated: ${new Date().toISOString()}`,
    ``,
    `## Buyer Segment`,
    $("#buyerSegmentInput").value,
    ``,
    `## Priority Genres / Scenes / Markets`,
    $("#marketInput").value.trim() || "Not specified.",
    ``,
    `## Deal Or Campaign Goal`,
    $("#goalInput").value.trim() || "Not specified.",
    ``,
    `## Must-Have Signals`,
    $("#mustHaveInput").value.trim() || "Not specified.",
    ``,
    `## Pass Or Caution Criteria`,
    $("#passCriteriaInput").value.trim() || "Not specified.",
    ``,
    `## Existing Systems / Handoff Format`,
    $("#integrationInput").value.trim() || "Not specified.",
    ``,
    `## Required Output Defaults`,
    `- Watchlist with buyer-fit score, base score, confidence, and top risk.`,
    `- Artist brief with scene/community context and relationship/network notes.`,
    `- Source-separated evidence with label, observed date, source URL, freshness, and confidence.`,
    `- A&R decision note with pass/caution reason and human learning note.`,
    `- Markdown scouting report export for private review.`,
    ``,
    `## Gated Until Separately Approved`,
    `No outreach, scraping, paid datasets/APIs, backend storage, lead capture, public real-artist rankings, payment, DNS, Drive movement, outbound sends, or deletion.`
  ].join("\n");
}

function renderQuestionnairePacket() {
  state.questionnairePacket = buildQuestionnairePacket();
  $("#questionnairePreview").textContent = state.questionnairePacket;
}

function splitCsvLine(line) {
  const cells = [];
  let current = "";
  let quoted = false;
  for (const char of line) {
    if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells.map((cell) => cell.replace(/^"|"$/g, ""));
}

function parseDiscoveryRows(input) {
  const text = input.trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) throw new Error("JSON discovery input must be an array.");
    return parsed.map(normalizeDiscoveryRow);
  } catch {
    const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
    if (lines.length < 2) throw new Error("CSV discovery input needs a header row and at least one result row.");
    const headers = splitCsvLine(lines[0]).map((header) => header.trim());
    return lines.slice(1).map((line) => {
      const cells = splitCsvLine(line);
      const row = Object.fromEntries(headers.map((header, index) => [header, cells[index] || ""]));
      return normalizeDiscoveryRow(row);
    });
  }
}

function normalizeDiscoveryRow(row) {
  const handle = String(row.handle || row.username || "").trim();
  const displayName = String(row.displayName || row.name || handle || "Unknown candidate").trim();
  const caption = String(row.caption || row.description || "").trim();
  const url = String(row.url || row.videoUrl || row.sourceUrl || "").trim();
  const observedDate = String(row.observedDate || row.date || new Date().toISOString().slice(0, 10)).trim();
  if (!handle) throw new Error("Each discovery row needs handle or username.");
  if (!caption) throw new Error(`${handle} needs caption or description text.`);
  if (!validEvidenceUrl(url, url === "Unknown" ? "Unknown" : "Observed")) {
    throw new Error(`${handle} needs an https url, or Unknown.`);
  }
  if (!validDateOrUnknown(observedDate)) {
    throw new Error(`${handle} needs observedDate as YYYY-MM-DD or Unknown.`);
  }
  return {
    handle,
    displayName,
    caption,
    url,
    soundTitle: String(row.soundTitle || row.sound || "").trim(),
    hashtags: String(row.hashtags || "").trim(),
    region: String(row.region || row.region_code || "").trim(),
    observedDate,
    views: Number(row.views || row.view_count || 0) || 0,
    likes: Number(row.likes || row.like_count || 0) || 0,
    comments: Number(row.comments || row.comment_count || 0) || 0,
    shares: Number(row.shares || row.share_count || 0) || 0
  };
}

function scoreDiscoveryCandidate(rows) {
  const totals = rows.reduce((sum, row) => ({
    views: sum.views + row.views,
    likes: sum.likes + row.likes,
    comments: sum.comments + row.comments,
    shares: sum.shares + row.shares
  }), { views: 0, likes: 0, comments: 0, shares: 0 });
  const engagementRate = totals.views ? (totals.likes + totals.comments + totals.shares) / totals.views : 0;
  const repeatSignal = rows.length > 1 ? 1 : 0;
  const commentQuality = totals.comments >= 100 ? 1 : totals.comments >= 25 ? 0.5 : 0;
  const shareQuality = totals.shares >= 100 ? 1 : totals.shares >= 25 ? 0.5 : 0;
  const score = Math.round(Math.min(100, (engagementRate * 500) + (repeatSignal * 18) + (commentQuality * 12) + (shareQuality * 12)));
  return { ...totals, engagementRate, score };
}

function clusterDiscoveryRows(rows) {
  const grouped = new Map();
  rows.forEach((row) => {
    const key = row.handle.toLowerCase();
    const current = grouped.get(key) || [];
    current.push(row);
    grouped.set(key, current);
  });

  return [...grouped.values()].map((candidateRows) => {
    const first = candidateRows[0];
    const stats = scoreDiscoveryCandidate(candidateRows);
    const tags = [...new Set(candidateRows.flatMap((row) => row.hashtags.split(/[,\s#]+/)).filter(Boolean))].slice(0, 8);
    const sounds = [...new Set(candidateRows.map((row) => row.soundTitle).filter(Boolean))].slice(0, 4);
    return {
      handle: first.handle,
      displayName: first.displayName,
      rows: candidateRows,
      stats,
      tags,
      sounds,
      region: first.region || "Unknown",
      observedDate: first.observedDate
    };
  }).sort((a, b) => b.stats.score - a.stats.score);
}

function discoveryScores(candidate) {
  const score = candidate.stats.score;
  return {
    momentum: clampScore(Math.round(score / 5), 20),
    engagement: clampScore(Math.round((candidate.stats.engagementRate || 0) * 180), 15),
    community: clampScore(candidate.rows.length > 1 ? 8 : 4, 15),
    catalog: 2,
    relationships: clampScore(candidate.sounds.length + candidate.tags.length, 10),
    live: 0,
    press: 0,
    reliability: clampScore(candidate.rows.length > 1 ? 6 : 4, 10)
  };
}

function buildDiscoveryQueryPlan() {
  const objective = $("#discoveryObjectiveInput").value.trim() || "Find emerging artists from approved TikTok result rows.";
  const seeds = $("#discoverySeedsInput").value.split(/[\n,]+/).map((seed) => seed.trim()).filter(Boolean);
  return [
    `# TikTok Discovery Query Plan`,
    ``,
    `Status: No live calls from this prototype`,
    `Objective: ${objective}`,
    ``,
    `## Seed Terms`,
    ...(seeds.length ? seeds.map((seed) => `- ${seed}`) : [`- No seed terms entered.`]),
    ``,
    `## Approved Connector Fields`,
    `- keyword`,
    `- hashtag_name`,
    `- username`,
    `- music_id`,
    `- region_code`,
    `- start_date / end_date`,
    ``,
    `## Review Rule`,
    `Use only approved API/vendor/manual rows. Do not scrape, login-scrape, automate browser extraction, or publish real-artist rankings.`
  ].join("\n");
}

function buildDiscoveryPacket(candidates) {
  const createdAt = new Date().toISOString().slice(0, 10);
  const sourceLabel = (url) => url && url !== "Unknown" ? "Observed" : "Unknown";
  return {
    status: "private-browser-import",
    reviewMode: "manual-public-evidence-only",
    analyst: "ASI Discovery Workbench",
    createdAt,
    publicationApproval: "not-approved",
    dataPolicy: "Approved/manual TikTok result rows only. No scraping, paid/gated/login-only sources, private data, outreach, or automated browser extraction.",
    artists: candidates.map((candidate, index) => ({
      id: `tiktok-candidate-${index + 1}-${safeFileSegment(candidate.handle)}`,
      name: `${candidate.displayName} (${candidate.handle})`,
      stage: "TikTok discovery candidate",
      scene: [candidate.region !== "Unknown" ? `Region ${candidate.region}` : "Region unknown", candidate.tags.length ? `Tags: ${candidate.tags.join(", ")}` : "Tags pending"].join(". "),
      summary: `Candidate clustered from ${candidate.rows.length} approved/manual TikTok result row(s). Discovery score ${candidate.stats.score}/100 based on visible row-level engagement and repeat-signal count.`,
      scores: discoveryScores(candidate),
      confidence: candidate.rows.length > 1 ? "Medium" : "Low",
      recommendation: candidate.stats.score >= 45 ? "Needs human review for artist validation and source expansion." : "Watch only after more manually reviewed evidence.",
      strategy: "Confirm this is an artist account, validate catalog/off-platform presence, then add source-separated evidence before any buyer recommendation.",
      disconfirmingEvidence: "Account is not an artist, engagement is trend-only, the sound is not original or artist-affiliated, or follow-up public evidence does not support music-market traction.",
      risks: [
        "TikTok row-level signal may not map to listener behavior",
        "Candidate identity needs human validation",
        "No outreach or public ranking approved"
      ],
      developments: candidate.rows.map((row) => ({
        date: row.observedDate,
        type: "TikTok public result row",
        detail: row.caption,
        sourceUrl: row.url,
        confidence: "Low",
        buyerRelevance: `Visible engagement row: ${row.views} views, ${row.likes} likes, ${row.comments} comments, ${row.shares} shares.`,
        scoreImpact: "Momentum and engagement proxy"
      })),
      relationships: candidate.sounds.map((sound) => ({
        type: "Sound context",
        name: sound,
        evidence: `Repeated or associated sound context observed in approved/manual result rows for ${candidate.handle}.`,
        sourceUrl: candidate.rows[0]?.url || "Unknown",
        confidence: "Low",
        scoreUse: "Context only until reviewed"
      })),
      feedbackLearning: {
        expectedPassReason: "Needs human review",
        missingContext: "Catalog, artist identity, originality of sound, and off-platform evidence.",
        misleadingSignalRisk: "TikTok engagement may be creator trend behavior rather than artist demand.",
        suggestedModelAdjustment: "Treat TikTok discovery as candidate generation, not final scoring."
      },
      signals: [
        {
          category: "TikTok discovery momentum",
          label: sourceLabel(candidate.rows[0]?.url),
          observedDate: candidate.observedDate,
          sourceUrl: candidate.rows[0]?.url || "Unknown",
          freshness: candidate.observedDate,
          confidence: candidate.rows.length > 1 ? "Medium" : "Low",
          detail: `${candidate.rows.length} approved/manual result row(s), ${candidate.stats.views} total visible views, ${candidate.stats.comments} comments, ${candidate.stats.shares} shares.`
        }
      ]
    }))
  };
}

function renderDiscoveryWorkbench() {
  $("#queryPlanPreview").textContent = buildDiscoveryQueryPlan();
  const candidates = state.discovery.candidates;
  $("#candidateList").innerHTML = candidates.length
    ? candidates.map((candidate) => `
      <article class="candidate-card">
        <div class="card-topline">
          <div>
            <p class="eyebrow">${escapeHtml(candidate.handle)}</p>
            <h3>${escapeHtml(candidate.displayName)}</h3>
          </div>
          <div class="score-badge small-badge">${candidate.stats.score}</div>
        </div>
        <p class="summary">${candidate.rows.length} row(s), ${candidate.stats.views} views, ${candidate.stats.comments} comments, ${candidate.stats.shares} shares.</p>
        <div class="tag-row">
          ${candidate.tags.map((tag) => `<span class="tag">#${escapeHtml(tag)}</span>`).join("")}
          <span class="tag">${escapeHtml(candidate.region)}</span>
        </div>
      </article>
    `).join("")
    : `
      <article class="empty-state">
        <p class="eyebrow">No candidate clusters</p>
        <h3>Paste approved/manual rows</h3>
        <p class="summary">The workbench clusters pasted rows by handle and converts them into a private ASI packet.</p>
      </article>
    `;
  $("#discoveryPacketPreview").textContent = state.discovery.packet
    ? JSON.stringify(state.discovery.packet, null, 2)
    : "No ASI packet generated yet.";
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

async function copyQuestionnaire() {
  renderQuestionnairePacket();
  if (!navigator.clipboard?.writeText) {
    $("#questionnaireStatus").textContent = "Copy is unavailable in this browser. Select the packet text manually.";
    return;
  }
  await navigator.clipboard.writeText(state.questionnairePacket);
  $("#questionnaireStatus").textContent = "Copied buyer requirements packet to clipboard.";
}

function downloadQuestionnaire() {
  renderQuestionnairePacket();
  const date = new Date().toISOString().slice(0, 10);
  const filename = `asi-buyer-requirements-${date}.md`;
  const blob = new Blob([state.questionnairePacket], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  $("#questionnaireStatus").textContent = `Downloaded ${filename}.`;
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

function normalizeDevelopment(rawDevelopment, index, artistName) {
  if (!rawDevelopment || typeof rawDevelopment !== "object") {
    throw new Error(`${artistName} development ${index + 1} is not an object.`);
  }
  const date = String(rawDevelopment.date || "").trim();
  const type = String(rawDevelopment.type || "").trim();
  const detail = String(rawDevelopment.detail || "").trim();
  const sourceUrl = String(rawDevelopment.sourceUrl || "").trim();
  const confidence = String(rawDevelopment.confidence || "").trim();
  const buyerRelevance = String(rawDevelopment.buyerRelevance || "").trim();
  const scoreImpact = String(rawDevelopment.scoreImpact || "").trim();

  if (!validDateOrUnknown(date)) {
    throw new Error(`${artistName} development ${index + 1} needs date as YYYY-MM-DD or Unknown.`);
  }
  if (!type) throw new Error(`${artistName} development ${index + 1} is missing type.`);
  if (detail.length < 12) throw new Error(`${artistName} development ${index + 1} needs a specific detail.`);
  if (!validEvidenceUrl(sourceUrl, sourceUrl === "Unknown" ? "Unknown" : "Observed")) {
    throw new Error(`${artistName} development ${index + 1} needs an https sourceUrl or Unknown.`);
  }
  if (!confidenceLabels.includes(confidence)) {
    throw new Error(`${artistName} development ${index + 1} needs a valid confidence label.`);
  }

  return {
    date,
    type,
    detail,
    sourceUrl,
    confidence,
    buyerRelevance: buyerRelevance || "Buyer relevance pending",
    scoreImpact: scoreImpact || "Score impact pending"
  };
}

function normalizeRelationship(rawRelationship, index, artistName) {
  if (!rawRelationship || typeof rawRelationship !== "object") {
    throw new Error(`${artistName} relationship ${index + 1} is not an object.`);
  }
  const type = String(rawRelationship.type || "").trim();
  const name = String(rawRelationship.name || "").trim();
  const evidence = String(rawRelationship.evidence || "").trim();
  const sourceUrl = String(rawRelationship.sourceUrl || "").trim();
  const confidence = String(rawRelationship.confidence || "").trim();
  const scoreUse = String(rawRelationship.scoreUse || "").trim();

  if (!type) throw new Error(`${artistName} relationship ${index + 1} is missing type.`);
  if (!name) throw new Error(`${artistName} relationship ${index + 1} is missing name.`);
  if (evidence.length < 12) throw new Error(`${artistName} relationship ${index + 1} needs public evidence detail.`);
  if (!validEvidenceUrl(sourceUrl, sourceUrl === "Unknown" ? "Unknown" : "Observed")) {
    throw new Error(`${artistName} relationship ${index + 1} needs an https sourceUrl or Unknown.`);
  }
  if (!confidenceLabels.includes(confidence)) {
    throw new Error(`${artistName} relationship ${index + 1} needs a valid confidence label.`);
  }

  return {
    type,
    name,
    evidence,
    sourceUrl,
    confidence,
    scoreUse: scoreUse || "Context only"
  };
}

function normalizeFeedbackLearning(rawFeedback = {}) {
  if (!rawFeedback || typeof rawFeedback !== "object") return {};
  return {
    expectedPassReason: String(rawFeedback.expectedPassReason || ""),
    missingContext: String(rawFeedback.missingContext || ""),
    misleadingSignalRisk: String(rawFeedback.misleadingSignalRisk || ""),
    suggestedModelAdjustment: String(rawFeedback.suggestedModelAdjustment || "")
  };
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

  const developments = Array.isArray(rawArtist.developments)
    ? rawArtist.developments.map((item, itemIndex) => normalizeDevelopment(item, itemIndex, name))
    : [];
  const relationships = Array.isArray(rawArtist.relationships)
    ? rawArtist.relationships.map((edge, edgeIndex) => normalizeRelationship(edge, edgeIndex, name))
    : [];

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
    developments,
    relationships,
    feedbackLearning: normalizeFeedbackLearning(rawArtist.feedbackLearning),
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

function bindQuestionnaireForm() {
  $("#questionnaireForm").addEventListener("submit", (event) => {
    event.preventDefault();
    renderQuestionnairePacket();
    $("#questionnaireStatus").textContent = "Generated buyer requirements packet locally.";
  });

  ["buyerSegmentInput", "marketInput", "goalInput", "mustHaveInput", "passCriteriaInput", "integrationInput"].forEach((id) => {
    document.getElementById(id).addEventListener("input", renderQuestionnairePacket);
    document.getElementById(id).addEventListener("change", renderQuestionnairePacket);
  });

  $("#copyQuestionnaireButton").addEventListener("click", async () => {
    try {
      await copyQuestionnaire();
    } catch (error) {
      $("#questionnaireStatus").textContent = `Copy failed: ${error.message}`;
    }
  });

  $("#downloadQuestionnaireButton").addEventListener("click", () => {
    try {
      downloadQuestionnaire();
    } catch (error) {
      $("#questionnaireStatus").textContent = `Download failed: ${error.message}`;
    }
  });
}

function bindDiscoveryForm() {
  $("#discoveryObjectiveInput").addEventListener("input", renderDiscoveryWorkbench);
  $("#discoverySeedsInput").addEventListener("input", renderDiscoveryWorkbench);

  $("#sampleDiscoveryButton").addEventListener("click", () => {
    $("#discoveryRowsInput").value = JSON.stringify(discoverySampleRows, null, 2);
    $("#discoverySeedsInput").value = "alt rnb\nunsigned artist\nnew music\nlocal scene\noriginal sound";
    $("#discoveryObjectiveInput").value = "Find emerging artist candidates from approved TikTok-style result rows";
    $("#discoveryStatus").textContent = "Inserted fictional sample rows. Replace with approved/manual data before private analysis.";
    state.discovery.candidates = [];
    state.discovery.packet = null;
    renderDiscoveryWorkbench();
  });

  $("#copyQueryPlanButton").addEventListener("click", async () => {
    try {
      const plan = buildDiscoveryQueryPlan();
      if (!navigator.clipboard?.writeText) {
        $("#discoveryStatus").textContent = "Copy is unavailable in this browser. Select the query plan manually.";
        return;
      }
      await navigator.clipboard.writeText(plan);
      $("#discoveryStatus").textContent = "Copied query plan. No live TikTok call was made.";
    } catch (error) {
      $("#discoveryStatus").textContent = `Copy failed: ${error.message}`;
    }
  });

  $("#copyDiscoveryPacketButton").addEventListener("click", async () => {
    try {
      if (!state.discovery.packet) throw new Error("Cluster candidates first.");
      if (!navigator.clipboard?.writeText) {
        $("#discoveryStatus").textContent = "Copy is unavailable in this browser. Select the packet manually.";
        return;
      }
      await navigator.clipboard.writeText(JSON.stringify(state.discovery.packet, null, 2));
      $("#discoveryStatus").textContent = "Copied ASI private import packet. Keep real candidates private.";
    } catch (error) {
      $("#discoveryStatus").textContent = `Copy failed: ${error.message}`;
    }
  });

  $("#discoveryForm").addEventListener("submit", (event) => {
    event.preventDefault();
    try {
      const rows = parseDiscoveryRows($("#discoveryRowsInput").value);
      if (!rows.length) throw new Error("Paste approved/manual result rows first.");
      const candidates = clusterDiscoveryRows(rows);
      state.discovery.candidates = candidates;
      state.discovery.packet = buildDiscoveryPacket(candidates);
      $("#discoveryStatus").textContent = `Clustered ${rows.length} row(s) into ${candidates.length} candidate(s). No live TikTok call was made.`;
      renderDiscoveryWorkbench();
    } catch (error) {
      $("#discoveryStatus").textContent = `Discovery failed: ${error.message}`;
    }
  });
}

function renderAll() {
  if (!state.data) return;
  $("#modeSummary").textContent = `${getMode().description} Data source: ${state.dataSourceLabel}.`;
  renderWatchlist();
  renderBrief();
  renderTimeline();
  renderEvidence();
  renderScoring();
  renderCompare();
  renderNotes();
  renderLearning();
  renderStrategy();
  renderReport();
  renderQuestionnairePacket();
  renderDiscoveryWorkbench();
  renderGates();
}

async function init() {
  const response = await fetch("./data/placeholder-artists.json", { cache: "no-store" });
  state.data = await response.json();
  state.defaultData = structuredClone(state.data);
  state.activeArtistId = state.data.artists[0].id;
  renderModeControl();
  renderTabs();
  bindWatchlistControls();
  bindNotesForm();
  bindImportForm();
  bindExportActions();
  bindQuestionnaireForm();
  bindDiscoveryForm();
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
