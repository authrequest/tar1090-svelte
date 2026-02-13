// planeEngine.svelte.js - Lane A: Hot path
// Framework-agnostic mutable store for high-frequency aircraft updates
// Uses Svelte 5 runes ONLY for batch update notification

import { PlaneObject } from './PlaneObject.js';

// Plain mutable state (NOT reactive)
const planes = new Map();
const planesOrdered = [];

// Single reactive tick for UI notification
let updateTick = $state(0);

// Track statistics
let stats = {
	total: 0,
	withPositions: 0,
	messageRate: 0,
	lastUpdate: 0
};

export const planeEngine = {
	// Direct access to mutable state (Lane A)
	planes,
	planesOrdered,
	
	// Read-only reactive accessor for UI
	get tick() { return updateTick; },
	get stats() { return stats; },
	
	/**
	 * Batch update aircraft from fetch data
	 * This is the HOT PATH - must be fast, no reactivity overhead
	 */
	updateBatch(aircraftArray) {
		let newCount = 0;
		let updatedCount = 0;
		
		for (const ac of aircraftArray) {
			const hex = ac.hex;
			if (!hex) continue;
			
			let plane = planes.get(hex);
			
			if (!plane) {
				// Create new plane
				plane = new PlaneObject(hex);
				plane.onMetadataUpdate = () => {
					updateTick++;
				};
				planes.set(hex, plane);
				planesOrdered.push(plane);
				newCount++;
			} else {
				updatedCount++;
			}
			
			// Direct mutation - no reactivity overhead
			plane.updateData(ac);
		}
		
		// Update stats
		stats.total = planes.size;
		stats.withPositions = planesOrdered.filter(p => p.lat !== null).length;
		stats.lastUpdate = Date.now();
		
		// Single reactive notification after entire batch
		updateTick++;
		
		return { new: newCount, updated: updatedCount };
	},
	
	/**
	 * Get plane by ICAO hex
	 */
	get(hex) {
		return planes.get(hex);
	},
	
	/**
	 * Check if plane exists
	 */
	has(hex) {
		return planes.has(hex);
	},
	
	/**
	 * Remove stale aircraft
	 */
	reapStale(maxAgeSeconds = 480) {
		const now = Date.now();
		const toRemove = [];
		
		for (const [hex, plane] of planes) {
			if ((now - plane.lastUpdate) / 1000 > maxAgeSeconds) {
				toRemove.push(hex);
			}
		}
		
		for (const hex of toRemove) {
			planes.delete(hex);
			const idx = planesOrdered.findIndex(p => p.icao === hex);
			if (idx >= 0) planesOrdered.splice(idx, 1);
		}
		
		if (toRemove.length > 0) {
			stats.total = planes.size;
			updateTick++;
		}
		
		return toRemove.length;
	},
	
	/**
	 * Get visible planes in bounds
	 */
	getInBounds(extent) {
		// extent = [minLon, minLat, maxLon, maxLat]
		const [minLon, minLat, maxLon, maxLat] = extent;
		return planesOrdered.filter(p => {
			if (p.lon === null || p.lat === null) return false;
			return p.lon >= minLon && p.lon <= maxLon && 
			       p.lat >= minLat && p.lat <= maxLat;
		});
	},
	
	/**
	 * Get planes matching filter criteria
	 * Used for table filtering
	 */
	getFiltered(filters) {
		return planesOrdered.filter(p => p.matchesFilter(filters));
	},
	
	/**
	 * Clear all planes (for reset)
	 */
	clear() {
		planes.clear();
		planesOrdered.length = 0;
		stats.total = 0;
		stats.withPositions = 0;
		updateTick++;
	}
};

// For debugging
if (typeof window !== 'undefined') {
	window.planeEngine = planeEngine;
}
