/**
 * Build-time color themes for the Omagraph picker.
 *
 * Reads every Omarchy built-in theme at <OMARCHY_THEMES_DIR>/<theme>/colors.toml
 * (default /usr/share/omarchy/themes) with Bun's TOML parser, then emits two
 * committed artifacts:
 *
 *   src/themes/themes.css — per-theme token overrides:
 *     - native mode (:root[data-color-theme=…] for light themes,
 *       :root[data-color-theme=…].dark for dark themes) maps the theme's own
 *       colors onto the full shadcn/graph token set;
 *     - the opposite mode (adaptation block) keeps the site's neutral tokens
 *       and swaps only the graph palette, keeping each Omarchy terminal hue
 *       while correcting colors that miss text contrast.
 *   src/themes/themes.ts — metadata (id, label, native mode, terminal colors,
 *     and background hexes) for the picker's swatches and names.
 *
 * The Omagraph default (no data-color-theme attribute) stays byte-identical to
 * src/styles.css; nothing here overrides it. The neutral ramp is reproduced
 * by interpolating each theme's background/foreground pair by the same oklch
 * lightness fraction the site's tokens use, so design tweaks in styles.css
 * propagate on regeneration.
 *
 * Run via `bun run themes:generate` on a machine with omarchy installed; the
 * output is committed so deploys (which never see /usr/share/omarchy) stay
 * hermetic.
 */
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { TOML } from "bun";

const THEMES_DIR = process.env.OMARCHY_THEMES_DIR ?? "/usr/share/omarchy/themes";
const ROOT = join(import.meta.dirname, "..");
const OUT_DIR = join(ROOT, "src", "themes");
const STYLES_CSS = join(ROOT, "src", "styles.css");

/** Omarchy color keys; anything else (hyprland gradients etc.) is skipped. */
const COLOR_KEYS = new Set([
	"accent",
	"selection",
	"muted",
	"background",
	"dark_background",
	"darker_background",
	"lighter_background",
	"foreground",
	"dark_foreground",
	"light_foreground",
	"bright_foreground",
	"red",
	"yellow",
	"orange",
	"green",
	"cyan",
	"blue",
	"magenta",
	"brown",
	"bright_red",
	"bright_yellow",
	"bright_green",
	"bright_cyan",
	"bright_blue",
	"bright_magenta",
]);

/* ---------------------------------- color --------------------------------- */

type RGB = [number, number, number]; // 0..255, gamma-encoded
type Oklab = [number, number, number]; // L ∈ [0,1], a/b ≈ [−0.4, 0.4]

function parseHex(hex: string): RGB {
	const h = hex.trim().replace(/^#/, "");
	if (!/^[0-9a-fA-F]{6}$/.test(h)) {
		throw new Error(`expected #rrggbb hex, got "${hex}"`);
	}
	return [Number.parseInt(h.slice(0, 2), 16), Number.parseInt(h.slice(2, 4), 16), Number.parseInt(h.slice(4, 6), 16)];
}

function toHex([r, g, b]: RGB): string {
	const chan = (v: number) =>
		Math.round(Math.max(0, Math.min(255, v)))
			.toString(16)
			.padStart(2, "0");
	return `#${chan(r)}${chan(g)}${chan(b)}`;
}

const srgbToLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const linearToSrgb = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);

// Björn Ottosson's oklab matrices (sRGB, D65).
const M1 = [
	[0.4122214708, 0.5363325363, 0.0514459929],
	[0.2119034982, 0.6806995451, 0.1073969566],
	[0.0883024619, 0.2817188376, 0.6299787005],
] as const;
const M2 = [
	[0.2104542553, 0.793617785, -0.0040720468],
	[1.9779984951, -2.428592205, 0.4505937099],
	[0.0259040371, 0.7827717662, -0.808675766],
] as const;
const M2_INV = [
	[1, 0.3963377924, 0.2158037573],
	[1, -0.1055613423, -0.0638541748],
	[1, -0.0894841775, -1.291485548],
] as const;
const M1_INV = [
	[4.0767416621, -3.3077115913, 0.2309699292],
	[-1.2684380046, 2.6097574011, -0.3413193965],
	[-0.0041960863, -0.7034186147, 1.707614701],
] as const;

const matMul3 = (m: readonly (readonly number[])[], v: readonly number[]): number[] =>
	m.map((row) => row[0] * v[0] + row[1] * v[1] + row[2] * v[2]);

function srgbToOklab([r, g, b]: RGB): Oklab {
	const lin = [srgbToLinear(r / 255), srgbToLinear(g / 255), srgbToLinear(b / 255)];
	const lms = matMul3(M1, lin).map((c) => Math.cbrt(c));
	return matMul3(M2, lms) as Oklab;
}

function oklabToSrgb([L, a, b]: Oklab): RGB {
	const lms = matMul3(M2_INV, [L, a, b]).map((c) => c ** 3);
	const lin = matMul3(M1_INV, lms);
	return lin.map((c) => linearToSrgb(c) * 255) as RGB;
}

function oklchToHex(L: number, C: number, H: number): string {
	const rad = (H * Math.PI) / 180;
	return toHex(oklabToSrgb([L, C * Math.cos(rad), C * Math.sin(rad)]));
}

function hexToOklch(hex: string): { L: number; C: number; H: number } {
	const [L, a, b] = srgbToOklab(parseHex(hex));
	const H = (Math.atan2(b, a) * 180) / Math.PI;
	return { L, C: Math.hypot(a, b), H: H < 0 ? H + 360 : H };
}

/** Linear oklab interpolation from `from` toward `to`, back to hex. */
function mixHex(from: string, to: string, t: number): string {
	const a = srgbToOklab(parseHex(from));
	const b = srgbToOklab(parseHex(to));
	return toHex(oklabToSrgb([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]));
}

function contrastRatio(left: string, right: string): number {
	const luminance = (hex: string) => {
		const [r, g, b] = parseHex(hex).map((channel) => srgbToLinear(channel / 255));
		return 0.2126 * r + 0.7152 * g + 0.0722 * b;
	};
	const [lighter, darker] = [luminance(left), luminance(right)].sort((a, b) => b - a);
	return (lighter + 0.05) / (darker + 0.05);
}

/** Preserve a terminal color's hue while moving its lightness only as far as WCAG AA requires. */
function readableHex(source: string, background: string, mode: "light" | "dark"): string {
	if (contrastRatio(source, background) >= 4.5) return source;
	const { L, C, H } = hexToOklch(source);
	let low = mode === "dark" ? L : 0;
	let high = mode === "dark" ? 1 : L;
	for (let step = 0; step < 16; step++) {
		const mid = (low + high) / 2;
		const passes = contrastRatio(oklchToHex(mid, C, H), background) >= 4.5;
		if (mode === "dark" ? passes : !passes) high = mid;
		else low = mid;
	}
	return oklchToHex(mode === "dark" ? high : low, C, H);
}

/* ------------------------------ styles.css ref ----------------------------- */

interface CssColor {
	L: number;
	C: number;
	H: number;
	/** Optional alpha on the color (light-mode frame tokens). */
	A: number | null;
	/** Verbatim declaration, for fallbacks that must keep hue and chroma. */
	raw: string;
}

const OKLCH_RE = /oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+%?))?\)/;

function parseCssColors(block: string): Map<string, CssColor> {
	const vars = new Map<string, CssColor>();
	for (const line of block.split("\n")) {
		const match = /^\s*--([a-z0-9-]+):\s*(oklch\([^;]+\));/.exec(line);
		if (!match) continue;
		const ok = OKLCH_RE.exec(match[2]);
		if (!ok) continue;
		let alpha = ok[4] === undefined ? null : Number.parseFloat(ok[4]);
		if (alpha !== null && alpha > 1) alpha /= 100;
		vars.set(match[1], {
			L: Number.parseFloat(ok[1]),
			C: Number.parseFloat(ok[2]),
			H: Number.parseFloat(ok[3]),
			A: alpha,
			raw: match[2],
		});
	}
	return vars;
}

function blockAfter(css: string, selector: string): string {
	const match = new RegExp(`^${selector}\\s*\\{`, "m").exec(css);
	if (!match) throw new Error(`selector ${selector} not found in styles.css`);
	const end = css.indexOf("\n}", match.index);
	return css.slice(match.index + match[0].length - 1, end);
}

/** Tokens reproduced as a fixed fraction between the theme's bg and fg. */
const RAMP_VARS = [
	"graph-frame",
	"graph-frame-soft",
	"graph-muted",
	"graph-faint",
	"contrast-14",
	"contrast-23",
	"contrast-45",
	"contrast-70",
	"muted-foreground",
	"ring",
] as const;

/**
 * Where each site token sits between its mode's background and foreground,
 * as an oklch-lightness fraction (alpha tokens are composited over the
 * background first). Apply the same fraction to a theme's own bg/fg pair to
 * reproduce the ramp with the theme's contrast.
 */
function rampStrengths(mode: Map<string, CssColor>): Map<string, number> {
	const bgL = mode.get("background")!.L;
	const fgL = mode.get("foreground")!.L;
	const out = new Map<string, number>();
	for (const name of RAMP_VARS) {
		const token = mode.get(name)!;
		const compositeL = token.A === null ? token.L : token.A * token.L + (1 - token.A) * bgL;
		out.set(name, (compositeL - bgL) / (fgL - bgL));
	}
	return out;
}

/* --------------------------------- themes --------------------------------- */

interface RawTheme {
	id: string;
	mode: "light" | "dark";
	colors: Map<string, string>;
}

const GRAPH_COLORS = [
	["graph-accent", "accent"],
	["graph-accent-2", "cyan"],
	["graph-accent-3", "magenta"],
	["graph-positive", "green"],
	["graph-warning", "yellow"],
	["graph-negative", "red"],
] as const;

function graphColors(theme: RawTheme, background: string, mode: "light" | "dark"): Map<string, string> {
	return new Map(
		GRAPH_COLORS.map(([token, key]) => {
			const source = theme.colors.get(key) ?? theme.colors.get(`bright_${key}`) ?? theme.colors.get("accent")!;
			return [token, readableHex(source, background, mode)];
		}),
	);
}

function humanizeLabel(id: string): string {
	return id
		.split("-")
		.map((word) => (word === "" ? "" : word[0].toUpperCase() + word.slice(1)))
		.join(" ");
}

/** First present key in `keys`, else a mix toward the theme's foreground. */
function pick(theme: RawTheme, keys: string[], bg: string, fg: string, fallbackT: number): string {
	for (const key of keys) {
		const value = theme.colors.get(key);
		if (value) return value;
	}
	return mixHex(bg, fg, fallbackT);
}

/** Elevated-surface tone adjacent to the theme background. */
function surface(theme: RawTheme, mode: "light" | "dark", bg: string, fg: string): string {
	// Dark themes raise surfaces toward their lightest background key; light
	// themes nudge them slightly darker than the paper, like the site's cards.
	const keys =
		mode === "dark"
			? ["lighter_background", "dark_background"]
			: ["dark_background", "lighter_background", "darker_background"];
	return pick(theme, keys, bg, fg, mode === "dark" ? 0.22 : 0.05);
}

interface SiteMode {
	tokens: Map<string, CssColor>;
	bg: string; // hex of --background
	fg: string; // hex of --foreground
}

/**
 * One theme block: either the theme's full native palette or the site
 * neutral ramp with the accent family adapted from the theme's hue.
 */
function buildBlock(theme: RawTheme, site: SiteMode, opts: { isNative: boolean }): Map<string, string> {
	const mode = opts.isNative ? theme.mode : theme.mode === "dark" ? "light" : "dark";
	const themeBg = theme.colors.get("background")!;
	const themeFg = theme.colors.get("foreground")!;
	const bg = opts.isNative ? themeBg : site.bg;
	const fg = opts.isNative ? themeFg : site.fg;
	const ramp = new Map<string, string>();
	for (const name of RAMP_VARS) {
		ramp.set(name, mixHex(bg, fg, rampStrengths(site.tokens).get(name)!));
	}

	const graph = graphColors(theme, bg, mode);

	if (!opts.isNative) {
		// Adaptation: the site's neutrals stay; only the graph palette moves.
		return graph;
	}

	// All shadcn fills (secondary/muted/accent) come from `selection`, which
	// sits near the background in every theme — the site keeps the three fills
	// equal, and text on fills uses the theme's own foreground pair. The
	// omarchy `muted` key is a dimmed *text* color, not a UI fill, so it is
	// only a fallback when `selection` is absent.
	const selection = pick(theme, ["selection", "muted"], themeBg, themeFg, mode === "dark" ? 0.25 : 0.05);
	const border = pick(theme, ["selection", "muted"], themeBg, themeFg, mode === "dark" ? 0.12 : 0.07);
	const card = surface(theme, mode, themeBg, themeFg);

	const tokens = new Map<string, string>();
	const set = (name: string, value: string) => tokens.set(name, value);

	set("background", themeBg);
	set("foreground", themeFg);
	set("card", card);
	set("card-foreground", themeFg);
	set("popover", card);
	set("popover-foreground", themeFg);
	set("primary", themeFg);
	set("primary-foreground", themeBg);
	set("secondary", selection);
	set("secondary-foreground", themeFg);
	set("muted", selection);
	set("muted-foreground", ramp.get("muted-foreground")!);
	set("accent", selection);
	set("accent-foreground", themeFg);
	// Destructive is the one chromatic fallback; themes without a red key
	// inherit the site's own per-mode destructive (which keeps its hue).
	const destructive = theme.colors.get("red") ?? site.tokens.get("destructive")!.raw;
	set("destructive", destructive);
	set("border", border);
	set("input", border);
	set("ring", ramp.get("ring")!);
	for (const [name, value] of graph) set(name, value);
	for (const name of [
		"graph-frame",
		"graph-frame-soft",
		"graph-muted",
		"graph-faint",
		"contrast-14",
		"contrast-23",
		"contrast-45",
		"contrast-70",
	]) {
		set(name, ramp.get(name)!);
	}
	set("sidebar", card);
	set("sidebar-foreground", themeFg);
	set("sidebar-primary", themeFg);
	set("sidebar-primary-foreground", themeBg);
	set("sidebar-accent", selection);
	set("sidebar-accent-foreground", themeFg);
	set("sidebar-border", border);
	set("sidebar-ring", ramp.get("ring")!);
	return tokens;
}

/* ---------------------------------- main ---------------------------------- */

const [stylesCssText, entries] = await Promise.all([
	readFile(STYLES_CSS, "utf8"),
	readdir(THEMES_DIR, { withFileTypes: true }),
]);

const site: Record<"light" | "dark", SiteMode> = {
	light: { tokens: parseCssColors(blockAfter(stylesCssText, ":root")) },
	dark: { tokens: parseCssColors(blockAfter(stylesCssText, ".dark")) },
};
for (const mode of ["light", "dark"] as const) {
	const tokens = site[mode].tokens;
	const bg = tokens.get("background")!;
	const fg = tokens.get("foreground")!;
	site[mode].bg = oklchToHex(bg.L, bg.C, bg.H);
	site[mode].fg = oklchToHex(fg.L, fg.C, fg.H);
	for (const [name] of GRAPH_COLORS) {
		const color = tokens.get(name)!;
		if (contrastRatio(oklchToHex(color.L, color.C, color.H), site[mode].bg) < 4.5) {
			throw new Error(`Omagraph ${mode} ${name} misses 4.5:1 contrast`);
		}
	}
}

const themes: RawTheme[] = [];
for (const entry of entries) {
	if (!entry.isDirectory()) continue;
	let text: string;
	try {
		text = await readFile(join(THEMES_DIR, entry.name, "colors.toml"), "utf8");
	} catch {
		continue;
	}
	const parsed = TOML.parse(text) as Record<string, unknown>;
	const colors = new Map<string, string>();
	for (const [key, value] of Object.entries(parsed)) {
		if (typeof value !== "string" || !COLOR_KEYS.has(key)) continue;
		colors.set(key, value);
	}
	themes.push({ id: entry.name, mode: parsed.mode === "light" ? "light" : "dark", colors });
}
themes.sort((a, b) => a.id.localeCompare(b.id));

const blocks = themes.map((theme) => ({
	theme,
	isLight: theme.mode === "light",
	native: buildBlock(theme, site[theme.mode], { isNative: true }),
	adaptation: buildBlock(theme, site[theme.mode === "dark" ? "light" : "dark"], { isNative: false }),
}));

for (const { theme, native, adaptation } of blocks) {
	for (const tokens of [native, adaptation]) {
		const background = tokens.get("background") ?? site[theme.mode === "dark" ? "light" : "dark"].bg;
		for (const [name] of GRAPH_COLORS) {
			const value = tokens.get(name)!;
			if (contrastRatio(value, background) < 4.5) throw new Error(`${theme.id} ${name} misses 4.5:1 contrast`);
		}
	}
}

const omagraphColor = (name: string) => {
	const color = site.light.tokens.get(name)!;
	return oklchToHex(color.L, color.C, color.H);
};

const cssParts = [
	"/* GENERATED by `bun run themes:generate` — do not edit by hand.",
	` * Sources: ${THEMES_DIR}/<theme>/colors.toml (Omarchy built-ins) and the`,
	" * neutral ramp in src/styles.css. Regenerate after either changes.",
	" *",
	" * The Omagraph default (no data-color-theme attribute) is untouched. Each",
	" * theme overrides the full token set in its native mode and swaps only",
	" * the contrast-corrected graph palette in",
	" * the opposite mode, where the site's neutrals keep their contrast.",
	" */",
	"",
];

const emitBlock = (selector: string, tokens: Map<string, string>): string =>
	[`${selector} {`, ...tokens.entries().map(([name, value]) => `\t--${name}: ${value};`), "}"].join("\n");

for (const { theme, isLight, native, adaptation } of blocks) {
	const nativeSel = isLight ? `:root[data-color-theme="${theme.id}"]` : `:root[data-color-theme="${theme.id}"].dark`;
	const adaptationSel = isLight
		? `:root[data-color-theme="${theme.id}"].dark`
		: `:root[data-color-theme="${theme.id}"]`;
	cssParts.push(
		`/* ${theme.id} — native ${theme.mode} */`,
		emitBlock(nativeSel, native),
		"",
		`/* ${theme.id} — ${isLight ? "dark" : "light"} adaptation */`,
		emitBlock(adaptationSel, adaptation),
		"",
	);
}

const tsParts = [
	"// GENERATED by `bun run themes:generate` — do not edit by hand.",
	"// Omagraph first (the default; it needs no CSS overrides), then the Omarchy",
	`// built-in themes from ${THEMES_DIR}, alphabetical by id.`,
	"",
	"export interface ColorThemeMeta {",
	'\t/** data-color-theme attribute value and the localStorage["color-theme"] key. */',
	"\tid: string;",
	"\tlabel: string;",
	"\t/** The palette's authentic mode from colors.toml. */",
	'\tmode: "light" | "dark";',
	"\t/** Native terminal colors and background, for picker swatches. */",
	"\taccent: string;",
	"\tsecondary: string;",
	"\tcategory: string;",
	"\tbackground: string;",
	"}",
	"",
	"export const COLOR_THEMES: ColorThemeMeta[] = [",
	`\t{ id: "omagraph", label: "Omagraph", mode: "dark", accent: "${omagraphColor("graph-accent")}", secondary: "${omagraphColor("graph-accent-2")}", category: "${omagraphColor("graph-accent-3")}", background: "#ffffff" },`,
	...themes.map((theme) => {
		const accent = theme.colors.get("accent")!;
		const secondary = theme.colors.get("cyan") ?? theme.colors.get("bright_cyan") ?? accent;
		const category = theme.colors.get("magenta") ?? theme.colors.get("bright_magenta") ?? accent;
		const background = theme.colors.get("background")!;
		return `\t{ id: "${theme.id}", label: "${humanizeLabel(theme.id)}", mode: "${theme.mode}", accent: "${accent}", secondary: "${secondary}", category: "${category}", background: "${background}" },`;
	}),
	"];",
	"",
];

await mkdir(OUT_DIR, { recursive: true });
await Promise.all([
	writeFile(join(OUT_DIR, "themes.css"), cssParts.join("\n")),
	writeFile(join(OUT_DIR, "themes.ts"), tsParts.join("\n")),
]);

console.log(`wrote src/themes/{themes.css,themes.ts} for ${themes.length} omarchy themes + Omagraph`);
for (const { theme } of blocks) {
	console.log(`  ${theme.id.padEnd(18)} ${theme.mode.padEnd(5)} accent ${theme.colors.get("accent")}`);
}
