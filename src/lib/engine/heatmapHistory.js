const HALF_HOUR_MS = 1800 * 1000;
const MAGIC = 0x0e7f7c9d;

function pad2(value) {
	return String(value).padStart(2, '0');
}

export function roundToHalfHour(timestampMs) {
	return Math.floor(timestampMs / HALF_HOUR_MS) * HALF_HOUR_MS;
}

export function sDateStringUtc(date) {
	return `${date.getUTCFullYear()}/${pad2(date.getUTCMonth() + 1)}/${pad2(date.getUTCDate())}`;
}

export function buildHeatmapChunkList(settings, basePath = 'globe_history/') {
	const end = roundToHalfHour(settings.end ?? Date.now());
	const duration = settings.duration ?? 24;
	const start = end - duration * 3600 * 1000;
	const numChunks = Math.round((end - start) / HALF_HOUR_MS);
	const base = basePath.endsWith('/') ? basePath : `${basePath}/`;

	const chunks = [];
	for (let i = 0; i < numChunks; i += 1) {
		const time = new Date(start + i * HALF_HOUR_MS);
		const sDate = sDateStringUtc(time);
		const index = 2 * time.getUTCHours() + Math.floor(time.getUTCMinutes() / 30);
		const url = `${base}${sDate}/heatmap/${pad2(index)}.bin.ttf`;
		chunks.push({
			time: time.getTime(),
			index,
			key: `${sDate} chunk ${index}`,
			url
		});
	}

	return chunks;
}

export async function fetchHeatmapChunks(chunks, options = {}) {
	const concurrency = Math.max(1, options.concurrency ?? 2);
	const results = Array(chunks.length).fill(null);
	let cursor = 0;

	async function worker() {
		while (cursor < chunks.length) {
			const index = cursor;
			cursor += 1;
			const chunk = chunks[index];
			try {
				const response = await fetch(chunk.url, {
					caches: 'no-store',
					headers: { 'Accept': 'application/octet-stream' }
				});
				if (!response.ok) {
					results[index] = null;
					continue;
				}
				results[index] = await response.arrayBuffer();
			} catch (error) {
				results[index] = null;
			}
		}
	}

	const workers = Array.from({ length: concurrency }, () => worker());
	await Promise.all(workers);
	return results;
}

export function decodeHeatmapChunks(chunks) {
	const arrays = [];
	for (const chunk of chunks) {
		if (!chunk) continue;
		if (chunk.byteLength % 16 !== 0) continue;
		const points = new Int32Array(chunk);
		let found = false;
		for (let i = 0; i < points.length; i += 4) {
			if (points[i] === MAGIC) {
				found = true;
				break;
			}
		}
		if (!found) continue;
		arrays.push(points);
	}
	return arrays;
}

export const heatmapMagic = MAGIC;
