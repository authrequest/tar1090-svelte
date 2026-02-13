<script>
	import { onMount, onDestroy } from 'svelte';
	import { planeEngine } from '$lib/engine/planeEngine.svelte.js';
	import { uiState, getSelectedPlane, getVisiblePlanes } from '$lib/stores/uiState.svelte.js';
	import { fetcher } from '$lib/engine/fetcher.js';
	import HeatmapLayer from '$lib/components/HeatmapLayer.svelte';
	import TraceLayer from '$lib/components/TraceLayer.svelte';
	import { 
		createMap, 
		createAircraftLayer, 
		createTrailLayer,
		createRangeRingsLayer,
		createReceiverDotLayer,
		updateAircraftFeatures,
		updateTrailFeatures,
		updateRangeRings,
		updateReceiverDot,
		centerOnPlane,
		setMapView,
		setReceiverPosition,
		getReceiverPosition,
		getDefaultCenter,
		getMapCenterLonLat,
		getMapViewBoundsLonLat
	} from '$lib/engine/openlayers/adapter.js';
	
	// Props for initial view state from URL params
	let { initialView = null } = $props();
	
	let mapContainer;
	let map = $state(null);
	let aircraftLayer;
	let aircraftSource;
	let trailLayer;
	let trailSource;
	let rangeRingsLayer;
	let rangeRingsSource;
	let receiverDotLayer;
	let receiverDotSource;
	let initialViewApplied = false;
	let receiverCentered = false;
	let mapInitialized = false;

	// Hover tooltip state
	let hoveredPlane = $state(null);
	let tooltipPos = $state({ x: 0, y: 0 });
	let showTooltip = $state(false);

	export function resetHome() {
		if (!map) return;
		const receiver = getReceiverPosition();
		const center = receiver ? [receiver.lon, receiver.lat] : getDefaultCenter();
		uiState.followSelected = false;
		setMapView(map, { center });
	}
	
	onMount(() => {
		// Create map
		map = createMap(mapContainer);

		const syncViewBounds = () => {
			uiState.mapViewBounds = getMapViewBoundsLonLat(map);
		};
		map.on('moveend', syncViewBounds);
		
		// Apply initial view state from URL params if provided
		if (initialView && !initialViewApplied) {
			setMapView(map, initialView);
			initialViewApplied = true;
			syncViewBounds();
			
			// If we have a plane to follow, set up following
			if (initialView.followPlane) {
				uiState.followSelected = true;
			}
		}
		
		// Create range rings layer (add first so it's under everything)
		const dotResult = createReceiverDotLayer();
		receiverDotLayer = dotResult.layer;
		receiverDotSource = dotResult.source;
		map.addLayer(receiverDotLayer);

		// Create range rings layer (add first so it's under everything)
		const ringsResult = createRangeRingsLayer();
		rangeRingsLayer = ringsResult.layer;
		rangeRingsSource = ringsResult.source;
		map.addLayer(rangeRingsLayer);
		
		// Create trail layer (add second so it's under aircraft)
		const trailResult = createTrailLayer();
		trailLayer = trailResult.layer;
		trailSource = trailResult.source;
		map.addLayer(trailLayer);
		
		// Create aircraft layer
		const { layer, source } = createAircraftLayer();
		aircraftLayer = layer;
		aircraftSource = source;
		map.addLayer(aircraftLayer);
		
		// Try to extract receiver position from first aircraft data
		// This will be updated when we get data
		fetcher.onReceiverPosition = (lat, lon) => {
			setReceiverPosition(lat, lon);
			updateReceiverDot(receiverDotSource, {
				showDot: true,
				position: { lat, lon }
			});
			updateRangeRings(rangeRingsSource, {
				showRings: uiState.settings.showRangeRings ?? true,
				position: { lat, lon }
			});

			const hasExplicitCenter = Boolean(initialView?.center);
			const hasFollowTarget = Boolean(initialView?.followPlane);
			if (uiState.lockDotCentered) {
				uiState.followSelected = false;
				setMapView(map, { center: [lon, lat] });
				syncViewBounds();
				receiverCentered = true;
				return;
			}
			if (uiState.centerReceiver && !hasExplicitCenter && !hasFollowTarget) {
				setMapView(map, { center: [lon, lat] });
				syncViewBounds();
				receiverCentered = true;
				return;
			}
			if (!receiverCentered && !hasExplicitCenter && !hasFollowTarget) {
				setMapView(map, { center: [lon, lat] });
				syncViewBounds();
				receiverCentered = true;
			}
		};
		
		// Click handler for selection
		map.on('click', (e) => {
			const feature = map.forEachFeatureAtPixel(e.pixel, f => f);
			if (feature) {
				const icao = feature.get('icao');
				uiState.selectedIcao = icao === uiState.selectedIcao ? null : icao;
			} else {
				uiState.selectedIcao = null;
			}
		});

		// Hover handler for tooltips
		map.on('pointermove', (e) => {
			const feature = map.forEachFeatureAtPixel(e.pixel, f => f);
			if (feature) {
				const icao = feature.get('icao');
				const plane = planeEngine.planes.get(icao);
				if (plane) {
					hoveredPlane = plane;
					tooltipPos = { x: e.originalEvent.clientX, y: e.originalEvent.clientY };
					showTooltip = true;
				} else {
					showTooltip = false;
				}
			} else {
				showTooltip = false;
			}
		});
		
		// Start fetching data
		fetcher.onUpdate = () => {
			// Trigger reactive update
		};
		fetcher.start();
		
		// Pause live fetches during replay
		$effect(() => {
			if (uiState.replay?.enabled) {
				fetcher.stop();
			} else {
				fetcher.start();
			}
		});
		
		// Subscribe to engine updates
		$effect(() => {
			// Access tick to subscribe to batch updates
			const _tick = planeEngine.tick;
			if (_tick === null) {
				// no-op
			}
			
			// Update OpenLayers features (imperative, not reactive)
			if (aircraftSource) {
				updateAircraftFeatures(aircraftSource, getVisiblePlanes(), {
					selectedIcao: uiState.selectedIcao,
					highlightedIcao: uiState.highlightedIcao
				});
			}
			
			// Update trail features
			if (trailSource) {
				updateTrailFeatures(trailSource, planeEngine.planes, {
					selectedIcao: uiState.selectedIcao,
					showTrails: uiState.settings.showTrails ?? true
				});
			}
		});
		
		// Follow selected plane
		$effect(() => {
			const plane = getSelectedPlane();
			if (plane && uiState.followSelected && map && !uiState.lockDotCentered) {
				centerOnPlane(map, plane);
			}
		});

		$effect(() => {
			if (!map) return;
			const orientation = Number(uiState.mapOrientation ?? 0);
			if (!Number.isFinite(orientation)) return;
			const normalized = ((orientation % 360) + 360) % 360;
			setMapView(map, { rotation: normalized * (Math.PI / 180) });
		});

		$effect(() => {
			if (!map || !uiState.lockDotCentered) return;
			const pos = fetcher.receiverPosition;
			if (!pos) return;
			uiState.followSelected = false;
			setMapView(map, { center: [pos.lon, pos.lat] });
			syncViewBounds();
		});

		$effect(() => {
			const _tick = planeEngine.tick;
			if (_tick === null) {
				// no-op
			}
			if (!map || !uiState.autoselect) return;
			const center = getMapCenterLonLat(map);
			if (!center) return;
			const [centerLon, centerLat] = center;
			let bestPlane = null;
			let bestScore = Number.POSITIVE_INFINITY;
			for (const plane of getVisiblePlanes()) {
				if (plane.lon === null || plane.lat === null) continue;
				const dx = plane.lon - centerLon;
				const dy = plane.lat - centerLat;
				const score = dx * dx + dy * dy;
				if (score < bestScore) {
					bestScore = score;
					bestPlane = plane;
				}
			}
			if (bestPlane && bestPlane.icao !== uiState.selectedIcao) {
				uiState.selectedIcao = bestPlane.icao;
			}
		});
		
		// Update range rings when settings change
		$effect(() => {
			const showRings = uiState.settings.showRangeRings ?? true;
			const receiverPos = fetcher.receiverPosition;
			
			if (rangeRingsSource && receiverPos) {
				updateReceiverDot(receiverDotSource, {
					showDot: true,
					position: receiverPos
				});
				updateRangeRings(rangeRingsSource, {
					showRings,
					position: receiverPos
				});
			}
		});

		syncViewBounds();
	});
	
	onDestroy(() => {
		fetcher.stop();
		map?.dispose();
	});
</script>

<div class="map-wrapper">
	<div bind:this={mapContainer} class="map-container"></div>
	<HeatmapLayer {map} />
	<TraceLayer {map} />

	{#if showTooltip && hoveredPlane}
		<div
			class="plane-tooltip"
			style="left: {tooltipPos.x + 12}px; top: {tooltipPos.y - 12}px;"
		>
			<div class="tooltip-row">
				<span class="tooltip-speed">{hoveredPlane.speed || 0}kt</span>
				<span class="tooltip-alt">
					{#if hoveredPlane.baroRate > 50}▲
					{:else if hoveredPlane.baroRate < -50}▼
					{:else}▬
					{/if}
					{hoveredPlane.altitude || 0}ft
				</span>
			</div>
			<div class="tooltip-callsign">{hoveredPlane.callsign || hoveredPlane.icao || 'Unknown'}</div>
		</div>
	{/if}
</div>

<style>
	.map-container {
		width: 100%;
		height: 100%;
		background: #d2d2d2;
	}
	
	.map-wrapper {
		position: relative;
		width: 100%;
		height: 100%;
	}

	:global(.ol-overlaycontainer),
	:global(.ol-overlaycontainer-stopevent) {
		background: transparent !important;
	}

	:global(.ol-overlaycontainer-stopevent) {
		pointer-events: none;
	}
	
	:global(.ol-control) {
		background: rgba(255, 255, 255, 0.8);
		border-radius: 4px;
		padding: 2px;
	}
	
	:global(.ol-control button) {
		background: #fff;
		border: 1px solid #ccc;
		color: #333;
		margin: 2px;
		padding: 4px 8px;
		cursor: pointer;
	}
	
	:global(.ol-control button:hover) {
		background: #f0f0f0;
	}

	.plane-tooltip {
		position: fixed;
		pointer-events: none;
		z-index: 1000;
		background: rgba(0, 0, 0, 0.85);
		backdrop-filter: blur(4px);
		border: 1px solid rgba(255, 255, 255, 0.3);
		border-radius: 6px;
		padding: 6px 10px;
		font-size: 12px;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		color: white;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
	}

	.tooltip-row {
		display: flex;
		gap: 8px;
		margin-bottom: 2px;
	}

	.tooltip-speed {
		color: #60a5fa;
		font-weight: 500;
	}

	.tooltip-alt {
		color: #4ade80;
		font-weight: 500;
	}

	.tooltip-callsign {
		color: #fbbf24;
		font-weight: 600;
		font-size: 11px;
	}
</style>
