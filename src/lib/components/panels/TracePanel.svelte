<script>
	import { onMount } from 'svelte';
	import { uiState } from '$lib/stores/uiState.svelte.js';

	const modeOptions = [
		{ value: 'auto', label: 'Auto' },
		{ value: 'recent', label: 'Recent' },
		{ value: 'history', label: 'History' }
	];

	onMount(() => {
		if (!uiState.trace.dateText) {
			const now = new Date();
			const year = now.getUTCFullYear();
			const month = String(now.getUTCMonth() + 1).padStart(2, '0');
			const day = String(now.getUTCDate()).padStart(2, '0');
			uiState.trace.dateText = `${year}-${month}-${day}`;
		}
		if (!uiState.trace.startTime) {
			uiState.trace.startTime = '00:00';
		}
		if (!uiState.trace.endTime) {
			uiState.trace.endTime = '23:59';
		}
	});
</script>

<div class="panel trace-panel">
	<div class="section">
		<label class="checkbox-row">
			<input type="checkbox" bind:checked={uiState.trace.enabled} />
			<span>Show trace for selected aircraft</span>
		</label>
	</div>

	<div class="section">
		<div class="row">
			<label for="trace-mode">Source</label>
			<select id="trace-mode" bind:value={uiState.trace.mode}>
				{#each modeOptions as option}
					<option value={option.value}>{option.label}</option>
				{/each}
			</select>
		</div>
		<div class="row">
			<label for="trace-date">Date (UTC)</label>
			<input id="trace-date" type="date" bind:value={uiState.trace.dateText} />
		</div>
		<div class="row">
			<label for="trace-start">Start (UTC)</label>
			<input id="trace-start" type="time" bind:value={uiState.trace.startTime} />
		</div>
		<div class="row">
			<label for="trace-end">End (UTC)</label>
			<input id="trace-end" type="time" bind:value={uiState.trace.endTime} />
		</div>
	</div>
</div>

<style>
	.trace-panel {
		padding: 12px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.section {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.row {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	label {
		font-size: 12px;
		color: #666;
	}

	select,
	input[type="date"],
	input[type="time"] {
		padding: 6px 8px;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 13px;
	}
</style>
