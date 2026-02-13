// configLoader.js - Loads and applies config.js settings
// Simplified version using direct parsing instead of new Function()

import { uiState } from './uiState.svelte.js';

// Default configuration values (same as original tar1090 defaults.js)
const defaultConfig = {
	// Display
	DisplayUnits: 'nautical',
	
	// Map
	DefaultZoomLvl: 9,
	DefaultCenterLat: 45.0,
	DefaultCenterLon: 9.0,
	SiteShow: true,
	SiteName: 'My Radar Site',
	MapType_tar1090: 'osm',
	MapDim: true,
	mapDimPercentage: 0.45,
	
	// Range rings
	SiteCircles: true,
	SiteCirclesDistances: [100, 150, 200, 250],
	SiteCirclesColors: ['#FF0000', '#0000FF', '#00FF00'],
	
	// Markers
	webglIconOpacity: 1.0,
	markerZoomDivide: 8.5,
	markerSmall: 1,
	markerBig: 1.18,
	OutlineADSBColor: '#000000',
	outlineWidth: 1,
	
	// API Keys
	BingMapsAPIKey: null,
	MapboxAPIKey: null,
	
	// Page
	PageName: 'tar1090',
	ShowFlags: true,
	PlaneCountInTitle: false,
	MessageRateInTitle: false,
	utcTimesLive: false,
	utcTimesHistoric: true,
	
	// Features
	positionFilter: true,
	altitudeFilter: true,
	mlatTimeout: 30,
	enableMouseover: true,
	tempTrails: false,
	tempTrailsTimeout: 90,
	showPictures: true,
	planespottersAPI: true
};

// Config object that will hold the loaded values
let configValues = { ...defaultConfig };

/**
 * Parse a value from config.js string
 * Handles strings, numbers, booleans, arrays, and null
 */
function parseValue(valueStr) {
	const trimmed = valueStr.trim();
	
	// Handle null
	if (trimmed === 'null') return null;
	
	// Handle booleans
	if (trimmed === 'true') return true;
	if (trimmed === 'false') return false;
	
	// Handle strings (single or double quotes)
	if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
	    (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
		return trimmed.slice(1, -1);
	}
	
	// Handle arrays
	if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
		try {
			// Simple array parsing - split by comma and parse each element
			const inner = trimmed.slice(1, -1);
			if (!inner.trim()) return [];
			return inner.split(',').map(item => parseValue(item.trim()));
		} catch (e) {
			return [];
		}
	}
	
	// Handle numbers
	if (/^-?\d+\.?\d*$/.test(trimmed)) {
		return parseFloat(trimmed);
	}
	
	// Return as string if nothing else matches
	return trimmed;
}

/**
 * Parse config.js content
 * Looks for patterns like: VariableName = value;
 */
function parseConfigText(configText) {
	const parsed = {};
	const lines = configText.split('\n');
	
	for (const line of lines) {
		const trimmed = line.trim();
		
		// Skip comments and empty lines
		if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
			continue;
		}
		
		// Match variable assignment pattern: Name = value;
		// Allow for various formats: Name=value; Name = value; etc.
		const match = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.+?);?\s*$/);
		if (match) {
			const [, name, valueStr] = match;
			// Remove trailing semicolon if present
			const cleanValue = valueStr.replace(/;\s*$/, '');
			parsed[name] = parseValue(cleanValue);
		}
	}
	
	return parsed;
}

// Load config.js file
export async function loadConfig() {
	try {
		// Try to load config.js
		const response = await fetch('/config.js');
		if (response.ok) {
			const configText = await response.text();
			
			// Parse the config text
			const parsedConfig = parseConfigText(configText);
			
			// Merge with defaults (only override defined values)
			Object.keys(defaultConfig).forEach(key => {
				if (parsedConfig[key] !== undefined) {
					configValues[key] = parsedConfig[key];
				}
			});
			
			console.log('[Config] Loaded config.js successfully');
			
			// Apply config to uiState
			applyConfigToUIState();
			
			return configValues;
		} else {
			console.log('[Config] No config.js found, using defaults');
			applyConfigToUIState();
			return configValues;
		}
	} catch (error) {
		console.warn('[Config] Error loading config.js:', error);
		console.log('[Config] Using default configuration');
		applyConfigToUIState();
		return configValues;
	}
}

// Apply loaded config to uiState.settings
function applyConfigToUIState() {
	// Map DisplayUnits to uiState.settings.units
	if (configValues.DisplayUnits) {
		uiState.settings.units = configValues.DisplayUnits;
	}
	
	// Map MapType_tar1090 to uiState.settings.mapType
	if (configValues.MapType_tar1090) {
		uiState.settings.mapType = configValues.MapType_tar1090;
	}
	
	// Map MapDim settings
	if (configValues.MapDim !== undefined) {
		uiState.settings.dimMap = configValues.MapDim;
	}
	if (configValues.mapDimPercentage !== undefined) {
		uiState.settings.dimPercentage = configValues.mapDimPercentage;
	}
	
	// Map SiteShow to showRangeRings (as range rings show site)
	if (configValues.SiteShow !== undefined) {
		uiState.settings.showRangeRings = configValues.SiteShow;
	}
	
	// Map feature toggles
	if (configValues.ShowFlags !== undefined) {
		uiState.settings.showLabels = configValues.ShowFlags;
	}
	
	console.log('[Config] Applied configuration to UI state');
}

// Get config value
export function getConfig(key) {
	return configValues[key];
}

// Get all config values
export function getAllConfig() {
	return { ...configValues };
}

// Export default config for reference
export { defaultConfig };
