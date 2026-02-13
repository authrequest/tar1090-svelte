// zstdDecoder.js - ES Module facade for tar1090 custom zstd decoder
// Wraps the global zstddec library loaded from /vendor/zstddec-tar1090-0.0.5.js

import * as Sentry from '@sentry/sveltekit';

let decoder = null;
let initPromise = null;
let isEnabled = false;
let initErrorCaptured = false;

/**
 * Initialize the ZSTD decoder
 * Loads the script if not already loaded, then initializes the WASM decoder
 * @returns {Promise<void>}
 */
export async function initZstdDecoder() {
	if (isEnabled) return;
	if (initPromise) return initPromise;

	initPromise = new Promise(async (resolve, reject) => {
		try {
			// Check if WebAssembly is supported
			if (typeof WebAssembly === 'undefined') {
				console.warn('[ZSTD] WebAssembly not supported, zstd disabled');
				resolve();
				return;
			}

			// Load the script if not already loaded
			if (typeof zstddec === 'undefined') {
				await loadScript('/vendor/zstddec-tar1090-0.0.5.js');
			}

			// Initialize the decoder
			decoder = new zstddec.ZSTDDecoder();
			await decoder.init();
			
			isEnabled = true;
			console.log('[ZSTD] Decoder initialized successfully');
			resolve();
		} catch (error) {
			console.warn('[ZSTD] Failed to initialize:', error);
			if (!initErrorCaptured) {
				initErrorCaptured = true;
				Sentry.captureException(error, {
					tags: { area: 'zstd', phase: 'init' }
				});
			}
			isEnabled = false;
			resolve(); // Resolve anyway, fallback to non-zstd mode
		}
	});

	return initPromise;
}

/**
 * Decode zstd compressed data
 * @param {Uint8Array} compressedData - The compressed data
 * @param {number} uncompressedSize - Optional known uncompressed size (0 = auto-detect)
 * @returns {Uint8Array} - Decompressed data
 * @throws {Error} - If decoder not initialized or decompression fails
 */
export function decodeZstd(compressedData, uncompressedSize = 0) {
	if (!isEnabled || !decoder) {
		throw new Error('ZSTD decoder not initialized. Call initZstdDecoder() first.');
	}
	return decoder.decode(compressedData, uncompressedSize);
}

/**
 * Check if zstd is enabled and ready
 * @returns {boolean}
 */
export function isZstdReady() {
	return isEnabled;
}

/**
 * Get the raw decoder instance (for advanced usage)
 * @returns {ZSTDDecoder|null}
 */
export function getDecoder() {
	return decoder;
}

/**
 * Load a script dynamically
 * @param {string} src - Script URL
 * @returns {Promise<void>}
 */
function loadScript(src) {
	return new Promise((resolve, reject) => {
		// Check if already loading
		const existing = document.querySelector(`script[src="${src}"]`);
		if (existing) {
			existing.addEventListener('load', resolve);
			existing.addEventListener('error', reject);
			return;
		}

		const script = document.createElement('script');
		script.src = src;
		script.async = true;
		script.onload = resolve;
		script.onerror = reject;
		document.head.appendChild(script);
	});
}

// Global error handler for WebAssembly failures (matching upstream behavior)
if (typeof window !== 'undefined') {
	window.webAssemblyFail = function(error) {
		console.error('[ZSTD] WebAssembly initialization failed:', error);
		if (!initErrorCaptured) {
			initErrorCaptured = true;
			Sentry.captureException(error, {
				tags: { area: 'zstd', phase: 'webassembly' }
			});
		}
		isEnabled = false;
	};
}
