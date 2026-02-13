import { describe, expect, it } from 'vitest';
import { resolveRefreshInterval } from '$lib/engine/fetcher.js';

describe('resolveRefreshInterval', () => {
	it('uses receiver refresh when valid', () => {
		expect(resolveRefreshInterval({ refresh: 1500 }, 1000)).toBe(1500);
	});

	it('accepts numeric strings', () => {
		expect(resolveRefreshInterval({ refresh: '2000' }, 1000)).toBe(2000);
	});

	it('falls back on invalid values', () => {
		expect(resolveRefreshInterval({ refresh: 'nope' }, 1000)).toBe(1000);
		expect(resolveRefreshInterval({ refresh: -50 }, 1000)).toBe(1000);
		expect(resolveRefreshInterval({}, 1000)).toBe(1000);
	});
});
