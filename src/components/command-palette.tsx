/** @jsxImportSource react */

import { IconSearch } from "@tabler/icons-react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Kbd, KbdGroup } from "@/components/ui/kbd";

const CommandPaletteDialog = lazy(() => import("@/components/command-palette-dialog"));

/** Lightweight trigger; the search UI and its dependencies load on first open. */
export function CommandPalette() {
	const [mounted, setMounted] = useState(false);
	const [open, setOpen] = useState(false);
	const triggerRef = useRef<HTMLButtonElement>(null);

	useEffect(() => {
		const down = (event: KeyboardEvent) => {
			if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
				event.preventDefault();
				setMounted(true);
				setOpen((current) => !current);
			}
		};
		document.addEventListener("keydown", down);
		return () => document.removeEventListener("keydown", down);
	}, []);

	return (
		<>
			<Button
				ref={triggerRef}
				type="button"
				variant="ghost"
				size="sm"
				aria-expanded={open}
				aria-haspopup="dialog"
				aria-label="Search pages or plugins"
				onClick={() => {
					setMounted(true);
					setOpen(true);
				}}
				className="graph-frame w-8 justify-center px-0 font-normal 2xl:w-44 2xl:justify-between 2xl:px-[calc(--spacing(2.5)-1px)]"
			>
				<IconSearch />
				<span className="hidden font-mono text-xs tracking-wide text-muted-foreground uppercase 2xl:inline">
					Search
				</span>
				<KbdGroup className="hidden 2xl:flex">
					<Kbd>Ctrl</Kbd>
					<Kbd>K</Kbd>
				</KbdGroup>
			</Button>
			{mounted && (
				<Suspense fallback={null}>
					<CommandPaletteDialog open={open} onOpenChange={setOpen} finalFocus={triggerRef} />
				</Suspense>
			)}
		</>
	);
}
