/** @jsxImportSource react */

import { IconExternalLink } from "@tabler/icons-react";
import { createFileRoute } from "@tanstack/react-router";
import { GraphRule } from "@/components/graph-frame/graph-rule";
import { GraphStat } from "@/components/graph-stat";
import { buttonVariants } from "@/components/ui/button";
import { pageHead } from "@/lib/site";

export const Route = createFileRoute("/about")({
	head: () =>
		pageHead(
			"About Omagraph · Omarchy Plugin Analytics",
			"Learn how Omagraph tracks the Omarchy plugin catalog, where its data comes from, how often snapshots refresh, and how to interpret each metric.",
			"/about",
		),
	component: AboutPage,
});

const textLink = "underline decoration-dotted underline-offset-4 transition-colors hover:text-foreground";

function AboutPage() {
	return (
		<div className="flex flex-col gap-8">
			<h1 className="font-heading text-2xl">About Omagraph</h1>

			<div className="flex flex-col gap-6">
				<div className="flex flex-col gap-3">
					<p className="max-w-3xl text-balance font-heading text-2xl leading-snug sm:text-3xl">
						A clearer view of the Omarchy plugin ecosystem.
					</p>
					<p className="max-w-2xl text-pretty text-muted-foreground">
						Omagraph turns catalog activity into history, comparisons, and reusable stats. You can follow
						releases and verification changes, compare marketplace activity, explore related plugins, and
						embed charts or badges in your own project pages.
					</p>
				</div>

				<section aria-labelledby="catalog-relationship" className="flex max-w-2xl flex-col gap-3">
					<h2 id="catalog-relationship" className="font-heading text-xl">
						Built to support the official catalog
					</h2>
					<p className="text-pretty text-muted-foreground">
						The official Omarchy Plugin Catalog remains the home for publishing, reviewing, discovering, and
						installing plugins. Omagraph reads its public feeds, keeps a short history, and links each plugin
						page back to its official listing.
					</p>
					<p className="text-pretty text-muted-foreground">
						Omagraph will remain an independent analytics companion. It does not accept submissions, set
						verification status, or provide an alternative installation path.
					</p>
					<div className="flex flex-wrap gap-2 pt-1">
						<a
							href="https://plugins.omarchy.org"
							target="_blank"
							rel="noreferrer"
							className={buttonVariants()}
						>
							<span>Official catalog</span>
							<IconExternalLink data-icon="inline-end" />
						</a>
						<a
							href="https://github.com/ussego/omagraph"
							target="_blank"
							rel="noreferrer"
							className={buttonVariants({ variant: "outline" })}
						>
							<span>Source</span>
							<IconExternalLink data-icon="inline-end" />
						</a>
					</div>
				</section>
			</div>

			<GraphRule />

			<section aria-labelledby="what-omagraph-adds" className="flex flex-col gap-5">
				<div className="flex flex-col gap-2">
					<h2 id="what-omagraph-adds" className="font-heading text-xl">
						What Omagraph adds
					</h2>
					<p className="max-w-2xl text-muted-foreground">
						The catalog shows the current ecosystem. Omagraph keeps enough context to show how it changes.
					</p>
				</div>
				<dl className="grid gap-x-10 gap-y-6 sm:grid-cols-2">
					<div className="flex flex-col gap-1">
						<dt className="font-mono text-xs tracking-wide text-graph-accent uppercase">History</dt>
						<dd className="text-pretty text-muted-foreground">
							Eight-hour snapshots preserve 90 days of marketplace counts, versions, and verification
							changes.
						</dd>
					</div>
					<div className="flex flex-col gap-1">
						<dt className="font-mono text-xs tracking-wide text-graph-accent uppercase">Comparisons</dt>
						<dd className="text-pretty text-muted-foreground">
							Leaderboards, author totals, categories, and activity trends place each plugin in ecosystem
							context.
						</dd>
					</div>
					<div className="flex flex-col gap-1">
						<dt className="font-mono text-xs tracking-wide text-graph-accent uppercase">Exploration</dt>
						<dd className="text-pretty text-muted-foreground">
							Health views summarize verification and install status plus received submission load; the
							marketplace explorer graph connects related community plugins.
						</dd>
					</div>
					<div className="flex flex-col gap-1">
						<dt className="font-mono text-xs tracking-wide text-graph-accent uppercase">Reusable data</dt>
						<dd className="text-pretty text-muted-foreground">
							Public JSON endpoints power the dashboard and let maintainers add live charts and badges to
							their own docs.
						</dd>
					</div>
				</dl>
			</section>

			<GraphRule />

			<section aria-labelledby="data-sources" className="flex flex-col gap-4">
				<h2 id="data-sources" className="font-heading text-xl">
					Data sources and timing
				</h2>
				<dl className="flex max-w-3xl flex-col">
					<div className="flex flex-col gap-1.5 py-4 first:pt-0 last:pb-0 sm:flex-row sm:gap-8">
						<dt className="shrink-0 font-mono text-xs tracking-wide text-graph-muted uppercase sm:w-36 sm:pt-0.5">
							Catalog
						</dt>
						<dd className="text-pretty text-sm text-muted-foreground">
							The catalog and explorer graph come from the{" "}
							<a href="https://plugins.omarchy.org" target="_blank" rel="noreferrer" className={textLink}>
								Omarchy Plugin Catalog
							</a>
							, whose source is MIT licensed.
						</dd>
					</div>
					<div aria-hidden="true" className="graph-rule" />
					<div className="flex flex-col gap-1.5 py-4 first:pt-0 last:pb-0 sm:flex-row sm:gap-8">
						<dt className="shrink-0 font-mono text-xs tracking-wide text-graph-muted uppercase sm:w-36 sm:pt-0.5">
							Marketplace issues
						</dt>
						<dd className="text-pretty text-sm text-muted-foreground">
							You submit plugins and verification requests as marketplace issues. A Trigger.dev poll
							imports new [Plugin]: and [Verify]: issues every five minutes; Omagraph counts each received
							attempt, not its outcome.
						</dd>
					</div>
					<div aria-hidden="true" className="graph-rule" />
					<div className="flex flex-col gap-1.5 py-4 first:pt-0 last:pb-0 sm:flex-row sm:gap-8">
						<dt className="shrink-0 font-mono text-xs tracking-wide text-graph-muted uppercase sm:w-36 sm:pt-0.5">
							Marketplace stats
						</dt>
						<dd className="text-pretty text-sm text-muted-foreground">
							The marketplace stats API supplies views, copies, and hearts with its maintainer&apos;s
							permission.
						</dd>
					</div>
				</dl>
			</section>

			<section aria-labelledby="reading-the-data" className="flex flex-col gap-4">
				<h2 id="reading-the-data" className="font-heading text-xl">
					Reading the data
				</h2>
				<dl className="flex max-w-3xl flex-col">
					<div className="flex flex-col gap-1.5 py-4 first:pt-0 last:pb-0 sm:flex-row sm:gap-8">
						<dt className="shrink-0 font-mono text-xs tracking-wide text-graph-muted uppercase sm:w-36 sm:pt-0.5">
							Counts
						</dt>
						<dd className="text-pretty text-sm text-muted-foreground">
							Marketplace counts measure activity in the catalog, not plugin quality or an Omagraph
							endorsement.
						</dd>
					</div>
					<div aria-hidden="true" className="graph-rule" />
					<div className="flex flex-col gap-1.5 py-4 first:pt-0 last:pb-0 sm:flex-row sm:gap-8">
						<dt className="shrink-0 font-mono text-xs tracking-wide text-graph-muted uppercase sm:w-36 sm:pt-0.5">
							Verification
						</dt>
						<dd className="text-pretty text-sm text-muted-foreground">
							Verification and install status come from the catalog. Omagraph reports them without making
							its own review decisions.
						</dd>
					</div>
					<div aria-hidden="true" className="graph-rule" />
					<div className="flex flex-col gap-1.5 py-4 first:pt-0 last:pb-0 sm:flex-row sm:gap-8">
						<dt className="shrink-0 font-mono text-xs tracking-wide text-graph-muted uppercase sm:w-36 sm:pt-0.5">
							Polling delay
						</dt>
						<dd className="text-pretty text-sm text-muted-foreground">
							Polling creates a small delay between an upstream change and the dashboard, and history
							covers the latest 90 days.
						</dd>
					</div>
				</dl>
			</section>

			<GraphRule />

			<GraphStat
				title="Cadence"
				items={[
					{ value: "5 min", label: "submission sync" },
					{ value: "30 min", label: "new plugin check" },
					{ value: "8 h", label: "full snapshots" },
					{ value: "daily", label: "explorer relations" },
				]}
			/>

			<GraphRule />

			<section aria-labelledby="project" className="flex flex-col gap-6">
				<div className="flex flex-col gap-3">
					<h2 id="project" className="font-heading text-xl">
						Independent and open source
					</h2>
					<p className="max-w-2xl text-pretty text-muted-foreground">
						Ussego builds and operates Omagraph as a community project. It is not affiliated with Omarchy,
						Basecamp, or the catalog maintainers. You can inspect the code, report incorrect data, or
						suggest an improvement on{" "}
						<a
							href="https://github.com/ussego/omagraph"
							target="_blank"
							rel="noreferrer"
							className={textLink}
						>
							GitHub
						</a>
						.
					</p>
				</div>

				<div className="flex max-w-2xl flex-col gap-3 text-muted-foreground">
					<p>
						Omagraph uses color themes generated from{" "}
						<a
							href="https://github.com/omacom/omarchy"
							target="_blank"
							rel="noreferrer"
							className={textLink}
						>
							Omarchy&apos;s built-in themes
						</a>
						, released under the MIT license.
					</p>
					<p>
						Omagraph&apos;s own code is{" "}
						<a
							href="https://github.com/ussego/omagraph/blob/main/LICENSE"
							target="_blank"
							rel="noreferrer"
							className={textLink}
						>
							MIT licensed
						</a>
						.
					</p>
				</div>
			</section>
		</div>
	);
}
