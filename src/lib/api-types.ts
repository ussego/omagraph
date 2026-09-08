// Wire contract shared by the Worker API (src/lib/api.ts) and the client
// (src/lib/queries.ts). Pure types with no server-only imports, so the client
// bundle never pulls server dependencies. api.ts annotates its responses with
// `satisfies XResponse` so tsc fails if a handler drifts from the contract.

export type LatestSnapshot = {
	pluginId: string;
	snapshotAt: string;
	views: number | null;
	copies: number | null;
	hearts: number | null;
	verificationStatus: string | null;
	version: string | null;
	repositoryUpdatedAt: string | null;
	upstreamCheckStatus: string | null;
};

export type PluginSummary = {
	id: string;
	name: string | null;
	description: string | null;
	author: string | null;
	category: string | null;
	kind: string | null;
	license: string | null;
	tags: string[] | null;
	addedAt: string | null;
	repo: string | null;
	stars: number | null;
	installAvailable: boolean | null;
	status: string | null;
	sourceType: string | null;
	latest: LatestSnapshot | null;
};

export type PluginListResponse = {
	total: number;
	page: number;
	pageSize: number;
	plugins: PluginSummary[];
};

export type Snapshot = {
	id: number;
	pluginId: string;
	snapshotAt: string;
	views: number | null;
	copies: number | null;
	hearts: number | null;
	verificationStatus: string | null;
	version: string | null;
	repositoryUpdatedAt: string | null;
	upstreamCheckStatus: string | null;
};

export type RelatedPlugin = {
	pluginId: string;
	name: string | null;
	author: string | null;
	stars: number | null;
	similarity: number;
};

export type PluginDetailResponse = {
	plugin: Omit<PluginSummary, "latest">;
	snapshots: Snapshot[];
	averages: { views: number | null; copies: number | null; hearts: number | null };
	/**
	 * Explorer graph state for the plugin, or null when the explorer poll
	 * hasn't synced it yet (built-in plugins never get a row). `related` is
	 * sorted by similarity, descending.
	 */
	relations: {
		cluster: string | null;
		influence: number | null;
		related: RelatedPlugin[];
	} | null;
	placements: {
		competitionId: string;
		place: number;
		prize: number | null;
		title: string;
		announcedAt: string;
		announcementUrl: string;
	}[];
};

export type CompetitionsResponse = {
	competitions: {
		id: string;
		title: string;
		announcedAt: string;
		announcementUrl: string;
		placements: { pluginId: string; name: string | null; place: number; prize: number | null }[];
	}[];
};

export type StatsPoint = { bucket: string; count: number };
export type StatsResponse = {
	groupBy: string;
	from: string | null;
	to: string | null;
	points: StatsPoint[];
};

export type LeaderboardRow = {
	pluginId: string;
	name: string | null;
	author: string | null;
	category: string | null;
	views: number | null;
	copies: number | null;
	hearts: number | null;
	score: number | null;
	spark?: { snapshotAt: string; views: number | null; copies: number | null; hearts: number | null }[];
};
export type LeaderboardResponse = { metric: string; rows: LeaderboardRow[] };

export type TrendingResponse = {
	days: number;
	top: {
		pluginId: string;
		name: string | null;
		author: string | null;
		views: number;
		copies: number;
		hearts: number;
	}[];
};

export type SearchResponse = {
	q: string;
	plugins: {
		id: string;
		name: string | null;
		author: string | null;
		category: string | null;
		hearts: number | null;
	}[];
	authors: {
		author: string | null;
		plugins: number;
		hearts: number | null;
	}[];
};

export type AuthorsResponse = {
	rows: {
		author: string | null;
		plugins: number;
		views: number | null;
		copies: number | null;
		hearts: number | null;
	}[];
};

export type AuthorDetailResponse = {
	author: string;
	totals: { plugins: number; views: number; copies: number; hearts: number };
	plugins: {
		id: string;
		name: string | null;
		category: string | null;
		kind: string | null;
		status: string | null;
		repo: string | null;
		addedAt: string | null;
		views: number | null;
		copies: number | null;
		hearts: number | null;
	}[];
	/**
	 * Per-poll sums across the author's plugins (one point per snapshotAt),
	 * ascending. Copies are 0 for manual-setup plugins, which never record them.
	 */
	activity: { snapshotAt: string; views: number; copies: number; hearts: number }[];
};

export type BreakdownRow = { status: string | null; count: number };
export type BreakdownResponse = {
	verification: BreakdownRow[];
	installStatus: BreakdownRow[];
	totalPlugins: number;
	verifiedCount: number;
};

export type CategoriesResponse = {
	rows: {
		category: string | null;
		count: number;
		avgHearts: number | null;
		avgViews: number | null;
		avgCopies: number | null;
	}[];
};

export type HeatmapResponse = {
	points: { category: string | null; month: string; count: number }[];
};

export type HealthResponse = {
	lastSnapshotAt: string | null;
	pluginCount: number;
	// Running total from the meta table; null until the first heavy poll seeds it.
	snapshotCount: number | null;
};

export type SubmissionKind = "plugin" | "verification";

export type SubmissionWindowKind = {
	total: number;
	medianGapMinutes: number | null;
	averageGapMinutes: number | null;
};

export type SubmissionWindow = {
	points: { bucket: string; plugin: number; verification: number }[];
	plugin: SubmissionWindowKind;
	verification: SubmissionWindowKind;
};

export type SubmissionTag = { label: string; count: number };

export type SubmissionStatsResponse = {
	hourly: SubmissionWindow;
	daily: SubmissionWindow;
	allTime: Record<
		SubmissionKind,
		{
			total: number;
			peakHour: { bucket: string; count: number } | null;
			peakDay: { bucket: string; count: number } | null;
		}
	>;
	verificationTags: SubmissionTag[];
	syncedAt: string | null;
};

export type BrokenResponse = {
	staleDays: number;
	plugins: {
		pluginId: string;
		name: string | null;
		author: string | null;
		upstreamCheckStatus: string | null;
		repositoryUpdatedAt: string | null;
	}[];
};

export type UnverifiedResponse = {
	rangeDays: number;
	plugins: {
		pluginId: string;
		name: string | null;
		author: string | null;
		currentVerificationStatus: string | null;
		repositoryUpdatedAt: string | null;
	}[];
};

export type BadgeResponse = {
	schemaVersion: number;
	label: string;
	message: string;
	color: string;
};

/** Chart-data response: JSON series consumed by shieldcn's /chart/json.svg. */
export type ChartSeriesResponse = {
	title: string;
	subtitle?: string;
	link?: string;
	total: number;
	points: { date: string; count: number }[];
};
