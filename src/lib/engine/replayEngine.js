import { sDateStringUtc } from './heatmapHistory.js';

const MAGIC = 0x0e7f7c9d;
const HALF_HOUR_MS = 30 * 60 * 1000;

const typeToSource = {
	0: 'adsb',
	1: 'adsb',
	2: 'adsb',
	3: 'tisb',
	4: 'other',
	5: 'mlat',
	6: 'other',
	7: 'modeS',
	8: 'adsb',
	9: 'adsb',
	10: 'tisb',
	11: 'tisb',
	12: 'modeS'
};

function pad2(value) {
	return String(value).padStart(2, '0');
}

export function buildReplayChunkInfo(ts, basePath = 'globe_history/') {
	const time = new Date(ts);
	const sDate = sDateStringUtc(time);
	const index = 2 * time.getUTCHours() + Math.floor(time.getUTCMinutes() / 30);
	const base = basePath.endsWith('/') ? basePath : `${basePath}/`;
	const url = `${base}${sDate}/heatmap/${pad2(index)}.bin.ttf`;
	return { date: sDate, index, key: `${sDate} chunk ${index}`, url };
}

export function parseReplayChunk(buffer) {
	if (!buffer || buffer.byteLength % 16 !== 0) return null;
	const points = new Int32Array(buffer);
	const pointsU = new Uint32Array(buffer);
	const pointsU8 = new Uint8Array(buffer);
	const slices = [];
	for (let i = 0; i < points.length; i += 4) {
		if (points[i] === MAGIC) slices.push(i);
	}
	if (!slices.length) return null;
	const ival = (pointsU[slices[0] + 3] & 0xffff) / 1000;
	return { points, pointsU, pointsU8, slices, ival };
}

function decodeAltitude(raw) {
	let alt = raw & 0xffff;
	if (alt & 0x8000) alt |= -0x10000;
	if (alt === -123) return 0;
	if (alt === -124) return null;
	return alt * 25;
}

function decodeSpeed(raw) {
	let gs = raw >> 16;
	if (gs === -1) return null;
	return gs / 10;
}

function decodeHex(pointsU, i) {
	let hex = (pointsU[i] & 0xffffff).toString(16).padStart(6, '0');
	if (pointsU[i] & 0x1000000) hex = `~${hex}`;
	return hex;
}

function decodeFlight(pointsU8, i) {
	if (pointsU8[4 * (i + 2)] === 0) return null;
	let flight = '';
	for (let j = 0; j < 8; j += 1) {
		flight += String.fromCharCode(pointsU8[4 * (i + 2) + j]);
	}
	return flight.trim() || null;
}

export function decodeReplaySlice(parsed, sliceIndex, cache) {
	if (!parsed) return { now: null, ival: null, records: [] };
	const { points, pointsU, pointsU8, slices } = parsed;
	const i = slices[sliceIndex];
	if (i === undefined) return { now: null, ival: null, records: [] };

	const records = [];
	let now = pointsU[i + 2] / 1000 + pointsU[i + 1] * 4294967.296;
	const ival = (pointsU[i + 3] & 0xffff) / 1000;

	const metaCache = cache || new Map();

	for (let idx = i + 4; idx < points.length && points[idx] !== MAGIC; idx += 4) {
		const latRaw = points[idx + 1];
		if (latRaw >= 1073741824) {
			const hex = decodeHex(pointsU, idx);
			const squawk = (latRaw & 0xffff).toString(10).padStart(4, '0');
			const flight = decodeFlight(pointsU8, idx);
			metaCache.set(hex, { flight, squawk });
			continue;
		}

		const lat = latRaw / 1e6;
		const lon = points[idx + 2] / 1e6;
		const type = (pointsU[idx] >> 27) & 0x1f;
		const source = typeToSource[type] || 'other';
		const hex = decodeHex(pointsU, idx);
		const alt = decodeAltitude(points[idx + 3]);
		const gs = decodeSpeed(points[idx + 3]);

		const merged = metaCache.get(hex) || {};
		records.push({
			hex,
			lat,
			lon,
			alt_baro: alt,
			gs,
			source,
			callsign: merged.flight || undefined,
			squawk: merged.squawk || undefined
		});
	}

	return { now, ival, records, cache: metaCache };
}

export function advanceReplayTime(ts, ival, sliceIndex) {
	const date = new Date(ts.getTime());
	const minutes = (date.getUTCMinutes() >= 30 ? 30 : 0) + Math.floor((ival * sliceIndex) / 60);
	const seconds = Math.floor((ival * sliceIndex) % 60);
	date.setUTCMinutes(minutes);
	date.setUTCSeconds(seconds);
	return date;
}

export function nextReplayTimestamp(ts) {
	const date = new Date(ts.getTime() + HALF_HOUR_MS);
	date.setUTCMinutes(Math.floor(date.getUTCMinutes() / 30) * 30);
	date.setUTCSeconds(0);
	return date;
}

export function clampReplaySliceIndex(index, sliceCount) {
	if (!Number.isFinite(index) || !Number.isFinite(sliceCount) || sliceCount <= 0) return 0;
	if (index < 0) return 0;
	if (index >= sliceCount) return sliceCount - 1;
	return Math.floor(index);
}
