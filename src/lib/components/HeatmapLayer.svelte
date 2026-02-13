<script>
	import { onDestroy } from 'svelte';
	import { uiState } from '$lib/stores/uiState.svelte.js';
	import { planeEngine } from '$lib/engine/planeEngine.svelte.js';
	import { deriveHeatmapSettings } from '$lib/engine/heatmapConfig.js';
	import { buildHeatmapChunkList, decodeHeatmapChunks, fetchHeatmapChunks } from '$lib/engine/heatmapHistory.js';
	import { parseHeatmapRecords } from '$lib/engine/heatmapPoints.js';
	import { fromLonLat } from 'ol/proj';
	import Heatmap from 'ol/layer/Heatmap';
	import VectorLayer from 'ol/layer/Vector';
	import VectorSource from 'ol/source/Vector';
	import { Feature } from 'ol';
	import { Point } from 'ol/geom';
	import { Circle, Fill, Stroke, Style } from 'ol/style';
	
	let { map } = $props();
	let heatmapLayer = $state(null);
	let dotLayer = $state(null);
	let heatSource = $state(null);
	let dotSource = $state(null);
	let redrawListener = null;
	let heatmapPointArrays = $state([]);
	let heatmapRecords = $state([]);
	let heatmapLoadKey = $state('');
	let heatmapLoading = $state(false);

	$effect(() => {
		if (!map) return;
		const showHeatmap = uiState.settings.showHeatmap;
		if (!showHeatmap) {
			teardownLayers();
			return;
		}

		const heatmap = uiState.heatmap?.enabled
			? uiState.heatmap
			: deriveHeatmapSettings({ heatmap: 32000 }, Date.now());

		setupLayers(heatmap);
		ensureHeatmapHistory(heatmap);
		rebuildHeatmapRecords(heatmap);

		const _tick = planeEngine.tick;
		if (!heatmap.manualRedraw) {
			updateHeatmap(heatmap, _tick);
		}
	});

	function setupLayers(heatmap) {
		if (heatmap.real) {
			if (!heatmapLayer) {
				heatSource = new VectorSource();
				heatmapLayer = new Heatmap({
					source: heatSource,
					radius: heatmap.radius ?? 1.5,
					blur: heatmap.blur ?? 4,
					weight: (feature) => feature.get('weight') ?? 1,
					gradient: ['#00f', '#0ff', '#0f0', '#ff0', '#f00']
				});
				map.addLayer(heatmapLayer);
			}
			if (dotLayer) {
				map.removeLayer(dotLayer);
				dotLayer = null;
				dotSource = null;
			}
			applyHeatmapOptions(heatmap);
		} else {
			if (!dotLayer) {
				dotSource = new VectorSource();
				dotLayer = new VectorLayer({
					source: dotSource,
					style: (feature) => {
						const altitude = feature.get('altitude');
						const color = altitudeColor(altitude, heatmap.alpha);
						return new Style({
							image: new Circle({
								radius: heatmap.radius ?? 2.5,
								fill: new Fill({ color }),
								stroke: new Stroke({ color: 'rgba(255, 255, 255, 0.25)', width: 1 })
							})
						});
					}
				});
				map.addLayer(dotLayer);
			}
			if (heatmapLayer) {
				map.removeLayer(heatmapLayer);
				heatmapLayer = null;
				heatSource = null;
			}
		}

		setupRedrawListener(heatmap);
	}

	function setupRedrawListener(heatmap) {
		if (redrawListener) {
			window.removeEventListener('keydown', redrawListener);
			redrawListener = null;
		}

		if (!heatmap.manualRedraw) return;

		redrawListener = (event) => {
			if (event.key === 'r' || event.key === 'R') {
				updateHeatmap(heatmap, planeEngine.tick);
			}
		};
		window.addEventListener('keydown', redrawListener);
	}

	function teardownLayers() {
		if (heatmapLayer) {
			map?.removeLayer(heatmapLayer);
			heatmapLayer = null;
			heatSource = null;
		}
		if (dotLayer) {
			map?.removeLayer(dotLayer);
			dotLayer = null;
			dotSource = null;
		}
		if (redrawListener) {
			window.removeEventListener('keydown', redrawListener);
			redrawListener = null;
		}
	}

	function applyHeatmapOptions(heatmap) {
		if (!heatmapLayer) return;
		heatmapLayer.setRadius(heatmap.radius ?? 1.5);
		heatmapLayer.setBlur(heatmap.blur ?? 4);
		if (heatmap.alpha !== null && heatmap.alpha !== undefined) {
			heatmapLayer.setOpacity(Math.max(0, Math.min(1, heatmap.alpha)));
		}
	}

	function altitudeColor(altitude, alphaOverride) {
		const alpha = alphaOverride !== null && alphaOverride !== undefined ? alphaOverride : 0.6;
		if (altitude === null || altitude === undefined) {
			return `rgba(0, 102, 204, ${alpha})`;
		}
		if (altitude < 1000) return `rgba(255, 0, 0, ${alpha})`;
		if (altitude < 5000) return `rgba(255, 128, 0, ${alpha})`;
		if (altitude < 10000) return `rgba(255, 255, 0, ${alpha})`;
		if (altitude < 20000) return `rgba(0, 255, 0, ${alpha})`;
		if (altitude < 30000) return `rgba(0, 255, 255, ${alpha})`;
		return `rgba(128, 0, 255, ${alpha})`;
	}

	function updateHeatmap(heatmap, _tick) {
		const records = heatmapRecords.length ? heatmapRecords : null;

		if (heatmap.real && heatSource) {
			heatSource.clear();
			const features = [];
			let count = 0;
			const max = heatmap.max ?? 32000;
			if (records) {
				for (const record of records) {
					features.push(new Feature({
						geometry: new Point(fromLonLat([record.lon, record.lat])),
						weight: heatmap.weight ?? 0.25
					}));
					count += 1;
					if (count >= max) break;
				}
			} else {
				for (const plane of planeEngine.planesOrdered) {
					if (plane.lon === null || plane.lat === null) continue;
					features.push(new Feature({
						geometry: new Point(fromLonLat([plane.lon, plane.lat])),
						weight: heatmap.weight ?? 0.25
					}));
					count += 1;
					if (count >= max) break;
				}
			}
			heatSource.addFeatures(features);
		}

		if (!heatmap.real && dotSource) {
			dotSource.clear();
			const features = [];
			let count = 0;
			const max = heatmap.max ?? 32000;
			if (records) {
				for (const record of records) {
					features.push(new Feature({
						geometry: new Point(fromLonLat([record.lon, record.lat])),
						altitude: record.altitude
					}));
					count += 1;
					if (count >= max) break;
				}
			} else {
				for (const plane of planeEngine.planesOrdered) {
					if (plane.lon === null || plane.lat === null) continue;
					features.push(new Feature({
						geometry: new Point(fromLonLat([plane.lon, plane.lat])),
						altitude: plane.altitude
					}));
					count += 1;
					if (count >= max) break;
				}
			}
			dotSource.addFeatures(features);
		}
	}

	async function ensureHeatmapHistory(heatmap) {
		const key = `${heatmap.end ?? ''}-${heatmap.duration ?? ''}-${heatmap.real ? 'real' : 'dot'}`;
		if (heatmapLoading || heatmapLoadKey === key) return;
		if (!heatmap.end || !heatmap.duration) return;

		heatmapLoading = true;
		heatmapLoadKey = key;

		try {
			const chunks = buildHeatmapChunkList(heatmap, 'globe_history/');
			const buffers = await fetchHeatmapChunks(chunks);
			heatmapPointArrays = decodeHeatmapChunks(buffers);
		} finally {
			heatmapLoading = false;
		}
	}

	function rebuildHeatmapRecords(heatmap) {
		if (!heatmapPointArrays.length) {
			heatmapRecords = [];
			return;
		}

		heatmapRecords = parseHeatmapRecords(heatmapPointArrays, {
			max: heatmap.max ?? 32000,
			filters: heatmap.filters,
			sources: uiState.filters.sources,
			altitudeMin: uiState.filters.altitudeMin,
			altitudeMax: uiState.filters.altitudeMax,
			lines: heatmap.lines
		});
	}

	onDestroy(() => {
		teardownLayers();
	});
</script>
