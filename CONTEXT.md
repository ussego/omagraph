# Omagraph

Omagraph is an analytics dashboard for the Omarchy plugin catalog: engagement stats, leaderboards, ecosystem health, and embeddable badges/charts.

## Language

**Plugin**:
An entry in the Omarchy catalog — an installable customization — identified by a stable Plugin ID, with metadata (name, author, category, license, tags) and current engagement counters.

**Catalog**:
The upstream list of all Plugins and their metadata, published by Omarchy Plugins.
_Avoid_: catalog.json (that's the transport file, not the concept)

**Snapshot**:
A point-in-time capture of one Plugin's engagement counters (views, copies, hearts) and verification/version state, recorded by a Heavy Poll.

**Heavy Poll**:
The full catalog refresh: upserts every Plugin's metadata, records a new Snapshot per Plugin, and diffs against each Plugin's prior Snapshot to produce Verification Events and Update Events. Runs on a schedule via GitHub Actions calling an admin endpoint.
_Avoid_: snapshot poll, cron job

**Light Poll**:
A cheap, frequent refresh that only detects newly-added Plugins — no Snapshot, no per-plugin diffing — keeping the live Plugin count fresh between Heavy Polls.
_Avoid_: quick poll

**Explorer Poll**:
A daily refresh (05:23 UTC) of the Omarchy explorer's similarity graph (explorer-data.json): upserts one row per community Plugin into the plugin_relations mirror — its nearest-neighbor Plugin IDs with similarity scores, its thematic cluster label, and its graph influence. Community scope only; built-in Plugins never get a row.
_Avoid_: graph poll, relations sync

**Related Plugins**:
A Plugin's nearest neighbors in the Omarchy explorer graph, ranked by description-similarity score. Stored per Plugin by the Explorer Poll and shown on the Plugin detail page.

**Family**:
The thematic cluster label the Omarchy explorer assigns a Plugin (e.g. "AI & Automation"), one of a fixed set of clusters over the community catalog.

**Verification Event**:
A recorded change in a Plugin's verification status, produced by comparing consecutive Snapshots during a Heavy Poll.

**Verification Request**:
An attempt to request verification through a non-PR marketplace issue whose title starts `[Verify]:`. Recorded once at issue creation by the Submission Sync, regardless of later validation or outcome, with its GitHub issue labels retained for tag breakdowns. This is received workload, not a Verification Event.

**Submission Event**:
A non-PR marketplace issue whose title starts `[Plugin]:` or `[Verify]:`, recorded once at `created_at` using the GitHub issue number as its idempotency key.

**Submission Sync**:
The five-minute GitHub Actions poll that imports Submission Events and advances a monotonic cursor. The first run backfills the full issue history; later runs fetch issues updated since the cursor.

**Update Event**:
A recorded change in a Plugin's upstream repository state (e.g. a new version), produced the same way as a Verification Event.

**Author**:
The maintainer of one or more Plugins, identified by their upstream (GitHub) login.

**Leaderboard**:
A ranking of Plugins or Authors by a chosen metric (views, copies, hearts, or a derived score).

**Badge**:
A single embeddable stat for one Plugin or Author (e.g. heart count), served by Omagraph as a blueprint-style SVG. A legacy JSON representation exists for bot integrations.

**Chart Series**:
A time-bucketed sequence of counts for one metric (e.g. a Plugin's hearts over time), consumed by an external chart renderer.

**Public API**:
The unauthenticated GET `/api/*` surface consumed by external renderers and embedders.
_Avoid_: API docs page, developer docs
