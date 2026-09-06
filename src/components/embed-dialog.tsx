/** @jsxImportSource react */

import { Dialog } from "@base-ui/react/dialog";
import { GraphCorners } from "@/components/graph-frame/graph-frame";
import { CopyButton, Snippet } from "@/components/snippet";

/** Badge stats available for README embeds. */
export const EMBED_STATS = ["hearts", "views", "copies"] as const;

/** "Add to README" badge embed dialog, shared by plugin and author pages. */
export function EmbedDialog({
	id,
	snippets,
	disabled,
	disabledReason,
}: {
	/** Plugin id or bare author name, matching the badge URL segment. */
	id: string;
	snippets: ReadonlyArray<{ label: string; text: string }>;
	disabled?: boolean;
	disabledReason?: string;
}) {
	return (
		<Dialog.Root>
			<Dialog.Trigger
				disabled={disabled}
				title={disabled ? disabledReason : undefined}
				className="group graph-frame w-full px-2.5 py-2 text-left transition-colors hover:bg-graph-accent/5 focus-visible:bg-graph-accent/5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
			>
				<span className="block font-mono text-[10px] tracking-wide text-graph-muted uppercase">
					share your stats
				</span>
				<span className="mt-0.5 block font-mono text-graph-accent text-xs tracking-wide uppercase transition-colors group-hover:text-foreground">
					add to README
				</span>
			</Dialog.Trigger>
			<Dialog.Portal>
				<Dialog.Backdrop className="fixed inset-0 z-50 bg-black/32 backdrop-blur-sm transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0" />
				<Dialog.Viewport className="fixed inset-0 z-50 flex min-w-0 items-center justify-center overflow-hidden p-4 sm:p-8">
					<Dialog.Popup className="graph-frame relative flex max-h-[calc(100dvh-2rem)] min-w-0 w-full max-w-3xl flex-col overflow-hidden bg-background text-foreground outline-none transition-[scale,opacity] duration-200 data-ending-style:scale-98 data-ending-style:opacity-0 data-starting-style:scale-98 data-starting-style:opacity-0 sm:max-h-[calc(100dvh-4rem)]">
						<GraphCorners />
						<div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-5 sm:p-8">
							<div className="flex items-start justify-between gap-4">
								<div>
									<Dialog.Title className="font-mono text-foreground text-sm uppercase">
										[ embed badges ]
									</Dialog.Title>
									<Dialog.Description className="mt-1 text-muted-foreground text-sm">
										Copy live SVG badges into your README.
									</Dialog.Description>
								</div>
								<Dialog.Close className="font-mono text-muted-foreground text-xs uppercase transition-colors hover:text-foreground">
									close
								</Dialog.Close>
							</div>
							<div className="graph-frame relative mt-4 flex flex-wrap items-center gap-2 bg-muted/20 p-3">
								<GraphCorners />
								<span className="mr-1 font-mono text-graph-muted text-xs uppercase">preview</span>
								{snippets.map(({ label }) => (
									<img
										key={label}
										src={`https://stats.ussego.com/api/badges/${label}/${id}.svg`}
										alt={`${label} badge example`}
										className="h-5 max-w-full"
										loading="lazy"
									/>
								))}
							</div>
							<div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
								{snippets.map(({ label, text }) => (
									<div key={label} className="min-w-0">
										<div className="mb-1 flex items-center justify-between gap-2">
											<p className="font-mono text-graph-muted text-xs uppercase">{label}</p>
											<CopyButton
												text={text}
												label="Copy snippet"
												showLabel
												size="xs"
												className="h-5 px-1.5 text-[10px] text-graph-muted hover:bg-transparent hover:text-graph-accent"
											/>
										</div>
										<Snippet>{text}</Snippet>
									</div>
								))}
							</div>
							<a
								href="https://github.com/ussego/omagraph"
								target="_blank"
								rel="noreferrer"
								className="mt-5 inline-block font-mono text-graph-accent text-xs uppercase hover:underline"
							>
								★ star if you embed ↗
							</a>
						</div>
					</Dialog.Popup>
				</Dialog.Viewport>
			</Dialog.Portal>
		</Dialog.Root>
	);
}
