export function formatAge(iso: string | null, now = Date.now()): string {
	if (!iso) return "never";
	const at = new Date(iso).getTime();
	if (Number.isNaN(at)) return "never";
	const seconds = Math.max(0, Math.round((now - at) / 1000));
	if (seconds < 5) return "just now";
	if (seconds < 60) return `${seconds}s ago`;
	const minutes = Math.round(seconds / 60);
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.round(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.round(hours / 24);
	if (days < 30) return `${days}d ago`;
	return new Date(iso).toLocaleDateString();
}

export function formatBytes(bytes: number): string {
	if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
	const units = ["B", "KiB", "MiB", "GiB", "TiB"];
	const exp = Math.min(
		units.length - 1,
		Math.floor(Math.log(bytes) / Math.log(1024)),
	);
	const value = bytes / 1024 ** exp;
	const precision = value >= 100 || exp === 0 ? 0 : 1;
	return `${value.toFixed(precision)} ${units[exp]}`;
}

export function formatUptime(seconds: number): string {
	if (!Number.isFinite(seconds) || seconds < 0) return "—";
	const days = Math.floor(seconds / 86400);
	const hours = Math.floor((seconds % 86400) / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	if (days > 0) return `${days}d ${hours}h`;
	if (hours > 0) return `${hours}h ${minutes}m`;
	return `${Math.floor(seconds)}s`;
}

export function formatLoadavg(loadavg: number[]): string {
	return loadavg.length > 0
		? loadavg.map((v) => (Number.isFinite(v) ? v.toFixed(2) : "—")).join(" ")
		: "—";
}

export function memoryUsed(total: number, free: number): number {
	if (!Number.isFinite(total) || total <= 0) return 0;
	return Math.max(0, total - (Number.isFinite(free) ? free : 0));
}
