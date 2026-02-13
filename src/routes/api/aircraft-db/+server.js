import * as Sentry from '@sentry/sveltekit';
import { env } from '$env/dynamic/private';

const SENTRY_THROTTLE_MS = 60_000;
const sentryThrottle = new Map();

function shouldSendSentry(key) {
	const now = Date.now();
	const last = sentryThrottle.get(key) ?? 0;
	if (now - last < SENTRY_THROTTLE_MS) return false;
	sentryThrottle.set(key, now);
	return true;
}

function deriveRemoteBase() {
	const explicit = env.AIRCRAFT_DB_REMOTE_BASE_URL;
	if (explicit) return explicit.replace(/\/$/, '');

	const zst = env.AIRCRAFT_ZST_REMOTE_URL;
	if (zst) {
		const match = zst.match(/^(https?:\/\/[^/]+)(\/.*)?$/i);
		if (match) {
			const origin = match[1];
			const path = match[2] ?? '';
			const trimmed = path.replace(/\/data\/aircraft\.binCraft\.zst$/i, '').replace(/\/$/, '');
			return `${origin}${trimmed}`;
		}
	}

	return 'http://192.168.1.56/tar1090';
}

function sanitizeDbKey(input) {
	if (!input) return null;
	const key = String(input).trim().toUpperCase();
	if (!/^[0-9A-F]{1,6}$/.test(key)) return null;
	return key;
}

export async function GET({ fetch, url }) {
	const base = deriveRemoteBase();
	const typeCache = url.searchParams.get('typeCache');
	const key = sanitizeDbKey(url.searchParams.get('key'));

	let upstreamCandidates;
	if (typeCache === '1' || typeCache === 'true') {
		upstreamCandidates = [
			`${base}/db2/icao_aircraft_types2.js`,
			`${base}/db/icao_aircraft_types2.js`,
			`${base}/db/icao_aircraft_types.json`
		];
	} else if (key) {
		upstreamCandidates = [
			`${base}/db2/${key}.js`,
			`${base}/db/${key}.js`
		];
	} else {
		return new Response('Missing key or typeCache query parameter', { status: 400 });
	}

	try {
		let upstream = null;
		let upstreamUrl = null;

		for (const candidate of upstreamCandidates) {
			const response = await fetch(candidate, {
				cache: 'force-cache',
				headers: { Accept: 'application/json' }
			});
			if (response.ok) {
				upstream = response;
				upstreamUrl = candidate;
				break;
			}
			if (response.status !== 404) {
				upstream = response;
				upstreamUrl = candidate;
				break;
			}
		}

		if (!upstream) {
			return new Response('Not found', { status: 404 });
		}

		if (!upstream.ok) {
			if (upstream.status === 404) {
				return new Response('Not found', { status: 404 });
			}
			if (shouldSendSentry('aircraft_db_proxy_non_ok')) {
				Sentry.captureMessage('aircraft-db upstream non-OK response', {
					level: 'warning',
					tags: { area: 'aircraft-db-proxy' },
					extra: { url: upstreamUrl, status: upstream.status }
				});
			}
			return new Response(`Upstream error: HTTP ${upstream.status}`, { status: 502 });
		}

		const body = await upstream.text();
		return new Response(body, {
			status: 200,
			headers: {
				'content-type': 'application/json; charset=utf-8',
				'cache-control': 'public, max-age=86400, stale-while-revalidate=604800'
			}
		});
	} catch (error) {
		if (shouldSendSentry('aircraft_db_proxy_exception')) {
			Sentry.captureException(error, {
				tags: { area: 'aircraft-db-proxy' },
				extra: { url: upstreamUrl }
			});
		}
		return new Response(`Proxy fetch failed: ${error?.message ?? 'unknown error'}`, { status: 502 });
	}
}
