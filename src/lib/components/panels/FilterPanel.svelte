<script>
	import { uiState, uiActions, getPlaneStats } from '$lib/stores/uiState.svelte.js';
	
	// Local form state
	let altMin = $state(uiState.filters.altitudeMin ?? '');
	let altMax = $state(uiState.filters.altitudeMax ?? '');
	
	function applyFilters() {
		uiState.filters.altitudeMin = altMin === '' ? null : Number(altMin);
		uiState.filters.altitudeMax = altMax === '' ? null : Number(altMax);
	}
	
	function resetFilters() {
		uiActions.resetFilters();
		altMin = '';
		altMax = '';
	}
	
	function toggleSource(source) {
		const idx = uiState.filters.sources.indexOf(source);
		if (idx >= 0) {
			uiState.filters.sources.splice(idx, 1);
		} else {
			uiState.filters.sources.push(source);
		}
	}

	function toggleDbFlag(flag) {
		const idx = uiState.filters.flagFilter.indexOf(flag);
		if (idx >= 0) {
			uiState.filters.flagFilter.splice(idx, 1);
		} else {
			uiState.filters.flagFilter.push(flag);
		}
	}
	
	const sources = [
		{ id: 'adsb', label: 'ADS-B', color: '#0066cc' },
		{ id: 'uat', label: 'UAT', color: '#00cc66' },
		{ id: 'adsr', label: 'ADS-R', color: '#20c997' },
		{ id: 'mlat', label: 'MLAT', color: '#cc6600' },
		{ id: 'tisb', label: 'TIS-B', color: '#cc00cc' },
		{ id: 'modeS', label: 'Mode S', color: '#666666' },
		{ id: 'adsc', label: 'ADS-C', color: '#7b5cff' },
		{ id: 'other', label: 'Other', color: '#999999' }
	];
</script>

<div class="filter-panel glass-card">
	<h3>Filters</h3>
	
	<div class="stats">
		<span class="stat">{getPlaneStats().total} aircraft</span>
		<span class="stat">{getPlaneStats().visible} visible</span>
	</div>
	
	<div class="filter-section">
		<h4>Altitude Range</h4>
		<div class="range-inputs">
			<input class="glass-input" type="number" placeholder="Min" bind:value={altMin} onchange={applyFilters} />
			<span>to</span>
			<input class="glass-input" type="number" placeholder="Max" bind:value={altMax} onchange={applyFilters} />
			<span class="unit">ft</span>
		</div>
	</div>
	
	<div class="filter-section">
		<h4>Sources</h4>
		<div class="source-list">
			{#each sources as source}
				<label class="source-item">
					<input
						type="checkbox"
						checked={uiState.filters.sources.includes(source.id)}
						onchange={() => toggleSource(source.id)}
					/>
					<span class="source-color" style="background: {source.color}"></span>
					<span class="source-label">{source.label}</span>
				</label>
			{/each}
		</div>
	</div>
	
	<div class="filter-section">
		<h4>Text Filters (Regex)</h4>
		<div class="range-inputs">
			<input class="glass-input" type="text" placeholder="Callsign" bind:value={uiState.filters.callsignFilter} />
		</div>
		<div class="range-inputs">
			<input class="glass-input" type="text" placeholder="Type (e.g. C172|B738)" bind:value={uiState.filters.typeFilter} />
		</div>
		<div class="range-inputs">
			<input class="glass-input" type="text" placeholder="Description" bind:value={uiState.filters.descriptionFilter} />
		</div>
		<div class="range-inputs">
			<input class="glass-input" type="text" placeholder="ICAO" bind:value={uiState.filters.icaoFilter} />
		</div>
	</div>

	<div class="filter-section">
		<h4>DB Flags</h4>
		<label class="checkbox-label">
			<input
				type="checkbox"
				checked={uiState.filters.flagFilter.includes('military')}
				onchange={() => toggleDbFlag('military')}
			/>
			Military
		</label>
		<label class="checkbox-label">
			<input
				type="checkbox"
				checked={uiState.filters.flagFilter.includes('pia')}
				onchange={() => toggleDbFlag('pia')}
			/>
			PIA
		</label>
		<label class="checkbox-label">
			<input
				type="checkbox"
				checked={uiState.filters.flagFilter.includes('ladd')}
				onchange={() => toggleDbFlag('ladd')}
			/>
			LADD
		</label>
	</div>

	<div class="filter-section">
		<label class="checkbox-label">
			<input
				type="checkbox"
				bind:checked={uiState.filters.militaryOnly}
			/>
			Military only
		</label>
		
		<label class="checkbox-label">
			<input
				type="checkbox"
				bind:checked={uiState.filters.groundVehicles}
			/>
			Show ground vehicles
		</label>
		
		<label class="checkbox-label">
			<input
				type="checkbox"
				bind:checked={uiState.filters.nonIcao}
			/>
			Show non-ICAO
		</label>
	</div>
	
	<div class="filter-actions">
		<button onclick={resetFilters} class="glass-button">Reset</button>
	</div>
</div>

<style>
	.filter-panel {
		padding: 16px;
		border-bottom: 1px solid #ddd;
	}
	
	h3 {
		margin: 0 0 12px 0;
		font-size: 16px;
		font-weight: 600;
		color: var(--glass-text-primary);
	}
	
	h4 {
		margin: 0 0 8px 0;
		font-size: 13px;
		font-weight: 600;
		color: var(--glass-text-secondary);
	}
	
	.stats {
		display: flex;
		gap: 16px;
		margin-bottom: 16px;
		padding: 8px;
		background: rgba(0,0,0,0.3);
		border: 1px solid var(--glass-border);
		border-radius: 4px;
		font-size: 13px;
		color: var(--glass-text-primary);
	}
	
	.stat {
		color: var(--glass-text-secondary);
	}
	
	.filter-section {
		margin-bottom: 16px;
	}
	
	.range-inputs {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	
	.range-inputs input {
		width: auto;
		padding: 0;
		border: none;
		font-size: 13px;
	}
	
	.unit {
		color: #666;
		font-size: 12px;
	}
	
	.source-list {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	
	.source-item {
		display: flex;
		align-items: center;
		gap: 8px;
		cursor: pointer;
		font-size: 13px;
		color: var(--glass-text-primary);
	}
	
	.source-color {
		width: 12px;
		height: 12px;
		border-radius: 2px;
	}
	
	.checkbox-label {
		display: flex;
		align-items: center;
		gap: 8px;
		cursor: pointer;
		font-size: 13px;
		margin-bottom: 8px;
		color: var(--glass-text-primary);
	}
	.source-label {
		color: var(--glass-text-primary);
	}
	
	.filter-actions {
		display: flex;
		gap: 8px;
		margin-top: 16px;
	}
</style>
