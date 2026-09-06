import type { BadgeResponse } from "@/lib/api-types";

export type BadgeFormat = "svg" | "json";

export function parseBadgeTarget(rawId: string): { id: string; format: BadgeFormat } {
	const id = rawId.toLowerCase();
	if (id.endsWith(".json")) return { id: rawId.slice(0, -5), format: "json" };
	if (id.endsWith(".svg")) return { id: rawId.slice(0, -4), format: "svg" };
	return { id: rawId, format: "svg" };
}

const escapeXml = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const textWidth = (value: string) => Math.max(42, value.length * 7 + 14);
// Standalone SVGs cannot inherit --graph-accent; this is its sRGB equivalent.
const GRAPH_ACCENT = "#005fc6";

// shields.io names resolved for SVG fills; views stays on the brand blue.
const SHIELD_HEX: Record<string, string> = {
	red: "#e05d44",
	blue: GRAPH_ACCENT,
	green: "#44cc11",
	purple: "#6f42c1",
	yellow: "#dfb317",
	orange: "#fe7d37",
};

/** Resolve a `?color=` value (shields name or #hex) to an SVG fill. */
export function badgeColor(color: string): string {
	if (/^#[0-9a-fA-F]{3}$/.test(color) || /^#[0-9a-fA-F]{6}$/.test(color)) return color;
	return SHIELD_HEX[color.toLowerCase()] ?? GRAPH_ACCENT;
}

export function badgeSvg(label: string, message: string, color: string = GRAPH_ACCENT): string {
	const left = label.toUpperCase();
	const right = message.toUpperCase();
	const leftWidth = textWidth(left);
	const rightWidth = textWidth(right);
	const width = leftWidth + rightWidth;
	const font = "Geist Mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";

	return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="20" viewBox="0 0 ${width} 20" role="img">
<title>${escapeXml(`${left}: ${right}`)}</title>
<rect width="${width}" height="20" fill="#18181b"/>
<rect x="${leftWidth}" width="${rightWidth}" height="20" fill="${badgeColor(color)}"/>
<rect x="0.5" y="0.5" width="${width - 1}" height="19" fill="none" stroke="#fff" stroke-opacity="0.45" stroke-dasharray="2 5"/>
<g fill="#fff" font-family="${font}" font-size="10" font-weight="600" text-anchor="middle">
<text x="${leftWidth / 2}" y="14">${escapeXml(left)}</text>
<text x="${leftWidth + rightWidth / 2}" y="14">${escapeXml(right)}</text>
</g>
</svg>`;
}

export function badgeResponse(format: BadgeFormat, badge: BadgeResponse): Response {
	return format === "json"
		? Response.json(badge)
		: new Response(badgeSvg(badge.label, badge.message, badge.color), {
				headers: { "Content-Type": "image/svg+xml; charset=utf-8" },
			});
}
