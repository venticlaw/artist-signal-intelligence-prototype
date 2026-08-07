# Artist Signal Intelligence Prototype

Status: public-safe static prototype
Date: August 7, 2026

This prototype is a fictional-data A&R research dashboard for the Artist Signal Intelligence MVP. It is safe for GitHub Pages because it does not include real artist rankings, live collection, backend storage, lead capture, paid APIs, outreach, or private data.

## Public Safety

- All artist records are fictional placeholders.
- No API keys, tokens, cookies, OAuth material, paid exports, or `.env` files are used.
- The app runs as static HTML, CSS, JavaScript, and local JSON.
- Notes are stored only in the visitor's browser local storage.
- Private import runs only in the browser session from a local JSON file or pasted JSON.
- Approval-gated actions are displayed as blocked actions, not active controls.

## Local Run

Serve the repository root or this folder with a static file server and open `index.html`.

## Source Of Truth

Durable ASI planning remains under `_data/channel-work/asi/`. This prototype is a review surface, not the canonical product memory.

## Private Import

The `Private Import` tab accepts a local JSON packet shaped like the ASI intake template. Imported records are not uploaded or committed; they render only in the current browser session. Do not add real artist packets to this public repository or to GitHub Pages fixtures.
