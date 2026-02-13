import { describe, expect, it } from 'vitest';
import { deriveHeatmapSettings } from '$lib/engine/heatmapConfig.js';

describe('deriveHeatmapSettings', () => {
	it('uses legacy defaults with heatmap param', () => {
		const now = Date.parse('2025-01-01T12:34:00Z');
		const settings = deriveHeatmapSettings({ heatmap: 200000 }, now);

		expect(settings.enabled).toBe(true);
		expect(settings.max).toBe(200000);
		expect(settings.duration).toBe(24);
		expect(settings.end).toBe(now);
		expect(settings.radius).toBe(2.5);
		expect(settings.real).toBe(false);
	});

	it('uses realHeat defaults when enabled', () => {
		const now = Date.parse('2025-01-01T12:34:00Z');
		const settings = deriveHeatmapSettings({ realHeat: true }, now);

		expect(settings.enabled).toBe(true);
		expect(settings.max).toBe(50000);
		expect(settings.real).toBe(true);
		expect(settings.radius).toBe(1.5);
		expect(settings.blur).toBe(4);
		expect(settings.weight).toBe(0.25);
		expect(settings.end).toBe(now);
	});

	it('clamps duration to minimum 0.5 hours', () => {
		const now = Date.parse('2025-01-01T12:34:00Z');
		const settings = deriveHeatmapSettings({ heatmap: 100, heatDuration: 0.1 }, now);

		expect(settings.duration).toBe(0.5);
	});

	it('applies heatEnd and heatRadius overrides', () => {
		const now = Date.parse('2025-01-01T12:34:00Z');
		const settings = deriveHeatmapSettings({ heatmap: 100, heatEnd: 2, heatRadius: 3.25 }, now);

		expect(settings.end).toBe(now - 2 * 3600 * 1000);
		expect(settings.radius).toBe(3.25);
	});
});
