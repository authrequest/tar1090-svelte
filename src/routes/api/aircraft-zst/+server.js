import * as Sentry from '@sentry/sveltekit';
import { env } from '$env/dynamic/private';

const REMOTE_ZST_URL = env.AIRCRAFT_ZST_REMOTE_URL || 'http://192.168.1.56/tar1090/data/aircraft.binCraft.zst';
const SENTRY_THROTTLE_MS = 60_000;
const sentryThrottle = new Map();

function shouldSendSentry(key) {
	const now = Date.now();
	const last = sentryThrottle.get(key) ?? 0;
	if (now - last < SENTRY_THROTTLE_MS) return false;
	sentryThrottle.set(key, now);
	return true;
}

export async function GET({ fetch }) {
	try {
		const upstream = await fetch(REMOTE_ZST_URL, {
			method: 'GET',
			headers: { Accept: 'application/octet-stream' },
			cache: 'no-store'
		});

		if (!upstream.ok) {
			if (shouldSendSentry('proxy_upstream_non_ok')) {
				Sentry.captureMessage('aircraft-zst upstream non-OK response', {
					level: 'warning',
					tags: { area: 'aircraft-zst-proxy' },
					extra: { url: REMOTE_ZST_URL, status: upstream.status }
				});
			}
			return new Response(`Upstream error: HTTP ${upstream.status}`, {
				status: 502
			});
		}

		const body = await upstream.arrayBuffer();
		return new Response(body, {
			status: 200,
			headers: {
				'content-type': 'application/octet-stream',
				'cache-control': 'no-store'
			}
		});
	} catch (error) {
		if (shouldSendSentry('proxy_fetch_exception')) {
			Sentry.captureException(error, {
				tags: { area: 'aircraft-zst-proxy' },
				extra: { url: REMOTE_ZST_URL }
			});
		}
		return new Response(`Proxy fetch failed: ${error?.message ?? 'unknown error'}`, {
			status: 502
		});
	}
}
