<script>
	import { onDestroy } from 'svelte';
	import { uiState, getSelectedPlane } from '$lib/stores/uiState.svelte.js';
	import { buildTraceUrls, mergeTraceData, normalizeTraceStamps, extractTracePath, filterTraceByWindow } from '$lib/engine/traceEngine.js';
	import VectorLayer from 'ol/layer/Vector';
	import VectorSource from 'ol/source/Vector';
	import { Feature } from 'ol';
	import { LineString } from 'ol/geom';
	import { Stroke, Style } from 'ol/style';
	import { fromLonLat } from 'ol/proj';

	let { map } = $props();
	let traceLayer = $state(null);
	let traceSource = $state(null);
	let requestId = 0;

	$effect(() => {
		if (!map) return;
		if (!uiState.trace?.enabled) {
			teardown();
			return;
		}
		const plane = getSelectedPlane();
		if (!plane) {
			teardown();
			return;
		}

		ensureLayer();
		loadTrace(plane);
	});

	function ensureLayer() {
		if (traceLayer) return;
		traceSource = new VectorSource();
		traceLayer = new VectorLayer({
			source: traceSource,
			style: new Style({
				stroke: new Stroke({ color: '#ff6b00', width: 2 })
			})
		});
		map.addLayer(traceLayer);
	}

	function teardown() {
		if (traceLayer) {
			map?.removeLayer(traceLayer);
			traceLayer = null;
			traceSource = null;
		}
	}

	async function loadTrace(plane) {
		const id = ++requestId;
		const dateText = uiState.trace?.dateText;
		const date = dateText ? new Date(`${dateText}T00:00:00Z`) : new Date();
		const mode = uiState.trace?.mode || 'auto';
		const urls = buildTraceUrls(plane.icao, date, { mode });
		if (!urls.full && !urls.recent) return;

		try {
			const [fullData, recentData] = await Promise.all([
				fetchJson(urls.full, true),
				fetchJson(urls.recent, false)
			]);
			if (id !== requestId) return;
			const normalizedFull = normalizeTraceStamps(fullData);
			const normalizedRecent = normalizeTraceStamps(recentData);
			const merged = mergeTraceData(normalizedFull, normalizedRecent);
			const filtered = filterTraceByWindow(merged, uiState.trace?.startTime, uiState.trace?.endTime);
			const path = extractTracePath(filtered);
			renderTrace(path);
		} catch (error) {
			if (id !== requestId) return;
			renderTrace([]);
		}
	}

	async function fetchJson(url, required) {
		if (!url) return null;
		const response = await fetch(url, {
			caches: 'no-store',
			headers: { 'Accept': 'application/json' }
		});
		if (!response.ok) {
			if (required) throw new Error(`HTTP ${response.status}`);
			return null;
		}
		return response.json();
	}

	function renderTrace(path) {
		if (!traceSource) return;
		traceSource.clear();
		if (!path || path.length < 2) return;
		const coords = path.map(([lon, lat]) => fromLonLat([lon, lat]));
		const feature = new Feature({ geometry: new LineString(coords) });
		traceSource.addFeature(feature);
	}

	onDestroy(() => {
		teardown();
	});
</script>
