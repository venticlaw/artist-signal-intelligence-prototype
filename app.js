const artists = [
  {
    id: "nova-parks",
    name: "Nova Parks",
    status: "Priority Roster",
    lane: "Alt-R&B",
    owner: "A&R / Marketing",
    manager: "Internal team",
    signal: 86,
    fit: 91,
    risk: "Medium",
    committed: 185000,
    spent: 118400,
    recouped: 42000,
    nextAction: "Approve next campaign budget after creative review",
    insight: "Strong save-rate trend and repeat creator usage. Needs campaign discipline before spend increases.",
    intelligence: ["Rising short-form usage", "Two regional market spikes", "Video budget pending"]
  },
  {
    id: "marrow-lane",
    name: "Marrow Lane",
    status: "Active Roster",
    lane: "Indie Rock",
    owner: "Product / Touring",
    manager: "External manager",
    signal: 72,
    fit: 78,
    risk: "Low",
    committed: 92000,
    spent: 60500,
    recouped: 28000,
    nextAction: "Confirm release asset delivery and tour support needs",
    insight: "Healthy live proof and steady fanbase conversion. Operational follow-through is the main constraint.",
    intelligence: ["Tour routing signal", "Release assets due", "Press pickup steady"]
  },
  {
    id: "kairo-thread",
    name: "Kairo Thread",
    status: "Negotiating",
    lane: "Rap / Underground",
    owner: "A&R",
    manager: "Attorney contact",
    signal: 81,
    fit: 87,
    risk: "High",
    committed: 0,
    spent: 8500,
    recouped: 0,
    nextAction: "Resolve deal structure questions before any additional spend",
    insight: "Fast audience growth but incomplete rights and team context. Keep spend capped until diligence clears.",
    intelligence: ["High comment velocity", "Rights questions open", "Scene network expanding"]
  },
  {
    id: "sol-ren",
    name: "Sol Ren",
    status: "Watching",
    lane: "Bedroom Pop",
    owner: "A&R Research",
    manager: "Unknown",
    signal: 68,
    fit: 74,
    risk: "Medium",
    committed: 0,
    spent: 1200,
    recouped: 0,
    nextAction: "Collect one more week of source-approved signal rows",
    insight: "Interesting early community activity. Not enough reliability for a buying recommendation yet.",
    intelligence: ["Niche community traction", "Low catalog depth", "Needs source confirmation"]
  },
  {
    id: "atlas-vow",
    name: "Atlas Vow",
    status: "Prospect",
    lane: "Rap / Pop",
    owner: "Brand Partnerships",
    manager: "Self-managed",
    signal: 63,
    fit: 70,
    risk: "Low",
    committed: 0,
    spent: 0,
    recouped: 0,
    nextAction: "Add to partnership watchlist and monitor creator overlap",
    insight: "Brand-safe positioning and clean visual identity. Music-side conviction still developing.",
    intelligence: ["Brand fit emerging", "Creator overlap", "No spend committed"]
  }
];

const storedNotes = [];

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0
});

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function formatMoney(value) {
  return money.format(value);
}

function exposureFor(artist) {
  return Math.max(artist.spent - artist.recouped, 0);
}

function renderMetrics() {
  const committed = artists.reduce((sum, artist) => sum + artist.committed, 0);
  const exposure = artists.reduce((sum, artist) => sum + exposureFor(artist), 0);
  const reviews = artists.filter((artist) => ["High", "Medium"].includes(artist.risk)).length;

  $("#metricArtists").textContent = artists.length;
  $("#metricCommitted").textContent = formatMoney(committed);
  $("#metricRisk").textContent = formatMoney(exposure);
  $("#metricReviews").textContent = reviews;
}

function renderOverview() {
  const focus = artists[0];
  $("#focusArtist").innerHTML = `
    <span class="panel-kicker">Focus artist</span>
    <h3>${focus.name}</h3>
    <p>${focus.insight}</p>
    <div class="focus-stats">
      <span><strong>${focus.signal}</strong> Signal</span>
      <span><strong>${focus.fit}</strong> Buyer fit</span>
      <span><strong>${formatMoney(exposureFor(focus))}</strong> Exposure</span>
    </div>
    <button class="secondary-button" type="button" data-select-artist="${focus.id}">Open artist row</button>
  `;

  $("#priorityQueue").innerHTML = artists
    .slice()
    .sort((a, b) => b.fit - a.fit)
    .slice(0, 4)
    .map((artist) => `
      <button class="queue-item" type="button" data-select-artist="${artist.id}">
        <span>
          <strong>${artist.name}</strong>
          <small>${artist.status} / ${artist.lane}</small>
        </span>
        <em>${artist.nextAction}</em>
      </button>
    `)
    .join("");

  $("#exposureStack").innerHTML = artists
    .filter((artist) => artist.spent > 0)
    .sort((a, b) => exposureFor(b) - exposureFor(a))
    .map((artist) => `
      <div class="money-row">
        <span>${artist.name}</span>
        <strong>${formatMoney(exposureFor(artist))}</strong>
      </div>
    `)
    .join("");
}

function renderArtists() {
  const search = $("#artistSearch").value.trim().toLowerCase();
  const status = $("#statusFilter").value;
  const filtered = artists.filter((artist) => {
    const haystack = [artist.name, artist.status, artist.lane, artist.owner, artist.manager].join(" ").toLowerCase();
    return (status === "all" || artist.status === status) && (!search || haystack.includes(search));
  });

  $("#artistRows").innerHTML = filtered
    .map((artist) => `
      <tr data-artist-id="${artist.id}">
        <td>
          <strong>${artist.name}</strong>
          <small>${artist.manager}</small>
        </td>
        <td><span class="status-tag">${artist.status}</span></td>
        <td>${artist.lane}</td>
        <td>${artist.owner}</td>
        <td>${formatMoney(artist.spent)} spent</td>
        <td>${artist.nextAction}</td>
      </tr>
    `)
    .join("");
}

function renderInvestments() {
  const totalCommitted = artists.reduce((sum, artist) => sum + artist.committed, 0);
  const totalSpent = artists.reduce((sum, artist) => sum + artist.spent, 0);
  const totalRecouped = artists.reduce((sum, artist) => sum + artist.recouped, 0);
  const max = Math.max(totalCommitted, 1);
  const rows = [
    ["Committed", totalCommitted],
    ["Spent", totalSpent],
    ["Recouped", totalRecouped],
    ["Open exposure", totalSpent - totalRecouped]
  ];

  $("#portfolioBars").innerHTML = rows
    .map(([label, value]) => `
      <div class="bar-row">
        <div>
          <span>${label}</span>
          <strong>${formatMoney(value)}</strong>
        </div>
        <i style="--bar-width: ${Math.min((value / max) * 100, 100)}%"></i>
      </div>
    `)
    .join("");

  $("#investmentList").innerHTML = artists
    .map((artist) => `
      <article class="investment-item">
        <div>
          <strong>${artist.name}</strong>
          <span>${artist.status}</span>
        </div>
        <dl>
          <div><dt>Committed</dt><dd>${formatMoney(artist.committed)}</dd></div>
          <div><dt>Spent</dt><dd>${formatMoney(artist.spent)}</dd></div>
          <div><dt>Recouped</dt><dd>${formatMoney(artist.recouped)}</dd></div>
        </dl>
      </article>
    `)
    .join("");
}

function renderIntelligence() {
  $("#intelGrid").innerHTML = artists
    .map((artist) => `
      <article class="panel intel-card">
        <div class="intel-head">
          <span class="status-tag">${artist.status}</span>
          <strong>${artist.signal}</strong>
        </div>
        <h3>${artist.name}</h3>
        <p>${artist.insight}</p>
        <ul>
          ${artist.intelligence.map((item) => `<li>${item}</li>`).join("")}
        </ul>
      </article>
    `)
    .join("");
}

function renderNotes() {
  $("#noteArtist").innerHTML = artists.map((artist) => `<option value="${artist.id}">${artist.name}</option>`).join("");

  const defaultNotes = [
    { artist: "Nova Parks", decision: "Hold spend", note: "Wait for creative review before expanding paid media." },
    { artist: "Kairo Thread", decision: "Needs more research", note: "Rights and team diligence must clear before a deal recommendation." },
    { artist: "Sol Ren", decision: "Watch", note: "Promising community signal but needs another week of source-approved rows." }
  ];
  const notes = [...storedNotes, ...defaultNotes];

  $("#noteList").innerHTML = notes
    .map((entry) => `
      <article class="note-item">
        <strong>${entry.artist}</strong>
        <span>${entry.decision}</span>
        <p>${entry.note}</p>
      </article>
    `)
    .join("");
}

function switchView(viewId) {
  $$(".nav-item").forEach((button) => button.classList.toggle("is-active", button.dataset.view === viewId));
  $$(".view-panel").forEach((panel) => panel.classList.toggle("is-active", panel.id === viewId));
}

function showArtistInTable(artistId) {
  switchView("artists");
  $("#artistSearch").value = artists.find((artist) => artist.id === artistId)?.name || "";
  $("#statusFilter").value = "all";
  renderArtists();
}

function bindEvents() {
  $$(".nav-item").forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.view));
  });

  $("#artistSearch").addEventListener("input", renderArtists);
  $("#statusFilter").addEventListener("change", renderArtists);

  document.addEventListener("click", (event) => {
    const selectButton = event.target.closest("[data-select-artist]");
    if (selectButton) {
      showArtistInTable(selectButton.dataset.selectArtist);
    }
  });

  $("#nextActionButton").addEventListener("click", () => {
    const riskiest = artists.slice().sort((a, b) => exposureFor(b) - exposureFor(a))[0];
    showArtistInTable(riskiest.id);
  });

  $("#noteForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const artist = artists.find((item) => item.id === $("#noteArtist").value);
    const note = $("#noteText").value.trim();
    if (!artist || !note) return;

    storedNotes.unshift({
      artist: artist.name,
      decision: $("#noteDecision").value,
      note
    });
    $("#noteText").value = "";
    renderNotes();
  });
}

function init() {
  renderMetrics();
  renderOverview();
  renderArtists();
  renderInvestments();
  renderIntelligence();
  renderNotes();
  bindEvents();
}

init();
