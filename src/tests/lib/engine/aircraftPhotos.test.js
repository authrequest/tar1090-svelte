import { describe, expect, it } from 'vitest';
import { buildPlanespottersUrl, extractPhotoFromResponse } from '$lib/engine/aircraftPhotos.js';

describe('buildPlanespottersUrl', () => {
	it('builds URL with registration and type', () => {
		const plane = { icao: 'abc123', registration: 'N123AB', icaoType: 'A320' };
		const url = buildPlanespottersUrl(plane, 'https://api.planespotters.net/pub/photos/');
		expect(url).toBe('https://api.planespotters.net/pub/photos/hex/ABC123?reg=N123AB&icaoType=A320');
	});

	it('builds URL without registration', () => {
		const plane = { icao: 'abc123' };
		const url = buildPlanespottersUrl(plane, 'https://api.planespotters.net/pub/photos/');
		expect(url).toBe('https://api.planespotters.net/pub/photos/hex/ABC123');
	});
});

describe('extractPhotoFromResponse', () => {
	it('extracts thumbnail, link, and photographer', () => {
		const response = {
			photos: [
				{
					thumbnail: { src: 'https://img.test/1.jpg' },
					link: 'https://example.test/photo/1',
					photographer: 'Jane Doe'
				}
			]
		};
		const photo = extractPhotoFromResponse(response);
		expect(photo).toEqual({
			src: 'https://img.test/1.jpg',
			link: 'https://example.test/photo/1',
			credit: 'Jane Doe'
		});
	});

	it('returns null when no photos', () => {
		const photo = extractPhotoFromResponse({ photos: [] });
		expect(photo).toBeNull();
	});
});
