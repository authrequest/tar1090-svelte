import { describe, expect, it } from 'vitest';
import { parseHeatmapRecords } from '$lib/engine/heatmapPoints.js';

describe('parseHeatmapRecords', () => {
	it('parses records after magic marker', () => {
		const MAGIC = 0x0e7f7c9d;
		const hex = 0x00abcdef;
		const lat = 37.5;
		const lon = -122.5;
		const altEncoded = 10000 / 25;
		const gs10 = 2500;
		const altSpeed = (gs10 << 16) | (altEncoded & 0xffff);

		const points = new Int32Array([
			0, 0, 0, 0,
			MAGIC, 0, 0, 0,
			hex,
			Math.round(lat * 1e6),
			Math.round(lon * 1e6),
			altSpeed
		]);

		const records = parseHeatmapRecords([points], { max: 10, useIndexTable: false });
		expect(records).toHaveLength(1);
		expect(records[0].lat).toBeCloseTo(lat, 5);
		expect(records[0].lon).toBeCloseTo(lon, 5);
		expect(records[0].altitude).toBe(10000);
		expect(records[0].speed).toBe(250);
	});

	it('respects index table order when lines enabled', () => {
		const MAGIC = 0x0e7f7c9d;
		const altEncoded = 10000 / 25;
		const gs10 = 2500;
		const altSpeed = (gs10 << 16) | (altEncoded & 0xffff);

		const points = new Int32Array([
			3, 0, 0, 0,
			4, 0, 0, 0,
			MAGIC, 0, 0, 0,
			0x00000001, 1000000, 2000000, altSpeed,
			MAGIC, 0, 0, 0,
			0x00000002, 3000000, 4000000, altSpeed
		]);

		const records = parseHeatmapRecords([points], { max: 10, lines: true });
		expect(records).toHaveLength(2);
		expect(records[0].lat).toBeCloseTo(1, 5);
		expect(records[1].lat).toBeCloseTo(3, 5);
	});

	it('shuffles index table order when lines disabled', () => {
		const MAGIC = 0x0e7f7c9d;
		const altEncoded = 10000 / 25;
		const gs10 = 2500;
		const altSpeed = (gs10 << 16) | (altEncoded & 0xffff);

		const points = new Int32Array([
			3, 0, 0, 0,
			4, 0, 0, 0,
			MAGIC, 0, 0, 0,
			0x00000001, 1000000, 2000000, altSpeed,
			MAGIC, 0, 0, 0,
			0x00000002, 3000000, 4000000, altSpeed
		]);

		const rng = () => 0;
		const records = parseHeatmapRecords([points], { max: 10, lines: false, rng });
		expect(records).toHaveLength(2);
		expect(records[0].lat).toBeCloseTo(3, 5);
		expect(records[1].lat).toBeCloseTo(1, 5);
	});
});
