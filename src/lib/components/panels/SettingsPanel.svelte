<script>
	import { uiState } from '$lib/stores/uiState.svelte.js';
	
	const unitOptions = [
		{ value: 'nautical', label: 'Nautical (ft, nm, kt)' },
		{ value: 'metric', label: 'Metric (m, km, km/h)' },
		{ value: 'imperial', label: 'Imperial (ft, mi, mph)' }
	];
	
	const mapTypes = [
		{ value: 'osm', label: 'OpenStreetMap' },
		{ value: 'satellite', label: 'Satellite' },
		{ value: 'dark', label: 'Dark Mode' }
	];

	const tableColumns = [
		{ key: 'flag', label: 'Flag' },
		{ key: 'callsign', label: 'Callsign' },
		{ key: 'route', label: 'Route' },
		{ key: 'icaoType', label: 'Type' },
		{ key: 'squawk', label: 'Squawk' },
		{ key: 'altitude', label: 'Alt. (ft)' },
		{ key: 'speed', label: 'Spd. (kt)' },
		{ key: 'siteDist', label: 'Dist. (nmi)' },
		{ key: 'rssi', label: 'RSSI' }
	];

	function getOrderedColumnKeys() {
		const requested = Array.isArray(uiState.tableColumnOrder) ? uiState.tableColumnOrder : [];
		const seen = new Set();
		const ordered = [];

		for (const key of requested) {
			if (!tableColumns.find((c) => c.key === key) || seen.has(key)) continue;
			seen.add(key);
			ordered.push(key);
		}

		for (const column of tableColumns) {
			if (seen.has(column.key)) continue;
			ordered.push(column.key);
		}

		return ordered;
	}

	function ensureColumnOrder() {
		if (!Array.isArray(uiState.tableColumnOrder) || uiState.tableColumnOrder.length === 0) {
			uiState.tableColumnOrder = tableColumns.map((column) => column.key);
		}
	}

	function toggleColumnVisibility(key) {
		const hidden = Array.isArray(uiState.tableHiddenCols) ? uiState.tableHiddenCols : [];
		if (hidden.includes(key)) {
			uiState.tableHiddenCols = hidden.filter((value) => value !== key);
		} else {
			uiState.tableHiddenCols = [...hidden, key];
		}
	}

	function moveColumn(key, direction) {
		ensureColumnOrder();
		const ordered = getOrderedColumnKeys();
		const index = ordered.indexOf(key);
		if (index < 0) return;
		const target = index + direction;
		if (target < 0 || target >= ordered.length) return;
		const next = [...ordered];
		[next[index], next[target]] = [next[target], next[index]];
		uiState.tableColumnOrder = next;
	}

	const orderedColumnDefs = $derived.by(() =>
		getOrderedColumnKeys()
			.map((key) => tableColumns.find((column) => column.key === key))
			.filter(Boolean)
	);
</script>

<div class="settings-panel glass-card">
    <h3>Settings</h3>
	
    <div class="section">
        <h4>Display</h4>
		
        <div class="setting-row">
            <label for="settings-units">Units</label>
            <select id="settings-units" bind:value={uiState.settings.units}>
				{#each unitOptions as option}
					<option value={option.value}>{option.label}</option>
				{/each}
			</select>
		</div>
		
        <div class="setting-row">
            <label for="settings-map-type">Map Type</label>
            <select id="settings-map-type" bind:value={uiState.settings.mapType}>
				{#each mapTypes as option}
					<option value={option.value}>{option.label}</option>
				{/each}
			</select>
        </div>
		
        <label class="checkbox-row">
            <input
                type="checkbox"
                bind:checked={uiState.settings.dimMap}
            />
            <span>Dim map at night</span>
        </label>
		
        {#if uiState.settings.dimMap}
            <div class="slider-row">
                <label for="settings-dim-amount">Dim amount: {Math.round(uiState.settings.dimPercentage * 100)}%</label>
                <input
                    id="settings-dim-amount"
                    type="range"
                    min="0"
                    max="0.8"
                    step="0.05"
                    bind:value={uiState.settings.dimPercentage}
                />
            </div>
        {/if}
    </div>
	
    <div class="section">
        <h4>Labels</h4>
		
        <label class="checkbox-row">
            <input
                type="checkbox"
                bind:checked={uiState.settings.showLabels}
            />
            <span>Show aircraft labels</span>
        </label>
		
        {#if uiState.settings.showLabels}
            <label class="checkbox-row indent">
                <input
                    type="checkbox"
                    bind:checked={uiState.settings.extendedLabels}
                />
                <span>Extended label info</span>
            </label>
        {/if}
		
        <label class="checkbox-row">
            <input
                type="checkbox"
                bind:checked={uiState.settings.showTrackLabels}
            />
            <span>Show track labels</span>
        </label>
    </div>
	
    <div class="section">
        <h4>Visualization</h4>
		
        <label class="checkbox-row">
            <input
                type="checkbox"
                bind:checked={uiState.settings.showTrails}
            />
            <span>Show aircraft trails</span>
        </label>
		
        <label class="checkbox-row">
            <input
                type="checkbox"
                bind:checked={uiState.settings.showRangeRings}
            />
            <span>Show range rings</span>
        </label>
		
        <label class="checkbox-row">
            <input
                type="checkbox"
                bind:checked={uiState.settings.showHeatmap}
            />
            <span>Show heatmap</span>
        </label>

        <div class="slider-row">
            <label for="settings-map-orientation">Map orientation: {Math.round(uiState.mapOrientation)}°</label>
            <input
                id="settings-map-orientation"
                type="range"
                min="0"
                max="360"
                step="1"
                bind:value={uiState.mapOrientation}
            />
        </div>

        <label class="checkbox-row">
            <input
                type="checkbox"
                bind:checked={uiState.centerReceiver}
            />
            <span>Center on receiver</span>
        </label>

        <label class="checkbox-row indent">
            <input
                type="checkbox"
                bind:checked={uiState.lockDotCentered}
            />
            <span>Lock receiver dot to center</span>
        </label>

        <label class="checkbox-row">
            <input
                type="checkbox"
                bind:checked={uiState.autoselect}
            />
            <span>Auto-select nearest plane to center</span>
        </label>
    </div>
	
    <div class="section">
        <h4>Table</h4>
		
        <label class="checkbox-row">
            <input
                type="checkbox"
                bind:checked={uiState.tableOnlyInView}
            />
            <span>Only show aircraft in current view</span>
        </label>

		<h4>Table Columns</h4>
		<div class="column-config-list">
			{#each orderedColumnDefs as column, idx}
				<div class="column-config-row">
					<label class="checkbox-row column-visibility">
						<input
							type="checkbox"
							checked={!uiState.tableHiddenCols.includes(column.key)}
							onchange={() => toggleColumnVisibility(column.key)}
						/>
						<span>{column.label}</span>
					</label>
					<div class="column-order-buttons">
						<button class="btn btn-sm" onclick={() => moveColumn(column.key, -1)} disabled={idx === 0}>↑</button>
						<button class="btn btn-sm" onclick={() => moveColumn(column.key, 1)} disabled={idx === orderedColumnDefs.length - 1}>↓</button>
					</div>
				</div>
			{/each}
		</div>
    </div>
    </div>

  
<style>
    /* Glass panel container styling is provided by .glass-card. Remove extra padding here. */
    .settings-panel {
        /* padding removed to rely on glass-card */
        padding: 0;
    }
    
    h3 {
        margin: 0 0 16px 0;
        font-size: 16px;
        font-weight: 600;
        color: var(--glass-text-primary);
    }
    
    h4 {
        margin: 0 0 12px 0;
        font-size: 12px;
        text-transform: uppercase;
        color: var(--glass-text-secondary);
        letter-spacing: 0.5px;
    }
    
    .section {
        margin-bottom: 20px;
        padding-bottom: 16px;
        border-bottom: 1px solid var(--glass-border);
    }
    
    .section:last-child {
        border-bottom: none;
    }
    
    .setting-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
    }
    
    .setting-row label {
        font-size: 13px;
        color: var(--glass-text-primary);
    }
    
    select {
        padding: 6px 10px;
        border: 1px solid var(--glass-border);
        border-radius: 4px;
        font-size: 13px;
        background: rgba(0, 0, 0, 0.5);
        color: var(--glass-text-primary);
        min-width: 150px;
    }
    
    .checkbox-row {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 10px;
        cursor: pointer;
        font-size: 13px;
        color: var(--glass-text-primary);
    }
    
    .checkbox-row.indent {
        margin-left: 24px;
    }
    
    .checkbox-row input[type="checkbox"] {
        margin: 0;
    }
    
    .slider-row {
        margin: 8px 0 12px 24px;
    }

	.column-config-list {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-top: 8px;
	}

	.column-config-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}

	.column-visibility {
		margin: 0;
	}

	.column-order-buttons {
		display: inline-flex;
		gap: 4px;
	}
    
    .slider-row label {
        display: block;
        font-size: 11px;
        color: var(--glass-text-secondary);
        margin-bottom: 4px;
    }
    
    .slider-row input[type="range"] {
        width: 100%;
        /* Glass-like appearance for range inputs */
        height: 2px;
        background: linear-gradient(to right, rgba(255,255,255,0.25), rgba(255,255,255,0.25));
        border-radius: 2px;
        outline: none;
    }
    
    /* Improve knob visibility on dark glass */
    .slider-row input[type="range"]::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: #fff;
        border: 2px solid #bbb;
        margin-top: -7px;
        box-shadow: 0 0 0 2px rgba(0,0,0,0.2);
    }
    .slider-row input[type="range"]::-moz-range-thumb {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: #fff;
        border: 2px solid #bbb;
    }
</style>
