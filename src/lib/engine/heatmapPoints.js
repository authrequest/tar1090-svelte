const MAGIC = 0x0e7f7c9d;

function decodeDataSource(type) {
	switch (type) {
		case 0: return 'adsb';
		case 1: return 'modeS';
		case 2: return 'adsr';
		case 3: return 'tisb';
		case 4: return 'adsc';
		case 5: return 'mlat';
		case 6: return 'other';
		case 7: return 'modeS';
		case 8: return 'adsb';
		case 9: return 'adsr';
		case 10: return 'tisb';
		case 11: return 'tisb';
		default: return 'unknown';
	}
}

function decodeAltitude(raw) {
	let alt = raw & 0xffff;
	if (alt & 0x8000) {
		alt |= -0x10000;
	}
	if (alt === -123) return 0;
	if (alt === -124) return null;
	return alt * 25;
}

function decodeSpeed(raw) {
	let gs = raw >> 16;
	if (gs === -1) return null;
	return gs / 10;
}

export function parseHeatmapRecords(pointArrays, options = {}) {
	const max = options.max ?? 32000;
	const filtersEnabled = Boolean(options.filters);
	const allowedSources = filtersEnabled ? options.sources ?? null : null;
	const altitudeMin = filtersEnabled ? options.altitudeMin ?? null : null;
	const altitudeMax = filtersEnabled ? options.altitudeMax ?? null : null;
	const useIndexTable = options.useIndexTable !== false;
	const lines = Boolean(options.lines);
	const rng = options.rng ?? Math.random;
	const maxIter = options.maxIter ?? 1_000_000;

	const records = [];
	const arrays = pointArrays.filter(Boolean);
	if (!arrays.length) return records;

	if (useIndexTable) {
		const indexLists = arrays.map((points) => {
			const list = [];
			for (let i = 0; i < points.length; i += 4) {
				if (points[i] === MAGIC) break;
				list.push(points[i]);
			}
			if (!lines) {
				for (let i = list.length - 1; i > 0; i -= 1) {
					const j = Math.floor(rng() * (i + 1));
					const tmp = list[i];
					list[i] = list[j];
					list[j] = tmp;
				}
			}
			return list;
		});

		const offsets = new Array(indexLists.length).fill(0);
		const done = new Set();
		let iterations = 0;

		while (records.length < max && done.size < indexLists.length && iterations++ < maxIter) {
			for (let k = 0; k < indexLists.length && records.length < max; k += 1) {
				const indexes = indexLists[k];
				const points = arrays[k];
				if (!indexes || indexes.length === 0) {
					done.add(k);
					continue;
				}
				if (offsets[k] >= indexes.length) {
					done.add(k);
					continue;
				}
				const index = indexes[offsets[k]];
				offsets[k] += 1;
				if (!Number.isFinite(index)) continue;
				let i = 4 * index;
				if (points[i] === MAGIC) i += 4;
				const pointsU = new Uint32Array(points.buffer);
				for (; i < points.length; i += 4) {
					if (points[i] === MAGIC) break;
					const lat = points[i + 1] / 1e6;
					const lon = points[i + 2] / 1e6;
					if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
					const type = (pointsU[i] >> 27) & 0x1f;
					const source = decodeDataSource(type);
					if (filtersEnabled && Array.isArray(allowedSources) && !allowedSources.includes(source)) {
						continue;
					}
					const alt = decodeAltitude(points[i + 3]);
					if (altitudeMin !== null && alt !== null && alt < altitudeMin) continue;
					if (altitudeMax !== null && alt !== null && alt > altitudeMax) continue;
					const speed = decodeSpeed(points[i + 3]);
					records.push({ lat, lon, altitude: alt, speed, source });
					if (records.length >= max) return records;
				}
			}
		}
		return records;
	}

	for (const points of arrays) {
		const pointsU = new Uint32Array(points.buffer);
		let startIndex = -1;
		for (let i = 0; i < points.length; i += 4) {
			if (points[i] === MAGIC) {
				startIndex = i + 4;
				break;
			}
		}
		if (startIndex < 0) continue;
		for (let i = startIndex; i < points.length; i += 4) {
			if (points[i] === MAGIC) {
				continue;
			}
			const lat = points[i + 1] / 1e6;
			const lon = points[i + 2] / 1e6;
			if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
			const type = (pointsU[i] >> 27) & 0x1f;
			const source = decodeDataSource(type);
			if (filtersEnabled && Array.isArray(allowedSources) && !allowedSources.includes(source)) {
				continue;
			}
			const alt = decodeAltitude(points[i + 3]);
			if (altitudeMin !== null && alt !== null && alt < altitudeMin) continue;
			if (altitudeMax !== null && alt !== null && alt > altitudeMax) continue;
			const speed = decodeSpeed(points[i + 3]);
			records.push({ lat, lon, altitude: alt, speed, source });
			if (records.length >= max) return records;
		}
	}

	return records;
}
