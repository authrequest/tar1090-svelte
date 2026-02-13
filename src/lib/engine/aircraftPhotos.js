const defaultApiBase = 'https://api.planespotters.net/pub/photos/';
const cacheByUrl = new Map();
const inFlight = new Map();
const cacheTtlMs = 10_000;

function normalizeBaseUrl(baseUrl) {
	if (!baseUrl) return defaultApiBase;
	return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
}

export function buildPlanespottersUrl(plane, baseUrl = defaultApiBase) {
	if (!plane || !plane.icao) return null;

	const base = normalizeBaseUrl(baseUrl);
	const hex = plane.icao.toUpperCase();

	if (plane.registration) {
		let url = `${base}hex/${hex}?reg=${plane.registration}`;
		if (plane.icaoType) {
			url += `&icaoType=${plane.icaoType}`;
		}
		return url;
	}

	return `${base}hex/${hex}`;
}

export function extractPhotoFromResponse(response) {
	if (!response || typeof response !== 'object') return null;
	const photos = response.photos || response.images;
	if (!Array.isArray(photos) || photos.length === 0) return null;

	const first = photos[0];
	if (!first) return null;
	const thumbnail = first.thumbnail?.src || first.thumbnail;
	if (!thumbnail) return null;

	return {
		src: thumbnail,
		link: first.link || null,
		credit: first.photographer || first.user || null
	};
}

async function fetchPlanespottersPhoto(plane, baseUrl) {
	const url = buildPlanespottersUrl(plane, baseUrl);
	if (!url) return null;

	const cached = cacheByUrl.get(url);
	if (cached && Date.now() - cached.ts < cacheTtlMs) {
		return cached.photo;
	}

	if (inFlight.has(url)) {
		return inFlight.get(url);
	}

	const promise = fetch(url, {
		caches: 'no-store',
		headers: { 'Accept': 'application/json' }
	})
		.then((response) => {
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			return response.json();
		})
		.then((data) => {
			const photo = extractPhotoFromResponse(data);
			cacheByUrl.set(url, { ts: Date.now(), photo });
			return photo;
		})
		.catch((error) => {
			console.warn('Planespotters photo fetch error:', error);
			cacheByUrl.set(url, { ts: Date.now(), photo: null });
			return null;
		})
		.finally(() => {
			inFlight.delete(url);
		});

	inFlight.set(url, promise);
	return promise;
}

export async function getPhotoForPlane(plane, options = {}) {
	if (!plane || !plane.icao) return null;

	const baseUrl = options.baseUrl || defaultApiBase;
	if (plane.icao[0] === '~') return null;
	if (plane.dbinfoLoaded === false) return null;

	return fetchPlanespottersPhoto(plane, baseUrl);
}
