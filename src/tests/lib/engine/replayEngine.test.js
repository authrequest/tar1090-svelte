import { describe, expect, it } from 'vitest';
import { buildReplayChunkInfo, parseReplayChunk, decodeReplaySlice, clampReplaySliceIndex } from '$lib/engine/replayEngine.js';

describe('buildReplayChunkInfo', () => {
	it('builds legacy chunk URL', () => {
		const ts = Date.parse('2025-01-01T12:34:00Z');
		const chunk = buildReplayChunkInfo(ts, 'globe_history/');
		expect(chunk.url).toBe('globe_history/2025/01/01/heatmap/25.bin.ttf');
	});
});

describe('parseReplayChunk', () => {
	it('parses slices and interval', () => {
		const MAGIC = 0x0e7f7c9d;
		const points = new Int32Array([
			MAGIC, 0, 0, 1000, // slice with ival=1
			0x00000001, 1000000, 2000000, 0,
			MAGIC, 0, 0, 1000
		]);
		const parsed = parseReplayChunk(points.buffer);
		expect(parsed.slices).toEqual([0, 8]);
		expect(parsed.ival).toBe(1);
	});
});

describe('decodeReplaySlice', () => {
	it('extracts aircraft records', () => {
		const MAGIC = 0x0e7f7c9d;
		const altEncoded = 10000 / 25;
		const gs10 = 2500;
		const altSpeed = (gs10 << 16) | (altEncoded & 0xffff);
		const points = new Int32Array([
			MAGIC, 0, 0, 0x00010000,
			0x00000001, 1000000, 2000000, altSpeed,
			MAGIC, 0, 0, 0x00010000
		]);
		const parsed = parseReplayChunk(points.buffer);
		const result = decodeReplaySlice(parsed, 0, new Map());
		expect(result.records).toHaveLength(1);
		expect(result.records[0].hex).toBe('000001');
		expect(result.records[0].lat).toBeCloseTo(1, 5);
		expect(result.records[0].lon).toBeCloseTo(2, 5);
		expect(result.records[0].alt_baro).toBe(10000);
		expect(result.records[0].gs).toBe(250);
	});
});

describe('clampReplaySliceIndex', () => {
	it('clamps index into valid replay slice range', () => {
		expect(clampReplaySliceIndex(-1, 10)).toBe(0);
		expect(clampReplaySliceIndex(4, 10)).toBe(4);
		expect(clampReplaySliceIndex(99, 10)).toBe(9);
		expect(clampReplaySliceIndex(5, 0)).toBe(0);
	});
});
