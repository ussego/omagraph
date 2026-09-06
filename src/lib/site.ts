/**
 * Site-wide metadata. The title is intentionally short: browser tabs and
 * tab previews truncate from the right, and "Analytics" after `Omachi · `
 * used to be cut mid-word ("Omachi · Anal…"). The full tagline lives in the
 * description and og:image, which don't truncate.
 */
export const SITE_TITLE = "Omachi · Omarchy plugin stats";
export const SITE_DESC =
	"An independent companion dashboard for the Omarchy plugin catalog: hearts, views, copies, leaderboards, ecosystem health, categories, and embeddable badges.";
export const SITE_URL = "https://stats.ussego.com";

export function pageHead(title: string, description: string, path: string, noindex = false) {
	const url = new URL(path, SITE_URL).href;
	return {
		meta: [
			{ title },
			{ name: "description", content: description },
			{ property: "og:title", content: title },
			{ property: "og:description", content: description },
			{ property: "og:url", content: url },
			{ name: "twitter:title", content: title },
			{ name: "twitter:description", content: description },
			...(noindex ? [{ name: "robots", content: "noindex, nofollow" }] : []),
		],
		links: [{ rel: "canonical", href: url }],
	};
}

export function sitemapXml(rows: { id: string; author: string | null; currentSnapshotAt: string | null }[]) {
	const paths = ["/", "/about", "/leaderboards", "/health", "/categories", "/charts", "/badges", "/api-docs"];
	for (const row of rows) paths.push(`/plugins/${encodeURIComponent(row.id)}`);
	const authors = rows
		.filter((row) => row.currentSnapshotAt)
		.map((row) => row.author)
		.filter((author): author is string => Boolean(author));
	for (const author of new Set(authors)) {
		paths.push(`/authors/${encodeURIComponent(author)}`);
	}
	return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths
		.map((path) => `  <url><loc>${new URL(path, SITE_URL).href}</loc></url>`)
		.join("\n")}\n</urlset>\n`;
}
