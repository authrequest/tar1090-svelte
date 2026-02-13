const requestQueue = [];
const requestCache = new Map();
let requestCount = 0;
let typeCache = null;
let typeCachePromise = null;

function dbAjaxRequestComplete() {
	if (requestQueue.length === 0 || requestCount >= 1) return;

	requestCount++;
	const req = requestQueue.shift();
	const url = `/api/aircraft-db?key=${encodeURIComponent(req.bkey)}`;

	fetch(url, { cache: 'force-cache' })
		.then(async (response) => {
			if (!response.ok) {
				if (response.status === 404) return null;
				throw new Error(`HTTP ${response.status}`);
			}
			return response.json();
		})
		.then((data) => req.resolve(data))
		.catch((error) => {
			requestCache.delete(req.bkey);
			req.reject(error);
		})
		.finally(() => {
			requestCount--;
			dbAjaxRequestComplete();
		});
}

function dbAjax(bkey) {
	if (requestCache.has(bkey)) return requestCache.get(bkey);

	const req = {};
	req.bkey = bkey;
	req.promise = new Promise((resolve, reject) => {
		req.resolve = resolve;
		req.reject = reject;
	});

	requestCache.set(bkey, req.promise);
	requestQueue.push(req);
	dbAjaxRequestComplete();
	return req.promise;
}

async function requestFromDb(icao, level) {
	const bkey = icao.substring(0, level);
	const dkey = icao.substring(level);
	const data = await dbAjax(bkey);

	if (data == null) return null;
	if (dkey in data) return data[dkey];

	if ('children' in data) {
		const subkey = bkey + dkey.substring(0, 1);
		if (Array.isArray(data.children) && data.children.includes(subkey)) {
			return requestFromDb(icao, level + 1);
		}
	}

	return null;
}

export function lookupTypeData(typeCode) {
	if (!typeCache || !typeCode) return null;
	const normalized = String(typeCode).toUpperCase() === 'P8 ?' ? 'P8' : String(typeCode).toUpperCase();
	if (!(normalized in typeCache)) return null;

	const entry = typeCache[normalized];
	if (!Array.isArray(entry)) return null;

	return {
		typeLong: entry[0] ?? null,
		typeDescription: entry[1] ?? null,
		wtc: entry[2] ?? null
	};
}

export async function loadTypeCache() {
	if (typeCache) return typeCache;
	if (typeCachePromise) return typeCachePromise;

	typeCachePromise = fetch('/api/aircraft-db?typeCache=1', { cache: 'force-cache' })
		.then(async (response) => {
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			return response.json();
		})
		.then((data) => {
			typeCache = data;
			return typeCache;
		})
		.finally(() => {
			typeCachePromise = null;
		});

	return typeCachePromise;
}

export async function dbLoad(icao) {
	if (!icao || icao[0] === '~') return null;
	return requestFromDb(String(icao).toUpperCase(), 1);
}
