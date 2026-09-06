import "@tanstack/react-start";
import { env } from "cloudflare:workers";
import { createFileRoute } from "@tanstack/react-router";
import { drizzle } from "drizzle-orm/d1";
import { CHART_SVG_POINTER, chartMetric, stripChartExt } from "@/lib/api-helpers";
import type { ChartSeriesResponse } from "@/lib/api-types";
import { omagraphPlugin } from "@/lib/charts";

export const Route = createFileRoute("/api/charts/plugin/$id/$metric")({
	server: {
		handlers: {
			GET: async ({ params }) => {
				const metricRaw = stripChartExt(params.metric);
				if (metricRaw === null) return Response.json({ error: CHART_SVG_POINTER }, { status: 400 });
				const metric = chartMetric(metricRaw);
				if (!metric)
					return Response.json({ error: "metric must be hearts, views, or copies" }, { status: 400 });
				const series = await omagraphPlugin(drizzle(env.DB), params.id, metric);
				if (!series) return Response.json({ error: "not found" }, { status: 404 });
				return Response.json(series satisfies ChartSeriesResponse);
			},
		},
	},
});
