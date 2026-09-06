import { useEffect, useState } from "react";

import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { COLOR_THEMES } from "@/themes/themes";
import themesCssUrl from "@/themes/themes.css?url";
import { cn } from "@/lib/utils";

/**
 * Theme control: the light/dark/auto mode (formerly ThemeToggle) plus the
 * color-theme picker — the Omagraph default and the Omarchy built-in palettes
 * from src/themes.
 *
 * Mode lives in localStorage["theme"] and toggles .light/.dark on <html>.
 * Palette lives in localStorage["color-theme"] and flips data-color-theme.
 * The themes stylesheet is NOT in the critical path: __root.tsx's pre-paint
 * bootstrap injects it only when a palette is already stored, and this
 * component injects it lazily on the first pick (the attribute flips after
 * load, so the palette never half-applies).
 */

type ThemeMode = "light" | "dark" | "auto";

const OMAGRAPH_ID = "omagraph";
const MODE_STORAGE_KEY = "theme";
const PALETTE_STORAGE_KEY = "color-theme";
const MODES: { value: ThemeMode; label: string }[] = [
	{ value: "light", label: "Light" },
	{ value: "dark", label: "Dark" },
	{ value: "auto", label: "Auto" },
];

function getInitialMode(): ThemeMode {
	if (typeof window === "undefined") {
		return "auto";
	}
	const stored = window.localStorage.getItem(MODE_STORAGE_KEY);
	return stored === "light" || stored === "dark" || stored === "auto" ? stored : "auto";
}

/** Mirrors __root.tsx's pre-paint bootstrap. */
function applyThemeMode(mode: ThemeMode) {
	const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
	const resolved = mode === "auto" ? (prefersDark ? "dark" : "light") : mode;

	document.documentElement.classList.remove("light", "dark");
	document.documentElement.classList.add(resolved);

	if (mode === "auto") {
		document.documentElement.removeAttribute("data-theme");
	} else {
		document.documentElement.setAttribute("data-theme", mode);
	}

	document.documentElement.style.colorScheme = resolved;
}

function getStoredPaletteId(): string {
	const stored = window.localStorage.getItem(PALETTE_STORAGE_KEY);
	return COLOR_THEMES.some((t) => t.id === stored) && stored !== OMAGRAPH_ID ? (stored as string) : OMAGRAPH_ID;
}

function applyPalette(id: string) {
	const root = document.documentElement;
	if (id === OMAGRAPH_ID) {
		root.removeAttribute("data-color-theme");
		window.localStorage.removeItem(PALETTE_STORAGE_KEY);
	} else {
		root.setAttribute("data-color-theme", id);
		window.localStorage.setItem(PALETTE_STORAGE_KEY, id);
	}
}

function ThemeSwatch({
	accent,
	secondary,
	category,
	background,
}: {
	accent: string;
	secondary: string;
	category: string;
	background: string;
}) {
	return (
		<span
			aria-hidden="true"
			className="size-3.5 shrink-0 border border-graph-frame"
			style={{
				background: `conic-gradient(${accent} 0 25%, ${secondary} 0 50%, ${background} 0 75%, ${category} 0)`,
			}}
		/>
	);
}

/** Injects the themes stylesheet once; resolves when it is available. */
function loadThemesCss(): Promise<void> {
	return new Promise((resolve) => {
		if (document.querySelector(`link[href="${themesCssUrl}"]`)) {
			resolve();
			return;
		}
		const link = document.createElement("link");
		link.rel = "stylesheet";
		link.href = themesCssUrl;
		link.onload = () => resolve();
		link.onerror = () => resolve();
		document.head.appendChild(link);
	});
}

export function ColorThemePicker() {
	const [open, setOpen] = useState(false);
	const [mode, setMode] = useState<ThemeMode>("auto");
	const [palette, setPalette] = useState(OMAGRAPH_ID);

	useEffect(() => {
		const initialMode = getInitialMode();
		setMode(initialMode);
		applyThemeMode(initialMode);
		setPalette(getStoredPaletteId());
	}, []);

	useEffect(() => {
		if (mode !== "auto") {
			return;
		}
		const media = window.matchMedia("(prefers-color-scheme: dark)");
		const onChange = () => applyThemeMode("auto");
		media.addEventListener("change", onChange);
		return () => {
			media.removeEventListener("change", onChange);
		};
	}, [mode]);

	function selectMode(next: ThemeMode) {
		setMode(next);
		applyThemeMode(next);
		window.localStorage.setItem(MODE_STORAGE_KEY, next);
	}

	async function selectPalette(id: string) {
		// The first pick on this device loads the themes stylesheet; the
		// attribute flips only once it is in, so the palette never flashes
		// in half-applied.
		if (id !== OMAGRAPH_ID) {
			await loadThemesCss();
		}
		applyPalette(id);
		setPalette(id);
		setOpen(false);
	}

	const active = COLOR_THEMES.find((t) => t.id === palette) ?? COLOR_THEMES[0];
	const triggerLabel = `Theme: ${active.label}, ${mode === "auto" ? "auto mode" : `${mode} mode`}`;

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger
				aria-label={triggerLabel}
				title={triggerLabel}
				className="graph-frame h-7 shrink-0 select-none border border-transparent inline-flex items-center justify-center gap-2 px-3 font-mono text-xs tracking-widest text-foreground uppercase transition-colors hover:text-muted-foreground"
			>
				<span
					aria-hidden="true"
					className="size-2"
					style={{
						background:
							"linear-gradient(135deg, var(--graph-accent) 0 34%, var(--graph-accent-2) 34% 67%, var(--graph-accent-3) 67%)",
					}}
				/>
				<span className="hidden max-w-32 truncate sm:inline">{active.label}</span>
			</PopoverTrigger>
			<PopoverContent align="end" className="w-80">
				<PopoverTitle className="sr-only">Theme — mode and palette</PopoverTitle>
				<p className="px-1 pb-2 font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
					[ Theme ]
				</p>
				<div className="flex gap-1">
					{MODES.map(({ value, label }) => {
						const isActive = mode === value;
						return (
							<button
								key={value}
								type="button"
								onClick={() => selectMode(value)}
								aria-pressed={isActive}
								title={value === "auto" ? "Follow the system setting" : `Force ${value} mode`}
								className={cn(
									"graph-frame flex h-6 flex-1 items-center justify-center font-mono text-[10px] tracking-widest uppercase transition-colors hover:text-foreground",
									isActive ? "text-graph-accent" : "text-muted-foreground",
								)}
							>
								{label}
							</button>
						);
					})}
				</div>
				<div aria-hidden="true" className="graph-rule-soft my-3" />
				<div className="grid grid-cols-2 gap-1">
					{COLOR_THEMES.map((theme) => {
						const isActive = theme.id === palette;
						return (
							<button
								key={theme.id}
								type="button"
								onClick={() => selectPalette(theme.id)}
								aria-pressed={isActive}
								title={`${theme.label} (${theme.mode} palette)`}
								className={cn(
									"flex h-7 min-w-0 items-center gap-2 px-1.5 font-mono text-[10px] tracking-wide text-left uppercase transition-colors hover:bg-secondary",
									isActive ? "text-graph-accent" : "text-foreground",
								)}
							>
								<ThemeSwatch
									accent={theme.accent}
									secondary={theme.secondary}
									category={theme.category}
									background={theme.background}
								/>
								<span className="min-w-0 flex-1 truncate">{theme.label}</span>
							</button>
						);
					})}
				</div>
			</PopoverContent>
		</Popover>
	);
}
