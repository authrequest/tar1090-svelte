// uiState.svelte.js - Lane B: UI State
// Full Svelte 5 reactivity for UI components

import { planeEngine } from '../engine/planeEngine.svelte.js';

// Main UI state
export const uiState = $state({
	// Selection
	selectedIcao: null,
	highlightedIcao: null,
	selectedPlanes: [],
	
	// Filters
	filters: {
		altitudeMin: null,
		altitudeMax: null,
		militaryOnly: false,
		sources: ['adsb', 'uat', 'adsr', 'mlat', 'tisb', 'modeS', 'adsc', 'other'],
		flagFilter: [],
		callsignFilter: '',
		typeFilter: '',
		descriptionFilter: '',
		icaoFilter: '',
		groundVehicles: false,
		nonIcao: true
	},
	
	// Display settings
	settings: {
		showLabels: true,
		extendedLabels: false,
		showTrackLabels: false,
		showTrails: true,
		showRangeRings: true,
		mapType: 'osm',
		units: 'nautical',
		dimMap: true,
		dimPercentage: 0.45,
		showHeatmap: false
	},
	
	// Heatmap settings
	heatmap: {
		enabled: false
	},
	
	// UI state
	sidebarOpen: true,
	settingsOpen: false,
	filtersOpen: false,
	tableSortBy: 'altitude',
	tableSortReverse: false,
	tableHiddenCols: [],
	tableColumnOrder: [],
	
	// Playback/replay
	isPlaying: false,
	playbackSpeed: 1,
	currentTime: null,
	replay: {
		enabled: false,
		playing: false,
		speed: 30,
		ts: null,
		dateText: null,
		hours: 0,
		minutes: 0,
		seconds: 0,
		loading: false,
		error: null
	},
	
	// Trace
	trace: {
		enabled: false,
		mode: 'auto',
		dateText: null,
		startTime: null,
		endTime: null
	},
	
	// View
	tableOnlyInView: false,
	multiSelect: false,
	followSelected: false,
	autoselect: false,
	centerReceiver: false,
	lockDotCentered: false,
	mapOrientation: 0,
	mapViewBounds: null,
	onlyMilitary: false,
	isolation: false
});

// Derived values as functions (Svelte 5 requirement)
export function getSelectedPlane() {
	return uiState.selectedIcao ? planeEngine.get(uiState.selectedIcao) : null;
}

export function getHighlightedPlane() {
	return uiState.highlightedIcao ? planeEngine.get(uiState.highlightedIcao) : null;
}

function compileFilterRegex(value) {
	if (!value || !String(value).trim()) return null;
	try {
		return new RegExp(String(value).trim(), 'i');
	} catch {
		return null;
	}
}

	export function getVisiblePlanes() {
		const f = uiState.filters;
		const bounds = uiState.mapViewBounds;
		const callsignRegex = compileFilterRegex(f.callsignFilter);
		const typeRegex = compileFilterRegex(f.typeFilter);
		const descriptionRegex = compileFilterRegex(f.descriptionFilter);
		const icaoRegex = compileFilterRegex(f.icaoFilter);
		return planeEngine.planesOrdered.filter(p => {
			if (p.source && !f.sources.includes(p.source)) return false;
			if (f.militaryOnly && !p.military) return false;
			if (Array.isArray(f.flagFilter) && f.flagFilter.length > 0) {
				const matchFlag = f.flagFilter.some((flag) => {
					if (flag === 'military') return Boolean(p.military);
					if (flag === 'pia') return Boolean(p.pia);
					if (flag === 'ladd') return Boolean(p.ladd);
					return false;
				});
				if (!matchFlag) return false;
			}
			if (f.altitudeMin !== null && p.altitude !== null && p.altitude < f.altitudeMin) return false;
			if (f.altitudeMax !== null && p.altitude !== null && p.altitude > f.altitudeMax) return false;
			if (callsignRegex && !callsignRegex.test(p.callsign || '')) return false;
			if (typeRegex && !typeRegex.test(`${p.icaoType || ''} ${p.typeDescription || ''}`)) return false;
			if (descriptionRegex && !descriptionRegex.test(`${p.typeDescription || ''} ${p.typeLong || ''}`)) return false;
			if (icaoRegex && !icaoRegex.test(p.icao || '')) return false;
			if (!f.groundVehicles && p.groundVehicle) return false;
			if (!f.nonIcao && p.fakeHex) return false;
			if (uiState.tableOnlyInView) {
				if (!bounds || p.lon === null || p.lat === null) return false;
				if (p.lat < bounds.minLat || p.lat > bounds.maxLat) return false;
				if (!bounds.crossesDateline) {
					if (p.lon < bounds.minLon || p.lon > bounds.maxLon) return false;
				} else {
					const inLeft = p.lon >= bounds.minLon && p.lon <= 180;
					const inRight = p.lon >= -180 && p.lon <= bounds.maxLon;
					if (!inLeft && !inRight) return false;
				}
			}
		return true;
	});
}

export function getPlaneStats() {
	return {
		total: planeEngine.stats.total,
		withPositions: planeEngine.stats.withPositions,
		visible: getVisiblePlanes().length,
		selected: uiState.selectedIcao ? 1 : 0,
		messageRate: planeEngine.stats.messageRate
	};
}

// Actions
export const uiActions = {
	selectPlane(icao) {
		if (uiState.multiSelect) {
			const idx = uiState.selectedPlanes.indexOf(icao);
			if (idx >= 0) {
				uiState.selectedPlanes.splice(idx, 1);
			} else {
				uiState.selectedPlanes.push(icao);
			}
			uiState.selectedIcao = icao;
		} else {
			uiState.selectedIcao = uiState.selectedIcao === icao ? null : icao;
			uiState.selectedPlanes = uiState.selectedIcao ? [icao] : [];
		}
	},
	
	highlightPlane(icao) {
		uiState.highlightedIcao = icao;
	},
	
	clearSelection() {
		uiState.selectedIcao = null;
		uiState.highlightedIcao = null;
		uiState.selectedPlanes = [];
	},
	
	selectAll() {
		uiState.selectedPlanes = getVisiblePlanes().map(p => p.icao);
		if (uiState.selectedPlanes.length > 0) {
			uiState.selectedIcao = uiState.selectedPlanes[0];
		}
	},
	
	resetFilters() {
		uiState.filters = {
			altitudeMin: null,
			altitudeMax: null,
			militaryOnly: false,
			sources: ['adsb', 'uat', 'adsr', 'mlat', 'tisb', 'modeS', 'adsc', 'other'],
			flagFilter: [],
			callsignFilter: '',
			typeFilter: '',
			descriptionFilter: '',
			icaoFilter: '',
			groundVehicles: false,
			nonIcao: true
		};
	},
	
	toggleSidebar() {
		uiState.sidebarOpen = !uiState.sidebarOpen;
	},
	
	toggleSetting(key) {
		uiState.settings[key] = !uiState.settings[key];
	}
};
