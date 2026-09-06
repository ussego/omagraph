/** @jsxImportSource react */

import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { GraphHeatmap } from "@/components/graph-heatmap";
import { GraphRule } from "@/components/graph-frame/graph-rule";
import { GraphRank } from "@/components/graph-rank";
import { Tabs, TabsList, TabsTab } from "@/components/ui/tabs";

import type { CategoriesResponse } from "@/lib/api-types";
import { categoriesQuery, heatmapQuery } from "@/lib/queries";
import { pageHead } from "@/lib/site";

export const Route = createFileRoute("/categories")({
	head: () =>
		pageHead(
			"Omarchy Plugin Categories · Omagraph",
			"Explore Omarchy plugin categories by catalog size, average hearts, views, copies, and monthly publishing activity across the plugin ecosystem.",
			"/categories",
		),
	loader: ({ context: { queryClient } }) =>
		Promise.all([
			queryClient.query({ ...categoriesQuery(), staleTime: "static" }),
			queryClient.query({ ...heatmapQuery(), staleTime: "static" }),
		]),
	component: CategoriesPage,
});

type CategoryRow = CategoriesResponse["rows"][number];

const METRICS: {
	value: string;
	label: string;

	get: (r: CategoryRow) => number | null;
}[] = [
	{ value: "count", label: "Plugin count", get: (r) => r.count },
	{ value: "avgHearts", label: "Avg hearts", get: (r) => r.avgHearts },
	{ value: "avgViews", label: "Avg views", get: (r) => r.avgViews },
	{
		value: "avgCopies",
		label: "Avg copies",
		get: (r) => r.avgCopies,
	},
];

// Locale pinned so SSR and hydration agree; see the note in lib/format.ts.
const MONTH_FMT = new Intl.DateTimeFormat("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });
const MONTH_SHORT = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });

function Heatmap({ points }: { points: { category: string | null; month: string; count: number }[] }) {
	const { rows, columns, max } = useMemo(() => {
		const totals = new Map<string, number>();
		for (const point of points) {
			const category = point.category ?? "(none)";
			totals.set(category, (totals.get(category) ?? 0) + point.count);
		}
		const rows = [...totals.entries()]
			.sort(([, left], [, right]) => right - left)
			.slice(0, 15)
			.map(([label]) => label);
		const months = [...new Set(points.map((point) => point.month))].sort();
		const countOf = new Map(points.map((point) => [`${point.category ?? "(none)"}|${point.month}`, point.count]));
		const columns = months.map((month) => {
			const [year, monthNumber] = month.split("-");
			const date = new Date(`${year}-${monthNumber}-01T00:00:00Z`);
			return monthNumber === "01" ? MONTH_FMT.format(date) : MONTH_SHORT.format(date);
		});
		return {
			rows: rows.map((label) => ({
				label,
				values: months.map((month) => countOf.get(`${label}|${month}`) ?? 0),
			})),
			columns,
			max: Math.max(1, ...points.map((point) => point.count)),
		};
	}, [points]);

	if (rows.length === 0 || columns.length === 0) {
		return <p className="py-8 text-center text-muted-foreground text-sm">No activity yet.</p>;
	}
	return <GraphHeatmap title="ACTIVITY" columns={columns} rows={rows} max={max} tone="category" className="w-full" />;
}

function CategoriesPage() {
	// Metric only re-slices the loaded rows, so it stays local state.
	const [metric, setMetric] = useState("count");
	const { data: categories } = useSuspenseQuery(categoriesQuery());
	const { data: heatmap } = useSuspenseQuery(heatmapQuery());

	const m = METRICS.find((x) => x.value === metric) ?? METRICS[0];
	const chartRows = categories.rows.slice(0, 15).map((r) => ({
		name: r.category ?? "(none)",
		value: m.get(r) ?? 0,
	}));

	return (
		<div className="flex flex-col gap-8">
			<div className="flex max-w-2xl flex-col gap-1">
				<h1 className="font-heading text-2xl">Omarchy Plugin Categories</h1>
				<p className="text-muted-foreground text-sm">
					Explore each category by plugin count, marketplace engagement, and publishing activity.
				</p>
			</div>

			<div className="flex flex-col gap-4">
				<Tabs value={metric} onValueChange={setMetric}>
					<TabsList variant="underline">
						{METRICS.map((x) => (
							<TabsTab key={x.value} value={x.value}>
								{x.label}
							</TabsTab>
						))}
					</TabsList>
				</Tabs>
				<GraphRank
					title="CATEGORIES"
					tone="category"
					items={chartRows.map((row) => ({ label: row.name, value: row.value }))}
					className="w-full"
				/>
			</div>

			<GraphRule />

			<div className="flex flex-col gap-3">
				<h2 className="font-heading text-xl">Activity by month</h2>
				<Heatmap points={heatmap.points} />
			</div>
		</div>
	);
}
