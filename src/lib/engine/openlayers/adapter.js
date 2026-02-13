// adapter.js - OpenLayers integration
// Bridges imperative OpenLayers with Svelte reactive state

import { Map as OlMap, View } from 'ol';
import { fromLonLat, toLonLat, transformExtent } from 'ol/proj';
import { Tile as TileLayer, Vector as VectorLayer } from 'ol/layer';
import { OSM, Vector as VectorSource } from 'ol/source';
import { Style, Circle, Fill, Stroke, Icon, Text } from 'ol/style';
import { Feature } from 'ol';
import { Point, LineString } from 'ol/geom';
import { circular } from 'ol/geom/Polygon';
import { planeEngine } from '../planeEngine.svelte.js';
import { createIconStyle } from '../iconManager.js';

// Default center (will be overridden by receiver position)
const DEFAULT_CENTER = [-74.006, 40.7128]; // NYC
const DEFAULT_ZOOM = 9;

export function getDefaultCenter() {
	return [...DEFAULT_CENTER];
}

/**
 * Create OpenLayers map instance
 */
	export function createMap(target) {
		const map = new OlMap({
			target,
			controls: [],
			layers: [
				new TileLayer({
					source: new OSM()
			})
		],
		view: new View({
			center: fromLonLat(DEFAULT_CENTER),
			zoom: DEFAULT_ZOOM
		})
	});
	
	return map;
}

/**
 * Create aircraft marker layer
 */
export function createAircraftLayer() {
	const source = new VectorSource();
	
	const layer = new VectorLayer({
		source,
		style: (feature) => {
			const isSelected = feature.get('selected');
			const isHighlighted = feature.get('highlighted');
			
			return new Style({
				image: new Circle({
					radius: isSelected ? 10 : isHighlighted ? 8 : 6,
					fill: new Fill({
						color: isSelected ? '#ff0000' : isHighlighted ? '#00ff00' : '#0066cc'
					}),
					stroke: new Stroke({
						color: '#ffffff',
						width: 2
					})
				})
			});
		}
	});
	
	return { layer, source };
}

/**
 * Update aircraft features from plane engine
 * This is called when planeEngine.tick changes
 */
export function updateAircraftFeatures(source, planes, options = {}) {
	// Defensive: ensure source and planes are valid
	if (!source || typeof source.forEachFeature !== 'function') {
		console.warn('[updateAircraftFeatures] Invalid source provided', source);
		return;
	}
	if (!planes) {
		console.warn('[updateAircraftFeatures] Invalid planes provided', planes);
		return;
	}

	const planeIterable = planes instanceof Map
		? planes.values()
		: Array.isArray(planes)
			? planes
			: null;

	if (!planeIterable) {
		console.warn('[updateAircraftFeatures] Unsupported planes container', planes);
		return;
	}

	const { selectedIcao, highlightedIcao } = options;

	// Get current features
	const existingFeatures = new Map();
	source.forEachFeature((feature) => {
		existingFeatures.set(feature.get('icao'), feature);
	});
	
	// Track which features to keep
	const keptFeatures = new Set();
	
	// Update or create features
	for (const plane of planeIterable) {
		if (plane.lon === null || plane.lat === null) continue;
		
		let feature = existingFeatures.get(plane.icao);
		const isSelected = plane.icao === selectedIcao;
		const isHighlighted = plane.icao === highlightedIcao;
		
		if (!feature) {
			// Create new feature
			feature = new Feature({
				geometry: new Point(fromLonLat([plane.lon, plane.lat])),
				icao: plane.icao,
				altitude: plane.altitude,
				speed: plane.speed,
				plane: plane
			});
			
			// Set icon style
			const iconOptions = createIconStyle(plane);
			feature.setStyle(new Style({
				image: new Icon(iconOptions)
			}));
			
			source.addFeature(feature);
		} else {
			// Update existing feature geometry
			feature.setGeometry(new Point(fromLonLat([plane.lon, plane.lat])));
			
			// Update icon if selection changed
			const iconOptions = createIconStyle(plane);
			feature.setStyle(new Style({
				image: new Icon(iconOptions)
			}));
		}
		
		// Update visual state
		feature.set('selected', isSelected);
		feature.set('highlighted', isHighlighted);
		feature.set('altitude', plane.altitude);
		feature.set('speed', plane.speed);
		
		keptFeatures.add(plane.icao);
	}
	
	// Remove stale features
	for (const [icao, feature] of existingFeatures.entries()) {
		if (!keptFeatures.has(icao)) {
			source.removeFeature(feature);
		}
	}
}

/**
 * Create trail/history layer
 */
export function createTrailLayer() {
	const source = new VectorSource();
	
	const layer = new VectorLayer({
		source,
		style: (feature) => {
			const altitude = feature.get('altitude');
			const isSelected = feature.get('isSelected');
			
			// Color based on altitude if available
			let color = 'rgba(0, 102, 204, 0.6)'; // Default blue
			if (altitude !== null && altitude !== undefined) {
				if (altitude < 1000) color = 'rgba(255, 0, 0, 0.6)';      // Red - low
				else if (altitude < 5000) color = 'rgba(255, 128, 0, 0.6)'; // Orange
				else if (altitude < 10000) color = 'rgba(255, 255, 0, 0.6)'; // Yellow
				else if (altitude < 20000) color = 'rgba(0, 255, 0, 0.6)';   // Green
				else if (altitude < 30000) color = 'rgba(0, 255, 255, 0.6)'; // Cyan
				else color = 'rgba(128, 0, 255, 0.6)';                      // Purple - high
			}
			
			return new Style({
				stroke: new Stroke({
					color: isSelected ? 'rgba(255, 255, 0, 0.9)' : color,
					width: isSelected ? 3 : 2
				})
			});
		}
	});
	
	return { layer, source };
}

/**
 * Update trail features from plane track history
 * @param {VectorSource} source - Trail layer source
 * @param {Map<string, PlaneObject>} planes - Map of plane objects
 * @param {Object} options - Options including selectedIcao and showTrails
 */
export function updateTrailFeatures(source, planes, options = {}) {
	const { selectedIcao, showTrails = true, maxTrailAge = 5 * 60 * 1000 } = options; // 5 minutes default
	
	if (!showTrails) {
		source.clear();
		return;
	}
	
	const now = Date.now();
	const existingFeatures = new Map();
	source.forEachFeature((feature) => {
		const icao = feature.get('icao');
		if (icao) existingFeatures.set(icao, feature);
	});
	
	const keptFeatures = new Set();
	
	for (const plane of planes.values()) {
		if (!plane.visible || plane.lat === null || plane.lon === null) continue;
		
		// Update track history
		plane.updateTrack(50);
		
		const segments = plane.getTrackSegments();
		if (segments.length === 0) continue;
		
		const isSelected = plane.icao === selectedIcao;
		let feature = existingFeatures.get(plane.icao);
		
		// Create line geometry from track segments
		const coordinates = [];
		for (const segment of segments) {
			for (const coord of segment) {
				coordinates.push(fromLonLat(coord));
			}
		}
		
		if (coordinates.length < 2) continue;
		
		if (!feature) {
			feature = new Feature({
				geometry: new LineString(coordinates),
				icao: plane.icao,
				altitude: plane.altitude,
				isSelected: isSelected
			});
			source.addFeature(feature);
		} else {
			feature.setGeometry(new LineString(coordinates));
			feature.set('altitude', plane.altitude);
			feature.set('isSelected', isSelected);
		}
		
		keptFeatures.add(plane.icao);
	}
	
	// Remove trails for planes no longer visible
	for (const [icao, feature] of existingFeatures) {
		if (!keptFeatures.has(icao)) {
			source.removeFeature(feature);
		}
	}
}

/**
 * Fit map to show all aircraft
 */
export function fitToPlanes(map, planes) {
	const features = [];
	for (const plane of planes.values()) {
		if (plane.lon !== null && plane.lat !== null) {
			features.push(new Feature(new Point(fromLonLat([plane.lon, plane.lat]))));
		}
	}
	
	if (features.length === 0) return;
	
	const source = new VectorSource({ features });
	map.getView().fit(source.getExtent(), {
		padding: [50, 50, 50, 50],
		maxZoom: 12
	});
}

/**
 * Center map on specific plane
 */
export function centerOnPlane(map, plane) {
	if (plane.lon === null || plane.lat === null) return;
	
	map.getView().animate({
		center: fromLonLat([plane.lon, plane.lat]),
		duration: 500
	});
}

/**
 * Set map view (center and zoom)
 * @param {Map} map - OpenLayers map instance
 * @param {Object} viewState - View state with center [lon, lat] and zoom
 */
export function setMapView(map, viewState) {
	if (!map || !viewState) return;
	
	const view = map.getView();
	
	if (viewState.center) {
		const center = fromLonLat(viewState.center);
		if (viewState.zoom !== undefined) {
			view.setCenter(center);
			view.setZoom(viewState.zoom);
		} else {
			view.animate({
				center: center,
				duration: 0
			});
		}
	} else if (viewState.zoom !== undefined) {
		view.setZoom(viewState.zoom);
	}

	if (viewState.rotation !== undefined && Number.isFinite(viewState.rotation)) {
		view.setRotation(viewState.rotation);
	}
}

export function getMapCenterLonLat(map) {
	if (!map) return null;
	const center = map.getView().getCenter();
	if (!center) return null;
	return toLonLat(center);
}

export function getMapViewBoundsLonLat(map) {
	if (!map) return null;
	const size = map.getSize();
	if (!size) return null;
	const extent = map.getView().calculateExtent(size);
	if (!extent) return null;

	const [minX, minY, maxX, maxY] = transformExtent(extent, 'EPSG:3857', 'EPSG:4326');
	if (![minX, minY, maxX, maxY].every((v) => Number.isFinite(v))) return null;

	const minLat = Math.max(-90, Math.min(90, minY));
	const maxLat = Math.max(-90, Math.min(90, maxY));
	const minLon = Math.max(-180, Math.min(180, minX));
	const maxLon = Math.max(-180, Math.min(180, maxX));

	return {
		minLon,
		maxLon,
		minLat,
		maxLat,
		crossesDateline: minLon > maxLon
	};
}

/**
 * Get current map view state
 * @param {Map} map - OpenLayers map instance
 * @returns {Object} Current view state { center: [lon, lat], zoom: number }
 */
export function getMapView(map) {
	if (!map) return null;
	
	const view = map.getView();
	const center = view.getCenter();
	const zoom = view.getZoom();
	
	// Convert from projected coordinates to lon/lat
	const lonLat = center ? [center[0], center[1]] : null; // Note: OL uses projected coords, need transform if needed
	
	return {
		center: lonLat,
		zoom: zoom
	};
}

// Default receiver position (will be updated from data)
let receiverPosition = null;

/**
 * Set receiver position for range rings
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 */
export function setReceiverPosition(lat, lon) {
	receiverPosition = { lat, lon };
}

/**
 * Get current receiver position
 * @returns {Object|null} { lat, lon } or null
 */
export function getReceiverPosition() {
	return receiverPosition;
}

/**
 * Create range rings layer
 * @param {Object} options - Configuration options
 * @returns {Object} { layer, source }
 */
export function createRangeRingsLayer(options = {}) {
	const source = new VectorSource();
	
	const layer = new VectorLayer({
		source,
		style: (feature) => {
			const isRing = feature.get('isRing');
			const distance = feature.get('distance');
			
			if (isRing) {
				// Range ring style
				return new Style({
					stroke: new Stroke({
						color: 'rgba(128, 128, 128, 0.5)',
						width: 1,
						lineDash: [5, 5]
					}),
					fill: new Fill({
						color: 'rgba(128, 128, 128, 0.05)'
					})
				});
			} else {
				// Distance label style
				return new Style({
					text: new Text({
						text: `${distance} nm`,
						font: '12px sans-serif',
						fill: new Fill({ color: '#666' }),
						stroke: new Stroke({ color: '#fff', width: 3 })
					})
				});
			}
		}
	});
	
	return { layer, source };
}

/**
 * Create receiver site/location dot layer
 * @returns {Object} { layer, source }
 */
export function createReceiverDotLayer() {
	const source = new VectorSource();

	const layer = new VectorLayer({
		source,
		style: new Style({
			image: new Circle({
				radius: 5,
				fill: new Fill({ color: 'rgba(0, 170, 255, 0.95)' }),
				stroke: new Stroke({ color: 'rgba(255, 255, 255, 0.95)', width: 2 })
			})
		})
	});

	return { layer, source };
}

/**
 * Update receiver site/location dot
 * @param {VectorSource} source - Dot layer source
 * @param {Object} options - Configuration
 */
export function updateReceiverDot(source, options = {}) {
	const { showDot = true, position = receiverPosition } = options;
	source.clear();

	if (!showDot || !position) return;

	const { lat, lon } = position;
	if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

	const feature = new Feature({
		geometry: new Point(fromLonLat([lon, lat]))
	});

	source.addFeature(feature);
}

/**
 * Update range rings based on receiver position and distances
 * @param {VectorSource} source - Range rings layer source
 * @param {Object} options - Configuration
 */
export function updateRangeRings(source, options = {}) {
	const { 
		showRings = true, 
		distances = [50, 100, 150, 200, 250, 300], // nautical miles
		position = receiverPosition 
	} = options;
	
	// Clear existing rings
	source.clear();
	
	if (!showRings || !position) return;
	
	const { lat, lon } = position;
	
	// Create rings at each distance
	distances.forEach(distance => {
		// Convert nautical miles to meters for OL circular
		const radiusMeters = distance * 1852;
		
		// Create circular polygon
		const circle = circular([lon, lat], radiusMeters, 64);
		circle.transform('EPSG:4326', 'EPSG:3857');
		const feature = new Feature({
			geometry: circle,
			isRing: true,
			distance: distance
		});
		source.addFeature(feature);
		
		// Add label at the top of the ring (north)
		const labelPoint = new Point(fromLonLat([lon, lat + (distance / 60)]));
		const labelFeature = new Feature({
			geometry: labelPoint,
			isRing: false,
			distance: distance
		});
		source.addFeature(labelFeature);
	});
}
