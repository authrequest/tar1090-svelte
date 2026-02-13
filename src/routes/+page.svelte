<script>
	import { onMount } from 'svelte';
	import { replaceState } from '$app/navigation';
	import { loadConfig } from '$lib/stores/configLoader.js';
	import Map from '$lib/components/Map.svelte';
	import AircraftTable from '$lib/components/panels/AircraftTable.svelte';
	import FilterPanel from '$lib/components/panels/FilterPanel.svelte';
	import SettingsPanel from '$lib/components/panels/SettingsPanel.svelte';
	import InfoPanel from '$lib/components/panels/InfoPanel.svelte';
	import ReplayPanel from '$lib/components/panels/ReplayPanel.svelte';
	import TracePanel from '$lib/components/panels/TracePanel.svelte';
	import { uiState, getPlaneStats } from '$lib/stores/uiState.svelte.js';
	import { fetcher } from '$lib/engine/fetcher.js';
	import { parseUrlParams, applyUrlParams } from '$lib/engine/urlParams.js';

	let initialView = $state(null);
	let sidebarTab = $state('aircraft');
	let dockTab = $state('replay');
	let dockOpen = $state(false);
	let controlsVisible = $state(true);
	let sidebarWidth = $state(432);
	let railCollapsed = $state(false);
	let mapRef = $state(null);
	let receiverMeta = $state({
		decoder: 'unknown',
		version: 'n/a',
		tar1090RepoUrl: 'https://github.com/wiedehopf/tar1090',
		decoderRepoUrl: null
	});
	let mounted = false;
	let resizingSidebar = false;
	let lastSelectedIcao = null;
	// Config loading state: ensure the map loads only after config is ready
	let configReady = $state(false);

	const SIDEBAR_MIN = 280;
	const SIDEBAR_MAX = 560;
	const stats = $derived(getPlaneStats());

	onMount(async () => {
		mounted = true;
		// Load external config.js early and gracefully: if it fails, fall back to defaults
		try {
			await loadConfig();
		} catch (err) {
			console.warn('[ConfigLoader] Initialization error:', err);
		}
		configReady = true;
		receiverMeta = fetcher.receiverMeta;
		fetcher.onReceiverMeta = (meta) => {
			receiverMeta = meta;
		};

		const params = parseUrlParams();
		initialView = applyUrlParams(params);
		const qs = new URLSearchParams(window.location.search);

		const widthParam = Number(qs.get('sidebarWidth'));
		if (Number.isFinite(widthParam)) {
			sidebarWidth = clampSidebarWidth(widthParam);
		}

		if (qs.has('hideSideBar')) {
			uiState.sidebarOpen = false;
		}

		if (qs.has('tableInView')) {
			uiState.tableOnlyInView = true;
		}

		if (qs.has('hideButtons')) {
			controlsVisible = false;
		}

		if (uiState.filtersOpen) sidebarTab = 'filters';
		if (uiState.settingsOpen) sidebarTab = 'settings';

		const stopResize = () => {
			resizingSidebar = false;
		};

		const updateResize = (event) => {
			if (!resizingSidebar) return;
			sidebarWidth = clampSidebarWidth(event.clientX - 12);
		};

		window.addEventListener('pointermove', updateResize);
		window.addEventListener('pointerup', stopResize);

		return () => {
			fetcher.onReceiverMeta = null;
			window.removeEventListener('pointermove', updateResize);
			window.removeEventListener('pointerup', stopResize);
		};
	});

	function formatMessageRate(value) {
		const rate = Number(value ?? 0);
		return Number.isFinite(rate) ? Math.round(rate) : 0;
	}

	$effect(() => {
		if (!mounted) return;
		if (typeof window === 'undefined') return;

		const params = new URLSearchParams(window.location.search);

		if (uiState.sidebarOpen) {
			params.delete('hideSideBar');
			params.set('sidebarWidth', String(Math.round(sidebarWidth)));
		} else {
			params.set('hideSideBar', '1');
			params.delete('sidebarWidth');
		}

		if (uiState.tableOnlyInView) params.set('tableInView', '1');
		else params.delete('tableInView');

		if (uiState.centerReceiver) params.set('centerReceiver', '1');
		else params.delete('centerReceiver');

		if (uiState.lockDotCentered) params.set('lockDotCentered', '1');
		else params.delete('lockDotCentered');

		if (uiState.autoselect) params.set('autoselect', '1');
		else params.delete('autoselect');

		if (uiState.mapOrientation) {
			params.set('mapOrientation', Number(uiState.mapOrientation).toFixed(1));
		} else {
			params.delete('mapOrientation');
		}

		if (uiState.filters.callsignFilter) params.set('filterCallSign', uiState.filters.callsignFilter);
		else params.delete('filterCallSign');

		if (uiState.filters.typeFilter) params.set('filterType', uiState.filters.typeFilter);
		else params.delete('filterType');

		if (uiState.filters.descriptionFilter) params.set('filterDescription', uiState.filters.descriptionFilter);
		else params.delete('filterDescription');

		if (uiState.filters.icaoFilter) params.set('filterIcao', uiState.filters.icaoFilter);
		else params.delete('filterIcao');

		if (uiState.filters.flagFilter.length > 0) params.set('filterDbFlag', uiState.filters.flagFilter.join(','));
		else params.delete('filterDbFlag');

		if (uiState.filters.sources.length > 0) params.set('filterSources', uiState.filters.sources.join(','));
		else params.delete('filterSources');

		if (uiState.tableSortBy) {
			params.set('sortBy', uiState.tableSortBy === 'noSort' ? 'nosort' : uiState.tableSortBy);
		}
		else params.delete('sortBy');

		if (uiState.tableSortReverse) params.set('sortByReverse', '1');
		else params.delete('sortByReverse');

		if (uiState.tableHiddenCols.length > 0) params.set('hideCol', uiState.tableHiddenCols.join(','));
		else params.delete('hideCol');

		if (uiState.tableColumnOrder.length > 0) params.set('columnOrder', uiState.tableColumnOrder.join(','));
		else params.delete('columnOrder');

		if (!controlsVisible) params.set('hideButtons', '1');
		else params.delete('hideButtons');

		const query = params.toString();
		const nextUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
		
		// Defer replaceState to avoid router initialization race condition
		requestAnimationFrame(() => {
			try {
				replaceState(nextUrl, {});
			} catch (e) {
				// Router not ready, will update on next change
			}
		});
	});

	$effect(() => {
		if (!mounted) return;
		if (typeof window === 'undefined') return;

		const selected = uiState.selectedIcao;
		const justSelected = selected && selected !== lastSelectedIcao;
		lastSelectedIcao = selected;

		if (!justSelected) return;
		if (window.innerWidth <= 1024) {
			uiState.sidebarOpen = false;
		}
	});

	function setSidebarTab(tab) {
		sidebarTab = tab;
		uiState.filtersOpen = tab === 'filters';
		uiState.settingsOpen = tab === 'settings';
	}

	function clampSidebarWidth(value) {
		return Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, value));
	}

	function beginSidebarResize(event) {
		if (!uiState.sidebarOpen) return;
		event.preventDefault();
		resizingSidebar = true;
	}

	function handleResizeKeydown(event) {
		const step = event.shiftKey ? 24 : 12;

		if (event.key === 'ArrowLeft') {
			event.preventDefault();
			sidebarWidth = clampSidebarWidth(sidebarWidth - step);
		} else if (event.key === 'ArrowRight') {
			event.preventDefault();
			sidebarWidth = clampSidebarWidth(sidebarWidth + step);
		} else if (event.key === 'Home') {
			event.preventDefault();
			sidebarWidth = SIDEBAR_MIN;
		} else if (event.key === 'End') {
			event.preventDefault();
			sidebarWidth = SIDEBAR_MAX;
		}
	}

	function toggleFiltersPanel() {
		if (!uiState.sidebarOpen) uiState.sidebarOpen = true;
		if (sidebarTab === 'filters') {
			setSidebarTab('aircraft');
		} else {
			setSidebarTab('filters');
		}
	}

	function toggleSettingsPanel() {
		if (!uiState.sidebarOpen) uiState.sidebarOpen = true;
		if (sidebarTab === 'settings') {
			setSidebarTab('aircraft');
		} else {
			setSidebarTab('settings');
		}
	}

	function openDock(tab) {
		dockTab = tab;
		dockOpen = true;
	}

	function resetMapHome() {
		mapRef?.resetHome?.();
	}
</script>

<main class="tar-shell">
	<div
		class="layout-grid"
		class:sidebar-hidden={!uiState.sidebarOpen}
		style:grid-template-columns={uiState.sidebarOpen ? `${sidebarWidth}px 8px minmax(0, 1fr)` : 'minmax(0, 1fr)'}
	>
		{#if uiState.sidebarOpen}
			<aside class="sidebar glass-card">
				<nav class="sidebar-tabs">
					<button class="btn btn-sm" class:active={sidebarTab === 'aircraft'} onclick={() => setSidebarTab('aircraft')}>Aircraft</button>
					<button class="btn btn-sm" class:active={sidebarTab === 'filters'} onclick={() => setSidebarTab('filters')}>Filters</button>
					<button class="btn btn-sm" class:active={sidebarTab === 'settings'} onclick={() => setSidebarTab('settings')}>Settings</button>
				</nav>
				<div class="sidebar-content">
					{#if sidebarTab === 'aircraft'}
						<div class="table-panel">
							<div class="table-host">
								<AircraftTable />
							</div>
							<section class="receiver-meta card">
								<div class="receiver-stats">
									<div class="stat-item"><span>Messages/s</span><strong>{formatMessageRate(stats.messageRate)}</strong></div>
									<div class="stat-item"><span>With positions</span><strong>{stats.withPositions}</strong></div>
									<div class="stat-item"><span>Aircraft</span><strong>{stats.total}</strong></div>
								</div>
								<p class="receiver-signature">
									<a class="receiver-link" href={receiverMeta.tar1090RepoUrl} target="_blank" rel="noreferrer">tar1090 ({receiverMeta.version})</a>
									<span>|</span>
									{#if receiverMeta.decoderRepoUrl}
										<span>Decoder: <a class="receiver-link" href={receiverMeta.decoderRepoUrl} target="_blank" rel="noreferrer">{receiverMeta.decoder}</a></span>
									{:else}
										<span>Decoder: {receiverMeta.decoder}</span>
									{/if}
								</p>
							</section>
						</div>
					{:else if sidebarTab === 'filters'}
						<FilterPanel />
					{:else}
						<SettingsPanel />
					{/if}
				</div>
			</aside>
			<button
				type="button"
				class="resize-handle"
				aria-label="Resize sidebar"
				onpointerdown={beginSidebarResize}
				onkeydown={handleResizeKeydown}
			></button>
		{/if}

		<section class="map-stage card">
			{#if configReady}
				<Map bind:this={mapRef} {initialView} />
			{:else}
				<div class="loading" aria-label="loading-config">Loading configuration...</div>
			{/if}

			{#if controlsVisible}
				<div class="overlay top-button-strip glass-card">
					<button class="btn btn-sm glass-button" title="Units / Settings" onclick={toggleSettingsPanel}>U</button>
					<button class="btn btn-sm glass-button" title="Home / Reset Map" onclick={resetMapHome}>H</button>
					<button class="btn btn-sm glass-button" title="Toggle Trails" class:active={uiState.settings.showTrails} onclick={() => (uiState.settings.showTrails = !uiState.settings.showTrails)}>T</button>
				</div>

				<nav class="overlay right-rail glass-card" class:collapsed={railCollapsed}>
					<button class="btn btn-sm glass-button rail-collapse" title="Collapse/Expand Rail" onclick={() => (railCollapsed = !railCollapsed)}>{railCollapsed ? '>' : '<'}</button>
					{#if !railCollapsed}
						<button class="btn btn-sm glass-button" title="Settings" onclick={toggleSettingsPanel}>S</button>
						<button class="btn btn-sm glass-button" title="Toggle Labels" class:active={uiState.settings.showLabels} onclick={() => (uiState.settings.showLabels = !uiState.settings.showLabels)}>L</button>
						<button class="btn btn-sm glass-button" title="Toggle Sidebar" class:active={uiState.sidebarOpen} onclick={() => (uiState.sidebarOpen = !uiState.sidebarOpen)}>O</button>
						<button class="btn btn-sm glass-button" title="Follow Selected" class:active={uiState.followSelected} onclick={() => (uiState.followSelected = !uiState.followSelected)}>K</button>
						<button class="btn btn-sm glass-button" title="Only Aircraft in View" class:active={uiState.tableOnlyInView} onclick={() => (uiState.tableOnlyInView = !uiState.tableOnlyInView)}>V</button>
						<button class="btn btn-sm glass-button" title="Toggle Heatmap" class:active={uiState.settings.showHeatmap} onclick={() => (uiState.settings.showHeatmap = !uiState.settings.showHeatmap)}>M</button>
						<button class="btn btn-sm glass-button" title="Replay Panel" class:active={dockOpen && dockTab === 'replay'} onclick={() => openDock('replay')}>P</button>
						<button class="btn btn-sm glass-button" title="Trace Panel" class:active={dockOpen && dockTab === 'trace'} onclick={() => openDock('trace')}>I</button>
						<button class="btn btn-sm glass-button" title="Range Rings" class:active={uiState.settings.showRangeRings} onclick={() => (uiState.settings.showRangeRings = !uiState.settings.showRangeRings)}>R</button>
						<button class="btn btn-sm glass-button" title="Filters" onclick={toggleFiltersPanel}>F</button>
						<button class="btn btn-sm glass-button" title="Close Controls" onclick={() => (controlsVisible = false)}>X</button>
					{/if}
				</nav>
			{:else}
				<div class="overlay overlay-top-right">
					<button class="btn btn-sm variant-filled-surface" onclick={() => (controlsVisible = true)}>Show Buttons</button>
				</div>
			{/if}

			{#if uiState.selectedIcao}
				<aside class="overlay info-drawer glass-card">
					<InfoPanel />
				</aside>
			{/if}

			<section class="overlay bottom-dock glass-card" class:open={dockOpen}>
				<nav class="dock-tabs">
					<button class="btn btn-sm" class:active={dockTab === 'replay'} onclick={() => (dockTab = 'replay')}>Replay</button>
					<button class="btn btn-sm" class:active={dockTab === 'trace'} onclick={() => (dockTab = 'trace')}>Trace</button>
				</nav>
				<div class="dock-content">
					{#if dockTab === 'replay'}
						<ReplayPanel />
					{:else}
						<TracePanel />
					{/if}
				</div>
			</section>
		</section>
	</div>
</main>

<style>
	:global(body) {
		margin: 0;
	}

	.tar-shell {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		height: 100dvh;
		padding: 0.75rem;
		background:
			radial-gradient(circle at 20% 10%, color-mix(in oklab, var(--color-primary-500) 20%, transparent), transparent 40%),
			linear-gradient(165deg, color-mix(in oklab, var(--color-surface-100) 84%, var(--color-primary-700) 16%), var(--color-surface-50));
	}

	.layout-grid {
		flex: 1;
		min-height: 0;
		display: grid;
		grid-template-columns: minmax(320px, 420px) minmax(0, 1fr);
		gap: 0.75rem;
	}

	.layout-grid.sidebar-hidden {
		grid-template-columns: minmax(0, 1fr);
	}

	.sidebar {
		display: flex;
		flex-direction: column;
		min-height: 0;
		overflow: hidden;
	}

	.resize-handle {
		appearance: none;
		border: none;
		cursor: col-resize;
		width: 8px;
		padding: 0;
		border-radius: 999px;
		background: color-mix(in oklab, var(--color-primary-500) 45%, var(--color-surface-500));
		opacity: 0.45;
		transition: opacity 150ms ease;
	}

	.resize-handle:hover,
	.resize-handle:focus-visible {
		opacity: 0.95;
	}

	.sidebar-tabs {
		display: flex;
		gap: 0.5rem;
		padding: 0.6rem;
		border-bottom: 1px solid color-mix(in oklab, var(--color-surface-400) 30%, transparent);
	}

	.sidebar-tabs .btn.active,
	.dock-tabs .btn.active {
		background: var(--color-primary-600);
		color: white;
	}

	.sidebar-content {
		flex: 1;
		min-height: 0;
		overflow: auto;
	}

	.table-host {
		height: 100%;
		min-height: 0;
	}

	.table-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
		padding: 0.5rem;
		gap: 0.5rem;
	}

	.table-panel .table-host {
		flex: 1;
		min-height: 0;
	}

	.receiver-meta {
		margin: 0;
		padding: 0.6rem;
		width: 100%;
		box-sizing: border-box;
		border: 1px solid var(--glass-border);
		background: rgba(30, 35, 50, 0.45);
		backdrop-filter: blur(10px);
		border-radius: var(--glass-radius-sm);
	}

	.receiver-stats {
		display: flex;
		justify-content: space-between;
		gap: 0.45rem;
		margin-bottom: 0.55rem;
	}

	.stat-item {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		text-align: center;
		flex: 1;
	}

	.stat-item:first-child {
		text-align: left;
	}

	.stat-item:last-child {
		text-align: right;
	}

	.stat-item span {
		font-size: 0.68rem;
		opacity: 0.7;
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.stat-item strong {
		font-size: 0.98rem;
		line-height: 1.1;
	}

	.receiver-signature {
		display: flex;
		justify-content: center;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.5rem;
		font-size: 0.74rem;
		margin: 0;
	}

	.receiver-signature > span {
		opacity: 0.8;
	}

	.receiver-link {
		text-align: center;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
		color: #60a5fa;
		text-decoration: none;
		font-weight: 500;
		transition: color 0.2s ease;
	}

	.receiver-link:hover {
		color: #93c5fd;
		text-decoration: underline;
	}

	.map-stage {
		position: relative;
		min-height: 0;
		overflow: hidden;
	}

	.overlay {
		position: absolute;
		z-index: 20;
	}

	.overlay-top-right {
		top: 0.75rem;
		right: 0.75rem;
	}

	.top-button-strip {
		top: 0.75rem;
		left: 0.75rem;
		display: flex;
		gap: 0.35rem;
		padding: 0.35rem 0.45rem;
		background: color-mix(in oklab, var(--color-surface-950) 36%, transparent);
		border: 1px solid color-mix(in oklab, var(--color-surface-50) 16%, transparent);
		box-shadow: 0 6px 16px color-mix(in oklab, black 22%, transparent);
		backdrop-filter: blur(8px);
		max-width: calc(100% - 5rem);
	}

	.top-button-strip .btn,
	.right-rail .btn {
		background: color-mix(in oklab, var(--color-surface-50) 14%, transparent);
		border-color: color-mix(in oklab, var(--color-surface-50) 24%, transparent);
		color: color-mix(in oklab, white 88%, var(--color-surface-200));
	}

	.top-button-strip .btn:hover,
	.right-rail .btn:hover {
		background: color-mix(in oklab, var(--color-surface-50) 22%, transparent);
	}

	.right-rail {
		top: 4.2rem;
		left: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		padding: 0.35rem;
		background: color-mix(in oklab, var(--color-surface-950) 42%, transparent);
		border: 1px solid color-mix(in oklab, var(--color-surface-50) 14%, transparent);
		box-shadow: 0 8px 20px color-mix(in oklab, black 26%, transparent);
		max-height: calc(100% - 1.5rem);
		overflow: auto;
	}

	.right-rail.collapsed {
		padding: 0.25rem;
	}

	.rail-collapse {
		margin-bottom: 0.2rem;
	}

	.right-rail .btn {
		min-width: 2.15rem;
	}

	.right-rail .btn.active,
	.top-button-strip .btn.active {
		background: var(--color-primary-600);
		color: white;
	}

	.info-drawer {
		top: 0.75rem;
		right: 0.75rem;
		width: min(24rem, calc(100% - 1.5rem));
		bottom: 4.25rem;
		max-height: none;
		overflow: auto;
		scrollbar-width: none;
		-ms-overflow-style: none;
	}

	.info-drawer::before,
	.info-drawer::after {
		display: none;
	}

	.info-drawer::-webkit-scrollbar {
		display: none;
	}

	.bottom-dock {
		left: 0.75rem;
		right: 0.75rem;
		bottom: 0.75rem;
		max-height: 2.75rem;
		overflow: hidden;
		transition: max-height 180ms ease;
	}

	.bottom-dock.open {
		max-height: 18rem;
	}

	.dock-tabs {
		display: flex;
		gap: 0.5rem;
		padding: 0.45rem 0.6rem;
		border-bottom: 1px solid color-mix(in oklab, var(--color-surface-400) 30%, transparent);
	}

	.dock-content {
		overflow: auto;
		max-height: calc(18rem - 2.8rem);
	}

	@media (max-width: 1024px) {
		.layout-grid,
		.layout-grid.sidebar-hidden {
			grid-template-columns: 1fr;
			grid-template-rows: auto minmax(0, 1fr);
		}

		.resize-handle {
			display: none;
		}

		.sidebar {
			height: 46vh;
		}

		.info-drawer {
			left: 0.75rem;
			right: 0.75rem;
			width: auto;
			top: 0.75rem;
			bottom: 4.25rem;
			max-height: none;
		}

		.top-button-strip {
			max-width: calc(100% - 5.25rem);
		}

		.right-rail {
			top: auto;
			bottom: 3.75rem;
			flex-direction: row;
			max-width: calc(100% - 1.5rem);
			overflow-x: auto;
			overflow-y: hidden;
		}

		.right-rail .btn {
			min-width: 2rem;
		}
	}

	.tar-shell :global(.filter-panel),
	.tar-shell :global(.settings-panel),
	.tar-shell :global(.trace-panel),
	.tar-shell :global(.replay-panel),
	.tar-shell :global(.info-panel) {
		background: transparent;
		color: color-mix(in oklab, var(--color-surface-950) 88%, var(--color-primary-800));
	}

	.tar-shell :global(.filter-panel h3),
	.tar-shell :global(.settings-panel h3) {
		font-size: 0.95rem;
		margin-bottom: 0.7rem;
	}

	.tar-shell :global(.filter-panel .stats),
	.tar-shell :global(.settings-panel .section),
	.tar-shell :global(.info-panel .section),
	.tar-shell :global(.trace-panel .section),
	.tar-shell :global(.replay-panel .section) {
		background: color-mix(in oklab, var(--color-surface-100) 78%, transparent);
		border: 1px solid color-mix(in oklab, var(--color-surface-400) 24%, transparent);
		border-radius: 0.6rem;
		padding: 0.55rem 0.65rem;
	}

	.tar-shell :global(.filter-panel input),
	.tar-shell :global(.filter-panel select),
	.tar-shell :global(.settings-panel input),
	.tar-shell :global(.settings-panel select),
	.tar-shell :global(.trace-panel input),
	.tar-shell :global(.trace-panel select),
	.tar-shell :global(.replay-panel input),
	.tar-shell :global(.replay-panel select) {
		border-color: color-mix(in oklab, var(--color-surface-500) 35%, transparent);
		background: color-mix(in oklab, var(--color-surface-50) 92%, transparent);
	}
</style>
