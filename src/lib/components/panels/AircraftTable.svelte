<script>
	import { uiState, uiActions, getVisiblePlanes } from '$lib/stores/uiState.svelte.js';
	import { planeEngine } from '$lib/engine/planeEngine.svelte.js';
	
	// Column configuration
	const columns = [
		{ key: 'flag', label: '', width: 'w-8' },
		{ key: 'callsign', label: 'Callsign', width: 'min-w-[100px]' },
		{ key: 'route', label: 'Route', width: 'min-w-[120px]' },
		{ key: 'icaoType', label: 'Type', width: 'min-w-[80px]' },
		{ key: 'squawk', label: 'Squawk', width: 'w-20' },
		{ key: 'altitude', label: 'Alt. (ft)', format: 'altitude', width: 'w-24' },
		{ key: 'speed', label: 'Spd. (kt)', format: 'speed', width: 'w-20' },
		{ key: 'siteDist', label: 'Dist. (nmi)', format: 'distance', width: 'w-24' },
		{ key: 'rssi', label: 'RSSI', format: 'rssi', width: 'w-20' }
	];
	
	const sourceLegend = [
		{ key: 'adsb', label: 'ADS-B', color: '#1d8bff' },
		{ key: 'uat', label: 'UAT', color: '#1cc56b' },
		{ key: 'adsr', label: 'ADS-R', color: '#20c997' },
		{ key: 'mlat', label: 'MLAT', color: '#e19026' },
		{ key: 'tisb', label: 'TIS-B', color: '#cf4fd9' },
		{ key: 'modeS', label: 'Mode-S', color: '#98a0ad' },
		{ key: 'adsc', label: 'ADS-C', color: '#7b5cff' }
	];

	const getSortColumn = () => uiState.tableSortBy || 'altitude';
	const getSortDirection = () => (uiState.tableSortReverse ? 'asc' : 'desc');
	let activeSortColumn = $derived(getSortColumn());
	let activeSortDirection = $derived(getSortDirection());
	const defaultColumnKeys = columns.map((column) => column.key);
	const columnWidths = {
		flag: '32px',
		callsign: 'minmax(56px, 0.8fr)',
		route: 'minmax(40px, 0.6fr)',
		icaoType: 'minmax(50px, 0.8fr)',
		squawk: '55px',
		altitude: '65px',
		speed: '55px',
		siteDist: '65px',
		rssi: '55px'
	};

	const orderedColumns = $derived.by(() => {
		const requested = Array.isArray(uiState.tableColumnOrder) ? uiState.tableColumnOrder : [];
		const seen = new Set();
		const orderedKeys = [];

		for (const key of requested) {
			if (!defaultColumnKeys.includes(key) || seen.has(key)) continue;
			seen.add(key);
			orderedKeys.push(key);
		}

		for (const key of defaultColumnKeys) {
			if (seen.has(key)) continue;
			orderedKeys.push(key);
		}

		return orderedKeys
			.map((key) => columns.find((column) => column.key === key))
			.filter(Boolean);
	});

	const visibleColumns = $derived.by(() => {
		const hidden = new Set(Array.isArray(uiState.tableHiddenCols) ? uiState.tableHiddenCols : []);
		return orderedColumns.filter((column) => !hidden.has(column.key));
	});

	const tableGridTemplate = $derived(
		visibleColumns
			.map((column) => columnWidths[column.key] || 'minmax(50px, 1fr)')
			.join(' ')
	);
	
	// Get sorted items
	function getSortedItems() {
		// Subscribe to batch updates from plane engine
		const _tick = planeEngine.tick;
		if (_tick === null) {
			// no-op; establishes reactive dependency
		}

		const planes = getVisiblePlanes();
		
		const sortColumn = getSortColumn();
		const sortDirection = getSortDirection();
		if (sortColumn === 'noSort') return planes;

		planes.sort((a, b) => {
			let va = a[sortColumn];
			let vb = b[sortColumn];
			
			if (va === null && vb === null) return 0;
			if (va === null) return 1;
			if (vb === null) return -1;
			
			if (sortDirection === 'asc') {
				return va > vb ? 1 : va < vb ? -1 : 0;
			} else {
				return va < vb ? 1 : va > vb ? -1 : 0;
			}
		});
		
		return planes;
	}
	
	let items = $derived(getSortedItems());
	
	function formatValue(plane, column) {
		if (column.key === 'icaoType') {
			const typeCode = (plane.icaoType || '').trim();
			return typeCode;
		}

		const value = plane[column.key];
		if (value === null || value === undefined) return 'n/a';
		
		switch (column.format) {
			case 'distance':
				return Number(value).toFixed(1);
			case 'messages':
				return Math.round(value).toLocaleString();
			case 'altitude':
				return Math.round(value).toLocaleString();
			case 'speed':
				return Math.round(value);
			case 'track':
				return Math.round(value) + '°';
			case 'rssi':
				return value.toFixed(1);
			case 'seen':
				return value < 60 ? value.toFixed(1) + 's' : Math.floor(value / 60) + 'm';
			default:
				return value;
		}
	}
	
	function getSourceColor(source) {
		const colors = {
			'adsb': '#1d8bff',
			'uat': '#1cc56b',
			'adsr': '#20c997',
			'mlat': '#e19026',
			'tisb': '#cf4fd9',
			'modeS': '#98a0ad',
			'adsc': '#7b5cff',
			'other': '#999999'
		};
		return colors[source] || '#999999';
	}

	function hexToRgba(hex, alpha) {
		const normalized = (hex || '').replace('#', '').trim();
		if (normalized.length !== 6) return `rgba(153, 153, 153, ${alpha})`;
		const r = Number.parseInt(normalized.slice(0, 2), 16);
		const g = Number.parseInt(normalized.slice(2, 4), 16);
		const b = Number.parseInt(normalized.slice(4, 6), 16);
		if ([r, g, b].some((v) => Number.isNaN(v))) return `rgba(153, 153, 153, ${alpha})`;
		return `rgba(${r}, ${g}, ${b}, ${alpha})`;
	}

	function getCountryFlag(plane) {
		const code = (plane.countryCode || '').trim().toUpperCase();
		if (!/^[A-Z]{2}$/.test(code)) return '??';
		return String.fromCodePoint(...[...code].map((c) => 127397 + c.charCodeAt(0)));
	}

	function getFlagUrl(plane) {
		const code = getCountryCode(plane);
		return code === '--' ? null : `/flags/3x2/${code}.svg`;
	}

	function getCountryCode(plane) {
		const code = (plane.countryCode || '').trim().toUpperCase();
		return /^[A-Z]{2}$/.test(code) ? code : '--';
	}
	
	function toggleSort(column) {
		if (uiState.tableSortBy === column) {
			uiState.tableSortReverse = !uiState.tableSortReverse;
		} else {
			uiState.tableSortBy = column;
			uiState.tableSortReverse = false;
		}
	}
	
	function selectPlane(icao) {
		uiActions.selectPlane(icao);
	}
	
	function handleRowKeydown(event, icao) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			selectPlane(icao);
		}
	}
	
	function highlightPlane(icao) {
		uiActions.highlightPlane(icao);
	}
</script>

<div class="aircraft-table">
	<div class="table-header">
		<div class="legend-row" role="note" aria-label="Signal source legend">
			{#each sourceLegend as item}
				<span class="legend-chip"><span class="legend-dot" style="background:{item.color}"></span>{item.label}</span>
			{/each}
		</div>
	</div>
	
	<div class="table-scroll">
		<!-- Header Row -->
		<div class="table-grid-header" style="grid-template-columns: {tableGridTemplate}">
			{#each visibleColumns as column}
				<button
					class="table-header-cell"
					onclick={() => toggleSort(column.key)}
				>
					{column.label}
					{#if activeSortColumn === column.key && column.key !== 'altitude'}
						<span class="sort-indicator">
							{activeSortDirection === 'asc' ? '▲' : '▼'}
						</span>
					{/if}
				</button>
			{/each}
		</div>
		
		<!-- Data Rows Container -->
		<div class="table-grid-body">
			{#if items.length === 0}
				<div class="no-data">No aircraft match filters</div>
			{:else}
				{#each items as item}
					{@const sourceColor = getSourceColor(item.source)}
					<div
						class="table-grid-row"
						class:selected={item.icao === uiState.selectedIcao}
						class:highlighted={item.icao === uiState.highlightedIcao}
						style:grid-template-columns={tableGridTemplate}
						style="--source-color: {sourceColor}; --source-row-bg: {hexToRgba(sourceColor, 0.07)}; --source-row-hover-bg: {hexToRgba(sourceColor, 0.12)}; --source-row-highlight-bg: {hexToRgba(sourceColor, 0.14)}; --source-row-selected-bg: {hexToRgba(sourceColor, 0.18)}"
						onclick={() => selectPlane(item.icao)}
						onkeydown={(event) => handleRowKeydown(event, item.icao)}
						onmouseenter={() => highlightPlane(item.icao)}
						onmouseleave={() => highlightPlane(null)}
						role="button"
						tabindex="0"
					>
						{#each visibleColumns as column}
							<div class="table-cell" class:callsign={column.key === 'callsign'}>
								{#if column.key === 'flag'}
									<div class="flag-cell" title={item.country || 'Unknown country'}>
										{#if getFlagUrl(item)}
											<img
												class="flag-svg"
												src={getFlagUrl(item)}
												alt={getCountryCode(item)}
												loading="lazy"
												onload={(e) => {
													const fallback = e.currentTarget.nextElementSibling;
													if (fallback) fallback.style.display = 'none';
												}}
												onerror={(e) => {
													e.currentTarget.style.display = 'none';
												}}
											/>
										{/if}
										<span class="flag-icon-fallback">{getCountryFlag(item)}</span>
									</div>
								{:else if column.key === 'source'}
									<span
										class="source-badge"
										style="background: {getSourceColor(item.source)}"
									>
										{item.source}
									</span>
								{:else if column.key === 'altitude'}
									{formatValue(item, column)}
									{#if item.baroRate > 0 || item.vertRate > 0}
										<span class="altitude-arrow up">▲</span>
									{:else if item.baroRate < 0 || item.vertRate < 0}
										<span class="altitude-arrow down">▼</span>
									{/if}
								{:else}
									{formatValue(item, column)}
								{/if}
							</div>
						{/each}
					</div>
				{/each}
			{/if}
		</div>
	</div>
</div>

<style>
	.aircraft-table {
		display: flex;
		flex-direction: column;
		height: 100%;
		border-radius: var(--glass-radius-md);
		overflow: hidden;
		color: var(--glass-text-primary);
		background: linear-gradient(-75deg, var(--glass-bg-start), var(--glass-bg-mid), var(--glass-bg-end));
		backdrop-filter: blur(var(--glass-blur-md));
		-webkit-backdrop-filter: blur(var(--glass-blur-md));
		border: 1px solid var(--glass-border);
		box-shadow:
			var(--glass-shadow-inset-top),
			var(--glass-shadow-inset-bottom),
			var(--glass-shadow-drop);
		position: relative;
	}

	.aircraft-table::before {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(105deg, transparent 0%, var(--glass-sheen) 30%, var(--glass-sheen-strong) 50%, var(--glass-sheen) 70%, transparent 100%);
		pointer-events: none;
		z-index: 1;
	}

	.table-header {
		padding: 10px 12px 8px;
		border-bottom: 1px solid var(--glass-border);
		background: rgba(0, 0, 0, 0.4);
		position: relative;
		z-index: 2;
	}

	.table-header::before {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(180deg, rgba(255, 255, 255, 0.05) 0%, transparent 100%);
		pointer-events: none;
	}

	.legend-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem 0.45rem;
		padding-top: 0.1rem;
	}

	.legend-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.12rem 0.36rem;
		border-radius: 999px;
		font-size: 0.64rem;
		letter-spacing: 0.02em;
		background: color-mix(in oklab, var(--color-surface-50) 12%, transparent);
	}

	.legend-dot {
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 999px;
	}

	.table-scroll {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		position: relative;
		z-index: 2;
		min-width: 0;
	}

	.table-grid-header,
	.table-grid-row {
		display: grid;
		grid-template-columns:
			32px              /* flag */
			minmax(56px, 0.8fr) /* callsign */
			minmax(40px, 0.6fr)
			minmax(50px, 0.8fr)
			55px
			65px
			55px
			65px
			55px;
		gap: 0;
		width: 100%;
		box-sizing: border-box;
		min-width: fit-content;
	}

	.table-grid-header {
		background: color-mix(in oklab, var(--color-surface-900) 78%, transparent);
		border-bottom: 1px solid color-mix(in oklab, var(--color-surface-50) 14%, transparent);
		flex-shrink: 0;
		position: sticky;
		top: 0;
		z-index: 10;
		min-width: fit-content;
	}

	.table-header-cell {
		padding: 7px 3px;
		font-size: 10px;
		font-weight: 600;
		text-align: center;
		color: color-mix(in oklab, white 72%, var(--color-surface-200));
		border: none;
		border-right: 1px solid var(--glass-border);
		background: none;
		cursor: pointer;
		white-space: nowrap;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.2rem;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		box-sizing: border-box;
	}

	.table-header-cell:last-child {
		border-right: none;
	}

	.table-header-cell:hover {
		background: color-mix(in oklab, var(--color-surface-50) 8%, transparent);
	}

	.sort-indicator {
		font-size: 10px;
		color: color-mix(in oklab, var(--color-primary-300) 82%, white);
	}

	.table-grid-body {
		flex: 1;
		overflow-y: auto;
		overflow-x: auto;
	}

	.table-grid-row {
		align-items: center;
		border-bottom: 1px solid color-mix(in oklab, var(--color-surface-50) 10%, transparent);
		background: var(--source-row-bg, rgba(255, 255, 255, 0.01));
		cursor: pointer;
		font-size: 12px;
	}

	.table-grid-row:hover {
		background: var(--source-row-hover-bg, rgba(255, 255, 255, 0.05));
	}

	.table-grid-row.selected {
		background: var(--source-row-selected-bg, rgba(255, 255, 255, 0.12));
		color: var(--glass-text-primary);
	}

	.table-grid-row.selected:hover {
		background: var(--source-row-selected-bg, rgba(255, 255, 255, 0.15));
	}

	.table-grid-row.highlighted:not(.selected) {
		background: var(--source-row-highlight-bg, rgba(255, 255, 255, 0.08));
	}

	.table-cell {
		padding: 6px 3px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		min-width: 0;
		border-right: 1px solid var(--glass-border);
		display: flex;
		align-items: center;
		justify-content: center;
		box-sizing: border-box;
		font-size: 11px;
	}

	.table-cell:last-child {
		border-right: none;
	}

	.table-cell.callsign {
		font-weight: 600;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
		justify-content: center;
		text-align: center;
	}

	.flag-cell {
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
		justify-content: center;
		width: 100%;
	}

	.flag-svg {
		width: 20px;
		height: 14px;
		object-fit: cover;
		border-radius: 2px;
		border: 1px solid rgba(255, 255, 255, 0.25);
	}

	.flag-icon-fallback {
		font-size: 1rem;
		line-height: 1;
		opacity: 0.85;
	}

	.source-badge {
		display: inline-block;
		padding: 2px 6px;
		border-radius: 3px;
		color: #fff;
		font-size: 10px;
		font-weight: 500;
		text-transform: uppercase;
	}

	.no-data {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100px;
		color: color-mix(in oklab, white 55%, var(--color-surface-300));
		font-size: 13px;
		grid-column: 1 / -1;
	}

	.altitude-arrow {
		font-size: 0.75em;
		margin-left: 0.25em;
	}

	.altitude-arrow.up {
		color: #4ade80;
	}

	.altitude-arrow.down {
		color: #f87171;
	}
</style>
