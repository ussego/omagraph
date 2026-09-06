---
status: accepted
---
> Renamed Omachi → Omagraph on 2026-09-06: spoken/search collision with Omarchy proved worse than expected (bare `omachi` also loses to noodles, sake rice, and Ōmachi Nagano). `omapulse` was rejected — an `OmaPulse` plugin already exists in the catalog. Rationale below still applies to the new name.


# Keep the product name "omagraph" despite phonetic similarity to Omarchy

omagraph tracks the Omarchy plugin catalog, and its name deliberately echoes "Omarchy" — same "oma-" opening, chosen for being cute and on-theme. Before committing to it we checked whether that similarity could read as impersonation or draw objection from the Omarchy team: DHH has publicly stated that "the oma in Omarchy is omakase," the same root behind "Omakub" — a generic Japanese loanword, not a coined or exclusive syllable. We found no trademark policy or stated objection to third-party "oma-"-prefixed community tools, and the predecessor project (`omastats`) already used the same prefix without apparent friction.

## Consequences

Some users may briefly wonder whether omagraph is an official Omarchy property. The site's copy (meta description, footer, `/llms.txt`) should frame it explicitly as an independent companion dashboard to reduce that ambiguity — this doesn't need its own ticket, just attention wherever that copy is written during the migration.
