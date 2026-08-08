# Artist Signal Intelligence Prototype

Status: public-safe static prototype
Date: August 7, 2026

This prototype is a fictional-data A&R research dashboard for the Artist Signal Intelligence MVP. It is safe for GitHub Pages because it does not include real artist rankings, live collection, backend storage, lead capture, paid APIs, outreach, or private data.

## MVP Surface

- Buyer-mode watchlist with search, confidence filter, minimum buyer-fit filter, and sorting.
- Artist brief with scene/community context, risks, and buyer-fit stats.
- Source-separated evidence with source labels, observed dates, source URL handling, freshness, and confidence.
- Scoring model view with weighted buyer-fit rationale and strongest/weakest dimensions.
- Artist comparison table using the active buyer lens and filters.
- Browser-local A&R notes with decision states, pass/caution reasons, and human learning notes.
- Strategy recommendation and disconfirming evidence.
- Browser-local Markdown scouting report copy/download.
- Buyer requirements questionnaire with browser-local packet copy/download.
- TikTok Discovery Workbench for query planning, API adapter packet generation, approved/manual result-row clustering, and ASI private packet generation.
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
- Any TikTok or licensed-provider API credentials must live in a private server-side connector, never in GitHub Pages, repo files, browser JavaScript, or static JSON.
- Approval-gated actions are displayed as blocked actions, not active controls.

## Local Run

Serve the repository root or this folder with a static file server and open `index.html`.

## Source Of Truth

Durable ASI planning remains under `_data/channel-work/asi/`. This prototype is a review surface, not the canonical product memory.

## Private Import

The `Private Import` tab accepts a local JSON packet shaped like the ASI intake template. Imported records are not uploaded or committed; they render only in the current browser session.

Private packets must use manually reviewed public evidence, keep publication approval as `not-approved`, and include source-separated signal details with source label, observed date, confidence, and an `https://` source URL unless the source is explicitly `Unknown`. Do not add real artist packets to this public repository or to GitHub Pages fixtures.
