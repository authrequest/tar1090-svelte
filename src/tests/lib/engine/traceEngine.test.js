import { describe, expect, it } from 'vitest';
import { buildTraceUrl, buildTraceUrls, mergeTraceData, normalizeTraceStamps, extractTracePath, filterTraceByWindow } from '$lib/engine/traceEngine.js';

describe('buildTraceUrl', () => {
	it('uses history path for non-today dates', () => {
		const date = new Date(Date.UTC(2025, 0, 1, 12, 0, 0));
		const url = buildTraceUrl('abcdef', date, { mode: 'history', basePath: 'globe_history/' });
		expect(url).toBe('globe_history/2025/01/01/traces/ef/trace_full_abcdef.json');
	});

	it('uses recent path for today when mode is recent', () => {
		const date = new Date();
		const url = buildTraceUrl('abcdef', date, { mode: 'recent', basePath: 'data/' });
		expect(url).toBe(`data/traces/ef/trace_full_abcdef.json`);
	});
});

describe('buildTraceUrls', () => {
	it('returns recent and full urls for today in auto mode', () => {
		const date = new Date();
		const urls = buildTraceUrls('abcdef', date, { mode: 'auto' });
		expect(urls.recent).toBe('data/traces/ef/trace_recent_abcdef.json');
		expect(urls.full).toBe('data/traces/ef/trace_full_abcdef.json');
	});
});

describe('normalizeTraceStamps', () => {
	it('adds timestamp offset to trace points', () => {
		const data = { timestamp: 1000, trace: [[1, 10, 20], [2, 11, 21]] };
		const normalized = normalizeTraceStamps(data);
		expect(normalized.trace[0][0]).toBe(1001);
		expect(normalized.trace[1][0]).toBe(1002);
		expect(normalized.timestamp).toBe(0);
	});
});

describe('extractTracePath', () => {
	it('returns lon/lat pairs', () => {
		const data = { trace: [[1000, 10, 20], [1001, 11, 21]] };
		const path = extractTracePath(data);
		expect(path).toEqual([[20, 10], [21, 11]]);
	});
});

describe('mergeTraceData', () => {
	it('merges full and recent traces without duplicate timestamps', () => {
		const full = { trace: [[1000, 10, 20], [1001, 11, 21]] };
		const recent = { trace: [[1001, 11, 21], [1002, 12, 22]] };
		const merged = mergeTraceData(full, recent);
		expect(merged.trace).toEqual([
			[1000, 10, 20],
			[1001, 11, 21],
			[1002, 12, 22]
		]);
	});
});

describe('filterTraceByWindow', () => {
	it('filters trace points by UTC time window', () => {
		const base = Date.UTC(2025, 0, 1, 0, 0, 0) / 1000;
		const data = {
			trace: [
				[base + 10, 10, 20],
				[base + 3600, 11, 21],
				[base + 7200, 12, 22]
			]
		};
		const filtered = filterTraceByWindow(data, '00:30', '01:30');
		expect(filtered.trace).toEqual([[base + 3600, 11, 21]]);
	});
});
