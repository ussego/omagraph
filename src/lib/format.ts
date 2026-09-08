/** Number/date formatting for the dashboard. */

// Locale is pinned so SSR and hydration agree (the site chrome is English);
// an unpinned locale resolves per-environment and mismatches on hydration.
const LOCALE = "en-US";

const nf = new Intl.NumberFormat(LOCALE);

export const fmt = (n: number | null | undefined): string => (n == null ? "—" : nf.format(n));

/** Cut a string to maxLen chars, appending "…" when truncated. */
export const truncate = (s: string, maxLen = 18): string => (s.length > maxLen ? `${s.slice(0, maxLen)}…` : s);

export const pct = (a: number, b: number): number => (b > 0 ? Math.round((a / b) * 100) : 0);

export const fmtDate = (iso: string | null | undefined): string =>
	iso
		? new Date(iso).toLocaleDateString(LOCALE, {
				year: "numeric",
				month: "short",
				day: "numeric",
				timeZone: "UTC",
			})
		: "—";

export const fmtMonthDay = (iso: string | null | undefined): string =>
	iso ? new Date(iso).toLocaleDateString(LOCALE, { month: "short", day: "numeric", timeZone: "UTC" }) : "—";

export const fmtDateTime = (iso: string | null | undefined): string =>
	iso
		? new Date(iso).toLocaleString(LOCALE, {
				year: "numeric",
				month: "short",
				day: "numeric",
				hour: "2-digit",
				minute: "2-digit",
				timeZone: "UTC",
			})
		: "—";

/** "7d ago"-style relative label for the last snapshot time. */
export const fmtRelative = (iso: string | null | undefined): string => {
	if (!iso) return "never";
	const ms = Date.now() - new Date(iso).getTime();
	const h = Math.floor(ms / 3_600_000);
	if (h < 1) return "just now";
	if (h < 24) return `${h}h ago`;
	const d = Math.floor(h / 24);
	if (d < 30) return `${d}d ago`;
	const months = Math.floor(d / 30);
	if (months < 12) return `${months}mo ago`;
	return `${Math.floor(months / 12)}y ago`;
};

export const fmtRelativeLong = (iso: string | null | undefined, now = Date.now()): string => {
	if (!iso) return "never";
	const minutes = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000));
	if (minutes < 1) return "just now";
	if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
	const days = Math.floor(hours / 24);
	if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
	const months = Math.floor(days / 30);
	if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
	const years = Math.floor(months / 12);
	return `${years} year${years === 1 ? "" : "s"} ago`;
};
