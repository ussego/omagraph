import { describe, expect, test } from "bun:test";

import { pageHead, sitemapXml } from "@/lib/site";

test("pageHead emits matching canonical and social URLs", () => {
	const head = pageHead("Title", "Description", "/leaderboards");

	expect(head.links).toEqual([{ rel: "canonical", href: "https://stats.ussego.com/leaderboards" }]);
	expect(head.meta).toContainEqual({ property: "og:url", content: "https://stats.ussego.com/leaderboards" });
});

test("pageHead can prevent indexing", () => {
	const head = pageHead("Admin", "Admin tools", "/admin", true);

	expect(head.meta).toContainEqual({ name: "robots", content: "noindex, nofollow" });
});

test("pageHead accepts a page-specific social image", () => {
	const head = pageHead("Plugin", "Description", "/plugins/example", false, "/og/plugins/example.png");

	expect(head.meta).toContainEqual({
		property: "og:image",
		content: "https://stats.ussego.com/og/plugins/example.png",
	});
	expect(head.meta).toContainEqual({
		name: "twitter:image",
		content: "https://stats.ussego.com/og/plugins/example.png",
	});
});

describe("sitemapXml", () => {
	test("lists plugins and only live authors once", () => {
		const xml = sitemapXml([
			{ id: "one & only", author: "alice", currentSnapshotAt: "2026-09-03" },
			{ id: "two", author: "alice", currentSnapshotAt: "2026-09-03" },
			{ id: "fresh", author: "bob", currentSnapshotAt: null },
		]);

		expect(xml).toContain("https://stats.ussego.com/plugins/one%20%26%20only");
		expect(xml.match(/\/authors\/alice/g)).toHaveLength(1);
		expect(xml).not.toContain("/authors/bob");
	});
});
