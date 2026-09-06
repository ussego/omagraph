/** @jsxImportSource react */

import { IconExternalLink } from "@tabler/icons-react";
import { createFileRoute } from "@tanstack/react-router";
import { GraphRule } from "@/components/graph-frame/graph-rule";
import { Code, CopyButton, Snippet } from "@/components/snippet";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { pageHead } from "@/lib/site";

export const Route = createFileRoute("/badges")({
	head: () =>
		pageHead(
			"Omarchy Plugin Badges · Omagraph",
			"Add live Omarchy plugin and author badges for hearts, views, copies, and catalog rankings using Omagraph's public badge endpoints.",
			"/badges",
		),
	component: BadgesPage,
});

const pluginMarkdown = (stat: string, id: string) =>
	`[![${stat}](https://stats.ussego.com/api/badges/${stat}/${id}.svg)](https://stats.ussego.com/plugins/${id})`;

const rankingMarkdown = (stat: string, id: string) =>
	`[![${stat} rank](https://stats.ussego.com/api/badges/ranking/${stat}/${id}.svg)](https://stats.ussego.com/plugins/${id})`;

const authorMarkdown = (stat: string, id: string) =>
	`![${stat}](https://stats.ussego.com/api/badges/${stat}/${id}.svg)`;

// Live examples served directly by Omagraph.
const EXAMPLES: { path: string; src: string; markdown: string }[] = [
	{
		path: "/api/badges/hearts/ussego.otoru.svg",
		src: "https://stats.ussego.com/api/badges/hearts/ussego.otoru.svg",
		markdown: pluginMarkdown("hearts", "ussego.otoru"),
	},
	{
		path: "/api/badges/views/ussego.otoru.svg",
		src: "https://stats.ussego.com/api/badges/views/ussego.otoru.svg",
		markdown: pluginMarkdown("views", "ussego.otoru"),
	},
	{
		path: "/api/badges/copies/ussego.otoru.svg",
		src: "https://stats.ussego.com/api/badges/copies/ussego.otoru.svg",
		markdown: pluginMarkdown("copies", "ussego.otoru"),
	},
	{
		path: "/api/badges/views/ussego.svg (author total)",
		src: "https://stats.ussego.com/api/badges/views/ussego.svg",
		markdown: authorMarkdown("views", "ussego"),
	},
	{
		path: "/api/badges/ranking/hearts/ussego.otoru.svg",
		src: "https://stats.ussego.com/api/badges/ranking/hearts/ussego.otoru.svg",
		markdown: rankingMarkdown("hearts", "ussego.otoru"),
	},
	{
		path: "/api/badges/ranking/avg/ussego.otoru.svg",
		src: "https://stats.ussego.com/api/badges/ranking/avg/ussego.otoru.svg",
		markdown: rankingMarkdown("avg", "ussego.otoru"),
	},
	{
		path: "/api/badges/winner/akshar.radio-atlas.svg",
		src: "https://stats.ussego.com/api/badges/winner/akshar.radio-atlas.svg",
		markdown:
			"[![winner](https://stats.ussego.com/api/badges/winner/akshar.radio-atlas.svg)](https://stats.ussego.com/plugins/akshar.radio-atlas)",
	},
];

function BadgesPage() {
	return (
		<div className="flex flex-col gap-8">
			<div className="flex items-center justify-between gap-4">
				<h1 className="font-heading text-2xl">Omarchy Plugin Badges</h1>
				<a
					href="https://github.com/ussego/omagraph"
					target="_blank"
					rel="noreferrer"
					className={buttonVariants({ variant: "outline" })}
				>
					<IconExternalLink data-icon="inline-start" />
					<span>Source</span>
				</a>
			</div>

			<p className="max-w-2xl text-muted-foreground">
				Embeddable SVG badges for plugin and author stats, served directly from Omagraph's mirrored catalog data.
				Public API reference:{" "}
				<a href="/api-docs" className="underline decoration-dotted underline-offset-4">
					/api-docs
				</a>
				.
			</p>

			<div className="flex flex-col gap-4">
				<h2 className="font-heading text-xl">Live examples</h2>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Badge</TableHead>
							<TableHead>README snippet</TableHead>
							<TableHead className="sticky right-0 bg-background text-right">Copy</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{EXAMPLES.map((e) => (
							<TableRow key={e.path}>
								<TableCell>
									<img src={e.src} alt={e.path} className="h-6 w-auto max-w-none" loading="lazy" />
								</TableCell>
								<TableCell>
									<code className="font-mono text-muted-foreground text-xs">{e.markdown}</code>
								</TableCell>
								<TableCell className="sticky right-0 bg-background text-right">
									<CopyButton text={e.markdown} label="Copy snippet" />
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>

			<GraphRule />

			<div className="flex flex-col gap-3">
				<h2 className="font-heading text-xl">Endpoints</h2>
				<Snippet>GET /api/badges/:stat/:id.svg</Snippet>
				<ul className="list-inside list-disc text-muted-foreground">
					<li>The extensionless URL returns the same SVG.</li>
					<li>
						<Code>stat</Code> is <Code>views</Code>, <Code>copies</Code>, or <Code>hearts</Code>.
					</li>
					<li>
						<Code>id</Code> is a plugin id like <Code>37signals.basecamp</Code>, or a bare author name like{" "}
						<Code>ussego</Code>. Author ids return the total across all the author's plugins.
					</li>
				</ul>
				<Snippet>GET /api/badges/ranking/:stat/:id.svg</Snippet>
				<ul className="list-inside list-disc text-muted-foreground">
					<li>
						Same stats, plus <Code>avg</Code> (the mean of views, copies, and hearts).
					</li>
					<li>Ranking is competition style: 1 is highest, ties share a place.</li>
				</ul>
			</div>

			<div className="flex flex-col gap-3">
				<h2 className="font-heading text-xl">Query parameters</h2>
				<div className="flex flex-col gap-3">
					<div className="flex gap-4">
						<span className="w-32 shrink-0">
							<Code>label</Code>
						</span>
						<span className="text-muted-foreground">
							Text on the left side of the badge. Defaults to the stat name, capitalized.
						</span>
					</div>
					<div className="flex gap-4">
						<span className="w-32 shrink-0">
							<Code>color</Code>
						</span>
						<span className="text-muted-foreground">
							Legacy JSON color for bots. SVG badges always use Omagraph's blue accent.
						</span>
					</div>
				</div>
			</div>

			<div className="flex flex-col gap-3">
				<h2 className="font-heading text-xl">Rendering</h2>
				<p className="text-muted-foreground">Use the SVG URL directly in README markdown:</p>
				<Snippet>{`[![OTORU HEARTS](https://stats.ussego.com/api/badges/hearts/ussego.otoru.svg)](https://stats.ussego.com/plugins/ussego.otoru)`}</Snippet>
				<p className="text-muted-foreground">
					For bots, append <Code>.json</Code> for the legacy shields.io endpoint schema.
				</p>
				<Snippet lang="json">{`{"schemaVersion": 1, "label": "Views", "message": "109", "color": "blue"}`}</Snippet>
				<Snippet>{`https://stats.ussego.com/api/badges/views/ussego.otoru.json`}</Snippet>
			</div>
		</div>
	);
}
