// fetcher.js - Data fetching from readsb/dump1090
// Ported from tar1090 html/script.js fetch logic

import { planeEngine } from './planeEngine.svelte.js';
import { initZstdDecoder, isZstdReady, decodeZstd } from './zstdDecoder.js';
import { parseBinCraft } from './binCraftParser.js';
import { loadTypeCache } from './aircraftDbLoader.js';
import * as Sentry from '@sentry/sveltekit';

const DEFAULT_INTERVAL = 1000; // 1 second
const SENTRY_THROTTLE_MS = 60_000;
const sentryThrottle = new Map();

function captureThrottled(key, error, context = {}) {
	const now = Date.now();
	const last = sentryThrottle.get(key) ?? 0;
	if (now - last < SENTRY_THROTTLE_MS) return;
	sentryThrottle.set(key, now);
	Sentry.captureException(error, {
		tags: { area: 'fetcher', key },
		extra: context
	});
}

export function resolveRefreshInterval(receiverData, fallback = DEFAULT_INTERVAL) {
	const refresh = receiverData?.refresh;
	const value = typeof refresh === 'number' ? refresh : parseFloat(refresh);
	if (!Number.isFinite(value) || value <= 0) return fallback;
	return Math.round(value);
}

export function deriveReceiverMeta(receiverData = {}) {
	const versionRaw =
		typeof receiverData.version === 'string' ? receiverData.version
		: typeof receiverData.readsb_version === 'string' ? receiverData.readsb_version
		: typeof receiverData.decoderVersion === 'string' ? receiverData.decoderVersion
		: typeof receiverData.dump1090_version === 'string' ? receiverData.dump1090_version
		: '';

	const versionMatch = versionRaw.match(/\d+\.\d+\.\d+(?:\.\d+)?/);
	const version = versionMatch ? versionMatch[0] : 'n/a';

	const decoder =
		typeof receiverData.decoder === 'string' ? receiverData.decoder
		: receiverData.readsb ? 'readsb'
		: receiverData.dump1090fa || receiverData.dump1090_fa ? 'dump1090-fa'
		: receiverData.dump1090 ? 'dump1090'
		: receiverData.wingbits ? 'wingbits'
		: 'unknown';

	const decoderRepoUrl =
		decoder === 'readsb' ? 'https://github.com/wiedehopf/readsb'
		: decoder === 'dump1090-fa' ? 'https://github.com/flightaware/dump1090'
		: decoder === 'dump1090' ? 'https://github.com/antirez/dump1090'
		: decoder === 'wingbits' ? 'https://github.com/wingbits'
		: null;

	return {
		decoder,
		version,
		tar1090RepoUrl: 'https://github.com/wiedehopf/tar1090',
		decoderRepoUrl
	};
}

class DataFetcher {
	url = '/data/aircraft.json';
	legacyUrl = '/aircraft.json';
	receiverUrl = '/data/receiver.json';
	legacyReceiverUrl = '/receiver.json';
	interval = DEFAULT_INTERVAL;
	timer = null;
	lastFetch = 0;
	pending = false;
	receiverPosition = null;
	receiverMeta = {
		decoder: 'unknown',
		version: 'n/a',
		tar1090RepoUrl: 'https://github.com/wiedehopf/tar1090',
		decoderRepoUrl: null
	};
	receiverPending = false;
	
	// ZSTD support
	zstdEnabled = false;
	zstdInitialized = false;
	forceZstdTest = true;
	// Temporary remote zstd URL for testing
	zstdTestUrl = '/api/aircraft-zst';
	
	// Event callbacks
	onUpdate = null;
	onError = null;
	onReceiverPosition = null;
	onReceiverMeta = null;
	
	constructor(options = {}) {
		this.url = options.url || this.url;
		this.legacyUrl = options.legacyUrl || this.legacyUrl;
		this.receiverUrl = options.receiverUrl || this.receiverUrl;
		this.legacyReceiverUrl = options.legacyReceiverUrl || this.legacyReceiverUrl;
		this.interval = options.interval || this.interval;
	}
	
	start() {
		if (this.timer) return;
		void loadTypeCache().catch((error) => {
			captureThrottled('type_cache_load', error, { endpoint: '/api/aircraft-db?typeCache=1' });
		});
		Sentry.addBreadcrumb({
			category: 'fetcher.lifecycle',
			level: 'info',
			message: 'DataFetcher.start',
			data: { interval: this.interval }
		});
		if (this.forceZstdTest && !this.zstdInitialized) {
			this.zstdInitialized = true;
			initZstdDecoder().then(() => {
				this.zstdEnabled = isZstdReady();
				Sentry.addBreadcrumb({
					category: 'fetcher.zstd',
					level: this.zstdEnabled ? 'info' : 'warning',
					message: this.zstdEnabled ? 'Forced ZSTD test mode enabled' : 'Forced ZSTD test mode init failed',
					data: { forceZstdTest: this.forceZstdTest }
				});
				if (!this.zstdEnabled) {
					console.warn('[Fetcher] Forced ZSTD test mode enabled but decoder init failed');
				}
			});
		}
		this.fetchReceiver();
		this.fetch();
		this.timer = setInterval(() => this.fetch(), this.interval);
	}
	
	stop() {
		if (this.timer) {
			clearInterval(this.timer);
			this.timer = null;
			Sentry.addBreadcrumb({
				category: 'fetcher.lifecycle',
				level: 'info',
				message: 'DataFetcher.stop'
			});
		}
	}
	
	updateInterval(nextInterval) {
		if (!Number.isFinite(nextInterval) || nextInterval <= 0) return;
		if (nextInterval === this.interval) return;
		Sentry.addBreadcrumb({
			category: 'fetcher.config',
			level: 'info',
			message: 'Refresh interval updated',
			data: { from: this.interval, to: nextInterval }
		});
		this.interval = nextInterval;
		if (this.timer) {
			clearInterval(this.timer);
			this.timer = setInterval(() => this.fetch(), this.interval);
		}
	}

	async fetch() {
		if (this.pending) return;
		this.pending = true;
		
		try {
			const useZstd = (this.forceZstdTest || this.zstdEnabled) && isZstdReady();
			const suffix = useZstd ? '.binCraft.zst' : '.json';
			const headers = { Accept: useZstd ? 'application/octet-stream' : 'application/json' };

			const primaryUrl = useZstd && this.zstdTestUrl
				? this.zstdTestUrl
				: this.url.replace(/\.json$/, suffix);
			let response = await fetch(primaryUrl, {
				caches: 'no-store',
				headers
			});

			if (!response.ok && useZstd && this.zstdTestUrl) {
				Sentry.addBreadcrumb({
					category: 'fetcher.fallback',
					level: 'warning',
					message: 'ZSTD test URL failed, trying local zstd endpoint',
					data: { status: response.status, primaryUrl }
				});
				const localUrl = this.url.replace(/\.json$/, suffix);
				response = await fetch(localUrl, {
					caches: 'no-store',
					headers
				});
			}

			if (!response.ok && this.url !== this.legacyUrl) {
				const fallbackUrl = this.legacyUrl.replace(/\.json$/, suffix);
				const fallbackResponse = await fetch(fallbackUrl, {
					caches: 'no-store',
					headers
				});
				if (fallbackResponse.ok) {
					Sentry.addBreadcrumb({
						category: 'fetcher.fallback',
						level: 'warning',
						message: 'Primary aircraft endpoint failed, switched to legacy URL',
						data: { fallbackUrl }
					});
					this.url = this.legacyUrl;
					response = fallbackResponse;
				}
			}

			if (!response.ok) throw new Error(`HTTP ${response.status}`);

			let data;
			if (useZstd) {
				const arrayBuffer = await response.arrayBuffer();
				try {
					const compressed = new Uint8Array(arrayBuffer);
					const decompressed = decodeZstd(compressed, 0);
					const normalized = decompressed.buffer.slice(
						decompressed.byteOffset,
						decompressed.byteOffset + decompressed.byteLength
					);
					data = parseBinCraft(normalized);
				} catch (error) {
					console.warn('[Fetcher] ZSTD decode failed, disabling zstd mode:', error);
					captureThrottled('zstd_decode_failed', error, {
						url: primaryUrl,
						byteLength: arrayBuffer?.byteLength ?? 0
					});
					this.zstdEnabled = false;
					throw error;
				}
			} else {
				data = await response.json();
			}

			this.processData(data);
			
			this.lastFetch = Date.now();
			this.onUpdate?.(data);
		} catch (error) {
			if (error?.name !== 'AbortError') {
				captureThrottled('aircraft_fetch_failed', error, {
					url: this.url,
					legacyUrl: this.legacyUrl,
					zstdEnabled: this.zstdEnabled,
					forceZstdTest: this.forceZstdTest
				});
			}
			console.error('Fetch error:', error);
			this.onError?.(error);
		} finally {
			this.pending = false;
		}
	}

	async fetchReceiver() {
		if (this.receiverPending || this.receiverPosition) return;
		this.receiverPending = true;
		
		try {
			let response = await fetch(this.receiverUrl, {
				caches: 'no-store',
				headers: { 'Accept': 'application/json' }
			});

			if (!response.ok && this.receiverUrl !== this.legacyReceiverUrl) {
				const fallbackResponse = await fetch(this.legacyReceiverUrl, {
					caches: 'no-store',
					headers: { 'Accept': 'application/json' }
				});
				if (fallbackResponse.ok) {
					Sentry.addBreadcrumb({
						category: 'fetcher.fallback',
						level: 'warning',
						message: 'Primary receiver endpoint failed, switched to legacy URL',
						data: { receiverUrl: this.receiverUrl, legacyReceiverUrl: this.legacyReceiverUrl }
					});
					this.receiverUrl = this.legacyReceiverUrl;
					response = fallbackResponse;
				}
			}

			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			
			const data = await response.json();
			const refreshMs = resolveRefreshInterval(data, this.interval);
			this.updateInterval(refreshMs);
			this.receiverMeta = deriveReceiverMeta(data);
			this.onReceiverMeta?.(this.receiverMeta);

			// Check for ZSTD support and initialize decoder
			if (data.zstd && !this.zstdInitialized) {
				this.zstdInitialized = true;
				try {
					await initZstdDecoder();
					this.zstdEnabled = isZstdReady();
					if (this.zstdEnabled) {
						console.log('[Fetcher] ZSTD compression enabled');
					}
				} catch (e) {
					console.warn('[Fetcher] Failed to initialize ZSTD:', e);
					captureThrottled('zstd_init_failed', e, {
						receiverUrl: this.receiverUrl,
						zstdAdvertised: data.zstd
					});
					this.zstdEnabled = false;
				}
			}

			const lat = data?.lat ?? null;
			const lon = data?.lon ?? null;
			
			if (lat !== null && lon !== null) {
				const parsedLat = parseFloat(lat);
				const parsedLon = parseFloat(lon);
				if (!Number.isNaN(parsedLat) && !Number.isNaN(parsedLon)) {
					this.receiverPosition = { lat: parsedLat, lon: parsedLon };
					this.onReceiverPosition?.(parsedLat, parsedLon);
				}
			}
		} catch (error) {
			captureThrottled('receiver_fetch_failed', error, {
				receiverUrl: this.receiverUrl,
				legacyReceiverUrl: this.legacyReceiverUrl
			});
			console.warn('Receiver fetch error:', error);
		} finally {
			this.receiverPending = false;
		}
	}
	
	processData(data) {
		if (!data || !Array.isArray(data.aircraft)) return;
		
		// Update plane engine with batch
		const result = planeEngine.updateBatch(data.aircraft);
		
		// Update message rate if available
		if (data.messages) {
			planeEngine.stats.messageRate = data.messages;
		}
		
		// Reap stale aircraft every fetch (remove planes not seen for 2+ minutes)
		planeEngine.reapStale(120);
		
		return result;
	}
}

// Singleton instance
export const fetcher = new DataFetcher();
export default DataFetcher;

// For testing with mock data
export function createMockFetcher(mockData) {
	const mockFetcher = new DataFetcher();
	mockFetcher.fetch = async () => {
		mockFetcher.processData(mockData);
		mockFetcher.onUpdate?.(mockData);
	};
	return mockFetcher;
}
