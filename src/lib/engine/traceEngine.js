function pad2(value) {
	return String(value).padStart(2, '0');
}

function sDateStringUtc(date) {
	return `${date.getUTCFullYear()}/${pad2(date.getUTCMonth() + 1)}/${pad2(date.getUTCDate())}`;
}

function isSameUtcDay(a, b) {
	return a.getUTCFullYear() === b.getUTCFullYear()
		&& a.getUTCMonth() === b.getUTCMonth()
		&& a.getUTCDate() === b.getUTCDate();
}

export function buildTraceUrl(hex, date, options = {}) {
	if (!hex || !date) return null;
	const suffix = hex.slice(-2);
	const mode = options.mode || 'auto';
	const basePath = options.basePath || (mode === 'history' ? 'globe_history/' : 'data/');
	const base = basePath.endsWith('/') ? basePath : `${basePath}/`;

	if (mode === 'history') {
		const day = sDateStringUtc(date);
		return `${base}${day}/traces/${suffix}/trace_full_${hex}.json`;
	}

	if (mode === 'recent') {
		return `${base}traces/${suffix}/trace_full_${hex}.json`;
	}

	const today = new Date();
	if (isSameUtcDay(date, today)) {
		return `${base}traces/${suffix}/trace_full_${hex}.json`;
	}
	const day = sDateStringUtc(date);
	return `${base}${day}/traces/${suffix}/trace_full_${hex}.json`;
}

export function buildTraceUrls(hex, date, options = {}) {
	if (!hex || !date) return { recent: null, full: null };
	const suffix = hex.slice(-2);
	const mode = options.mode || 'auto';
	const today = new Date();

	if (mode === 'recent') {
		return {
			recent: `data/traces/${suffix}/trace_recent_${hex}.json`,
			full: `data/traces/${suffix}/trace_full_${hex}.json`
		};
	}

	if (mode === 'history') {
		const day = sDateStringUtc(date);
		return {
			recent: null,
			full: `globe_history/${day}/traces/${suffix}/trace_full_${hex}.json`
		};
	}

	if (isSameUtcDay(date, today)) {
		return {
			recent: `data/traces/${suffix}/trace_recent_${hex}.json`,
			full: `data/traces/${suffix}/trace_full_${hex}.json`
		};
	}

	const day = sDateStringUtc(date);
	return {
		recent: null,
		full: `globe_history/${day}/traces/${suffix}/trace_full_${hex}.json`
	};
}

export function mergeTraceData(fullData, recentData) {
	const fullTrace = Array.isArray(fullData?.trace) ? fullData.trace : [];
	const recentTrace = Array.isArray(recentData?.trace) ? recentData.trace : [];

	if (!fullTrace.length && !recentTrace.length) {
		return { timestamp: 0, trace: [] };
	}

	const merged = [...fullTrace, ...recentTrace];
	merged.sort((a, b) => a[0] - b[0]);

	const deduped = [];
	let lastTs = null;
	for (const point of merged) {
		if (!Array.isArray(point) || point.length < 3) continue;
		if (lastTs !== null && point[0] === lastTs) continue;
		deduped.push(point);
		lastTs = point[0];
	}

	return {
		timestamp: 0,
		trace: deduped
	};
}

export function normalizeTraceStamps(data) {
	if (!data || !Array.isArray(data.trace)) return null;
	const timestamp = Number(data.timestamp) || 0;
	for (const point of data.trace) {
		if (!Array.isArray(point) || point.length === 0) continue;
		point[0] = point[0] + timestamp;
	}
	data.timestamp = 0;
	return data;
}

export function extractTracePath(data) {
	if (!data || !Array.isArray(data.trace)) return [];
	return data.trace.map(point => [point[2], point[1]]);
}

function parseHhMm(text) {
	if (!text || typeof text !== 'string') return null;
	const [hh, mm] = text.split(':').map(Number);
	if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
	if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
	return hh * 3600 + mm * 60;
}

export function filterTraceByWindow(data, startHhMm, endHhMm) {
	if (!data || !Array.isArray(data.trace)) return { timestamp: 0, trace: [] };
	const start = parseHhMm(startHhMm);
	const end = parseHhMm(endHhMm);
	if (start === null && end === null) return data;

	const filtered = data.trace.filter((point) => {
		if (!Array.isArray(point) || point.length < 1) return false;
		const ts = Number(point[0]);
		if (!Number.isFinite(ts)) return false;
		const date = new Date(ts * 1000);
		const sec = date.getUTCHours() * 3600 + date.getUTCMinutes() * 60 + date.getUTCSeconds();
		if (start !== null && sec < start) return false;
		if (end !== null && sec > end) return false;
		return true;
	});

	return {
		timestamp: 0,
		trace: filtered
	};
}
