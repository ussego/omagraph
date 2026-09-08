import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";

const LLMS_TXT = `# Omagraph

> An independent companion dashboard for the Omarchy plugin catalog: hearts, views, copies, leaderboards, ecosystem health, categories, and embeddable badges. Snapshots refresh every 8 hours; new-plugin counts every 30 minutes.

## Omagraph

- [Overview](https://stats.ussego.com/): catalog totals and trend charts for hearts, views, copies, and new plugins.
- [Leaderboards](https://stats.ussego.com/leaderboards): top plugins by hearts, views, copies, and conversion, plus trending and author leaderboards.
- [Ecosystem Health](https://stats.ussego.com/health): verification status, install availability, submission load, and broken plugins.
- [Categories](https://stats.ussego.com/categories): plugin counts and engagement by category, with a monthly activity heatmap.
- [Badges](https://stats.ussego.com/badges): embeddable stat badges for plugins and authors.
- [API Docs](https://stats.ussego.com/api-docs): Public API reference for plugins, authors, leaderboards, badges, and charts.
- [About](https://stats.ussego.com/about): data sources, permissions, and credits for the dashboard.
`;

export const Route = createFileRoute("/llms.txt")({
	server: {
		handlers: {
			GET: () =>
				new Response(LLMS_TXT, {
					headers: { "Content-Type": "text/plain; charset=utf-8" },
				}),
		},
	},
});
