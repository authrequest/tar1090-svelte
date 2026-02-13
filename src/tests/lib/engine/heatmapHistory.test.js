import { describe, expect, it } from 'vitest';
import { buildHeatmapChunkList, roundToHalfHour } from '$lib/engine/heatmapHistory.js';

describe('heatmap history chunk list', () => {
	it('rounds end time down to half hour', () => {
		const now = Date.parse('2025-01-01T12:34:56Z');
		const rounded = roundToHalfHour(now);
		const expected = Date.parse('2025-01-01T12:30:00Z');
		expect(rounded).toBe(expected);
	});

	it('builds chunk list with legacy URLs', () => {
		const now = Date.parse('2025-01-01T12:34:00Z');
		const settings = { end: now, duration: 1 };
		const chunks = buildHeatmapChunkList(settings, 'globe_history/');

		expect(chunks).toHaveLength(2);
		expect(chunks[0].url).toBe('globe_history/2025/01/01/heatmap/23.bin.ttf');
		expect(chunks[1].url).toBe('globe_history/2025/01/01/heatmap/24.bin.ttf');
	});
});
