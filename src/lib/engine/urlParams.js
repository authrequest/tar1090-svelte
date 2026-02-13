// urlParams.js - URL parameter parsing and application
// Supports: ?icao=XXXXXX, ?zoom=10, ?lat=xx&lon=xx, ?pTracks

import { replaceState } from '$app/navigation';
import { uiState } from '../stores/uiState.svelte.js';
import { planeEngine } from '../engine/planeEngine.svelte.js';
import { deriveHeatmapSettings } from './heatmapConfig.js';

/**
 * Parse URL search parameters
 * @returns {Object} Parsed parameters
 */
export function parseUrlParams() {
	const params = new URLSearchParams(window.location.search);
	const sortByRaw = params.get('sortBy') || null;
	
	return {
		// Aircraft selection
		icao: params.get('icao')?.toUpperCase() || null,
		
		// Map view
		zoom: params.has('zoom') ? parseInt(params.get('zoom'), 10) : null,
		lat: params.has('lat') ? parseFloat(params.get('lat')) : null,
		lon: params.has('lon') ? parseFloat(params.get('lon')) : null,
		mapOrientation: params.has('mapOrientation') ? parseFloat(params.get('mapOrientation')) : null,
		centerReceiver: params.has('centerReceiver'),
		lockDotCentered: params.has('lockDotCentered'),
		autoselect: params.has('autoselect'),
		
		// Display options
		pTracks: params.has('pTracks'),
		pTracksInterval: params.has('pTracksInterval') 
			? parseInt(params.get('pTracksInterval'), 10) 
			: 15, // Default interval
		
		// Heatmap
		heatmap: params.has('heatmap') 
			? parseInt(params.get('heatmap'), 10) 
			: null,
		realHeat: params.has('realHeat'),
		heatDuration: params.has('heatDuration')
			? parseFloat(params.get('heatDuration'))
			: null,
		heatEnd: params.has('heatEnd')
			? parseFloat(params.get('heatEnd'))
			: null,
		heatRadius: params.has('heatRadius')
			? parseFloat(params.get('heatRadius'))
			: null,
		heatAlpha: params.has('heatAlpha')
			? parseFloat(params.get('heatAlpha'))
			: null,
		heatBlur: params.has('heatBlur')
			? parseFloat(params.get('heatBlur'))
			: null,
		heatWeight: params.has('heatWeight')
			? parseFloat(params.get('heatWeight'))
			: null,
		heatLines: params.has('heatLines'),
		heatFilters: params.has('heatfilters') || params.has('heatFilters'),
		heatManualRedraw: params.has('heatManualRedraw'),
		
		// Filters
		filter: params.get('filter') || null,
		filterCallSign: params.get('filterCallSign') || null,
		filterType: params.get('filterType') || null,
		filterDescription: params.get('filterDescription') || null,
		filterIcao: params.get('filterIcao') || null,
		filterDbFlag: params.has('filterDbFlag') ? params.get('filterDbFlag') : null,
		filterSources: params.has('filterSources') ? params.get('filterSources') : null,
		sortBy: sortByRaw,
		sortByReverse: params.has('sortByReverse')
			? ['1', 'true', 'yes'].includes(String(params.get('sortByReverse')).toLowerCase())
			: false,
		hideCol: params.has('hideCol') ? params.get('hideCol') : null,
		columnOrder: params.has('columnOrder') ? params.get('columnOrder') : null,
		altitudeMin: (params.has('altitudeMin') || params.has('filterAltMin'))
			? parseInt(params.get('altitudeMin') ?? params.get('filterAltMin'), 10)
			: null,
		altitudeMax: (params.has('altitudeMax') || params.has('filterAltMax'))
			? parseInt(params.get('altitudeMax') ?? params.get('filterAltMax'), 10)
			: null,
		legacySortBy: sortByRaw,
		legacyNoSort: sortByRaw !== null && String(sortByRaw).toLowerCase() === 'nosort',
		legacySortByReverseParam: params.has('sortByReverse'),
		legacyFilterAltMin: params.has('filterAltMin')
			? parseInt(params.get('filterAltMin'), 10)
			: null,
		legacyFilterAltMax: params.has('filterAltMax')
			? parseInt(params.get('filterAltMax'), 10)
			: null,
		
		// Other
		labelZoom: params.has('labelZoom') 
			? parseInt(params.get('labelZoom'), 10) 
			: null
	};
}

function normalizeSortBy(sortBy) {
	if (!sortBy) return null;
	const key = String(sortBy).trim();
	if (!key) return null;
	const normalized = key.toLowerCase();
	const mapping = {
		icao: 'icao',
		flag: 'flag',
		flight: 'callsign',
		registration: 'registration',
		aircraft_type: 'icaoType',
		type: 'icaoType',
		squawk: 'squawk',
		altitude: 'altitude',
		speed: 'speed',
		vert_rate: 'vertRate',
		distance: 'siteDist',
		sitedist: 'siteDist',
		track: 'track',
		msgs: 'messages',
		seen: 'seen',
		rssi: 'rssi',
		lat: 'lat',
		lon: 'lon',
		data_source: 'source',
		military: 'military',
		ws: 'ws',
		wd: 'wd',
		nosort: 'noSort'
	};
	return mapping[normalized] || key;
}

/**
 * Apply URL parameters to application state
 * @param {Object} params - Parsed URL parameters
 * @param {Object} options - Application options
 * @returns {Object} Initial view state for map
 */
export function applyUrlParams(params, options = {}) {
	const viewState = {};
	
	// Apply aircraft selection
	if (params.icao) {
		uiState.selectedIcao = params.icao;
		uiState.followSelected = true;
		
		// Try to find plane and center on it when available
		const plane = planeEngine.get(params.icao);
		if (plane && plane.lat !== null && plane.lon !== null) {
			viewState.center = [plane.lon, plane.lat];
			viewState.followPlane = plane;
		}
	}
	
	// Apply map center (overrides plane center if both specified)
	if (params.lat !== null && params.lon !== null) {
		viewState.center = [params.lon, params.lat];
		viewState.followPlane = null; // Don't follow if explicit center
	}
	
	// Apply zoom
	if (params.zoom !== null && !isNaN(params.zoom)) {
		viewState.zoom = Math.max(1, Math.min(20, params.zoom));
	} else if (params.icao) {
		// Default zoom for aircraft selection
		viewState.zoom = 12;
	}

	if (params.mapOrientation !== null && Number.isFinite(params.mapOrientation)) {
		const normalized = ((params.mapOrientation % 360) + 360) % 360;
		uiState.mapOrientation = normalized;
		viewState.rotation = normalized * (Math.PI / 180);
	}

	uiState.centerReceiver = params.centerReceiver;
	uiState.lockDotCentered = params.lockDotCentered;
	uiState.autoselect = params.autoselect;
	
	// Apply display options
	if (params.pTracks) {
		uiState.settings.showTrails = true;
		uiState.pTracksMode = true;
		uiState.pTracksInterval = params.pTracksInterval;
	}
	
	if (params.heatmap !== null) {
		const heatmapSettings = deriveHeatmapSettings(params);
		uiState.settings.showHeatmap = true;
		uiState.heatmap = heatmapSettings;
	} else if (params.realHeat) {
		const heatmapSettings = deriveHeatmapSettings(params);
		uiState.settings.showHeatmap = true;
		uiState.heatmap = heatmapSettings;
	} else {
		uiState.heatmap = { enabled: false };
	}
	
	// Apply filters
	if (params.filter) {
		// Parse filter string (e.g., "B737" or "A320|B738")
		uiState.filters.typeFilter = params.filter;
	}

	if (params.filterCallSign) {
		uiState.filters.callsignFilter = params.filterCallSign;
	}

	if (params.filterType) {
		uiState.filters.typeFilter = params.filterType;
	}

	if (params.filterDescription) {
		uiState.filters.descriptionFilter = params.filterDescription;
	}

	if (params.filterIcao) {
		uiState.filters.icaoFilter = params.filterIcao;
	}

	if (params.filterDbFlag) {
		uiState.filters.flagFilter = params.filterDbFlag
			.split(',')
			.map((value) => value.trim())
			.filter(Boolean);
	}

	if (params.filterSources) {
		uiState.filters.sources = params.filterSources
			.split(',')
			.map((value) => value.trim())
			.filter(Boolean);
	}

	if (params.sortBy) {
		uiState.tableSortBy = normalizeSortBy(params.sortBy);
		uiState.tableSortReverse = Boolean(params.sortByReverse);
	}

	if (params.hideCol) {
		uiState.tableHiddenCols = params.hideCol
			.split(',')
			.map((value) => value.trim().replace(/^#/, ''))
			.filter(Boolean);
	}

	if (params.columnOrder) {
		uiState.tableColumnOrder = params.columnOrder
			.split(',')
			.map((value) => value.trim().replace(/^#/, ''))
			.filter(Boolean);
	}
	
	if (params.altitudeMin !== null) {
		uiState.filters.altitudeMin = params.altitudeMin;
	}
	
	if (params.altitudeMax !== null) {
		uiState.filters.altitudeMax = params.altitudeMax;
	}
	
	// Apply label settings
	if (params.labelZoom !== null) {
		uiState.settings.labelZoom = params.labelZoom;
	}
	
	return viewState;
}

/**
 * Update URL with current state (optional - for history tracking)
 * @param {Object} state - Current application state
 */
export function updateUrlParams(state = {}) {
	const params = new URLSearchParams();
	
	// Add selected aircraft
	if (state.selectedIcao) {
		params.set('icao', state.selectedIcao);
	}
	
	// Add map view if different from default
	if (state.zoom && state.zoom !== 9) {
		params.set('zoom', state.zoom);
	}
	
	if (state.center) {
		params.set('lat', state.center[1].toFixed(4));
		params.set('lon', state.center[0].toFixed(4));
	}

	if (state.mapOrientation && Number.isFinite(state.mapOrientation)) {
		params.set('mapOrientation', Number(state.mapOrientation).toFixed(1));
	}

	if (state.centerReceiver) params.set('centerReceiver', '1');
	if (state.lockDotCentered) params.set('lockDotCentered', '1');
	if (state.autoselect) params.set('autoselect', '1');

	if (state.filters?.callsignFilter) params.set('filterCallSign', state.filters.callsignFilter);
	if (state.filters?.typeFilter) params.set('filterType', state.filters.typeFilter);
	if (state.filters?.descriptionFilter) params.set('filterDescription', state.filters.descriptionFilter);
	if (state.filters?.icaoFilter) params.set('filterIcao', state.filters.icaoFilter);
	if (state.filters?.flagFilter?.length) params.set('filterDbFlag', state.filters.flagFilter.join(','));
	if (state.filters?.sources?.length) params.set('filterSources', state.filters.sources.join(','));
	if (state.tableSortBy) {
		const sortBy = state.tableSortBy === 'noSort' ? 'nosort' : state.tableSortBy;
		params.set('sortBy', sortBy);
	}
	if (state.tableSortReverse) params.set('sortByReverse', '1');
	if (state.tableHiddenCols?.length) params.set('hideCol', state.tableHiddenCols.join(','));
	if (state.tableColumnOrder?.length) params.set('columnOrder', state.tableColumnOrder.join(','));
	
	// Build URL
	const queryString = params.toString();
	const newUrl = queryString 
		? `${window.location.pathname}?${queryString}`
		: window.location.pathname;
	
	// Update URL without reloading (defer to avoid router initialization race)
	requestAnimationFrame(() => {
		try {
			replaceState(newUrl, {});
		} catch (e) {
			// Router not ready, will update on next change
		}
	});
}

/**
 * Wait for aircraft to be available
 * @param {string} icao - Aircraft ICAO code
 * @param {number} timeout - Maximum wait time in ms
 * @returns {Promise<Object>} Aircraft object or null
 */
export function waitForAircraft(icao, timeout = 10000) {
	return new Promise((resolve) => {
		// Check if already available
		const plane = planeEngine.get(icao);
		if (plane) {
			resolve(plane);
			return;
		}
		
		// Set up interval to check
		const startTime = Date.now();
		const interval = setInterval(() => {
			const plane = planeEngine.get(icao);
			
			if (plane) {
				clearInterval(interval);
				resolve(plane);
				return;
			}
			
			// Timeout
			if (Date.now() - startTime > timeout) {
				clearInterval(interval);
				resolve(null);
			}
		}, 500);
	});
}
