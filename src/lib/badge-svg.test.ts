import { describe, expect, it } from "bun:test";

import { badgeResponse, parseBadgeTarget } from "@/lib/badge-svg";

describe("badge SVG", () => {
	it("renders extensionless and .svg targets as escaped blueprint SVG", async () => {
		expect(parseBadgeTarget("ussego.otoru")).toEqual({ id: "ussego.otoru", format: "svg" });
		expect(parseBadgeTarget("ussego.otoru.svg")).toEqual({ id: "ussego.otoru", format: "svg" });

		const response = badgeResponse("svg", {
			schemaVersion: 1,
			label: "Views & more",
			message: "<109>",
			color: "blue",
		});
		const svg = await response.text();

		expect(response.headers.get("content-type")).toBe("image/svg+xml; charset=utf-8");
		expect(svg).toContain("<title>VIEWS &amp; MORE: &lt;109&gt;</title>");
		expect(svg).toContain('font-family="Geist Mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"');
		expect(svg).toContain('fill="#005fc6"');
		expect(svg).toContain('stroke-dasharray="2 5"');
		expect(svg).not.toContain("Views & more");
	});

	it("keeps .json targets on the legacy shields schema", async () => {
		expect(parseBadgeTarget("ussego.otoru.JSON")).toEqual({ id: "ussego.otoru", format: "json" });

		const response = badgeResponse("json", {
			schemaVersion: 1,
			label: "Views",
			message: "109",
			color: "blue",
		});

		expect(response.headers.get("content-type")).toContain("application/json");
		expect(await response.text()).toBe(
			'{"schemaVersion":1,"label":"Views","message":"109","color":"blue"}',
		);
	});
});
