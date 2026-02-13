<script>
	import { onDestroy, onMount } from 'svelte';
	import { uiState } from '$lib/stores/uiState.svelte.js';
	import { planeEngine } from '$lib/engine/planeEngine.svelte.js';
	import { buildReplayChunkInfo, parseReplayChunk, decodeReplaySlice, advanceReplayTime, nextReplayTimestamp, clampReplaySliceIndex } from '$lib/engine/replayEngine.js';

	let parsedChunk = $state(null);
	let sliceIndex = $state(0);
	let cache = $state(new Map());
	let loadedKey = $state(null);
	let timer = null;

	const speedOptions = [1, 5, 10, 20, 30, 40];

	onMount(() => {
		if (!uiState.replay.dateText) {
			setReplayNow();
		}
	});

	$effect(() => {
		if (!uiState.replay.enabled) {
			pauseReplay();
		}
	});

	onDestroy(() => {
		stopTimer();
	});

	function setReplayNow() {
		const now = new Date();
		uiState.replay.ts = now;
		uiState.replay.dateText = toUtcDateString(now);
		uiState.replay.hours = now.getUTCHours();
		uiState.replay.minutes = now.getUTCMinutes();
		uiState.replay.seconds = 0;
	}

	function toUtcDateString(date) {
		const year = date.getUTCFullYear();
		const month = String(date.getUTCMonth() + 1).padStart(2, '0');
		const day = String(date.getUTCDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	}

	function parseUtcDate(dateText) {
		if (!dateText) return null;
		const [year, month, day] = dateText.split('-').map(Number);
		if (!year || !month || !day) return null;
		const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
		return date;
	}

	function getReplayTimestamp() {
		const date = parseUtcDate(uiState.replay.dateText);
		if (!date) return null;
		date.setUTCHours(Number(uiState.replay.hours) || 0);
		date.setUTCMinutes(Number(uiState.replay.minutes) || 0);
		date.setUTCSeconds(Number(uiState.replay.seconds) || 0);
		return date;
	}

	async function loadReplay(ts) {
		if (!ts) return;
		const chunk = buildReplayChunkInfo(ts.getTime(), 'globe_history/');
		if (loadedKey === chunk.key) return;

		uiState.replay.loading = true;
		uiState.replay.error = null;
		try {
			const response = await fetch(chunk.url, {
				caches: 'no-store',
				headers: { 'Accept': 'application/octet-stream' }
			});
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			const buffer = await response.arrayBuffer();
			const parsed = parseReplayChunk(buffer);
			if (!parsed) throw new Error('Invalid replay chunk');
			parsedChunk = parsed;
			loadedKey = chunk.key;
			sliceIndex = 0;
			cache = new Map();
		} catch (error) {
			uiState.replay.error = error.message;
		} finally {
			uiState.replay.loading = false;
		}
	}

	function startReplay() {
		uiState.replay.enabled = true;
		uiState.replay.playing = true;
		uiState.isPlaying = true;
		scheduleStep();
	}

	function pauseReplay() {
		uiState.replay.playing = false;
		uiState.isPlaying = false;
		stopTimer();
	}

	function stopTimer() {
		if (timer) {
			clearTimeout(timer);
			timer = null;
		}
	}

	function scheduleStep() {
		stopTimer();
		if (!uiState.replay.playing) return;
		const interval = parsedChunk?.ival ?? 1;
		const speed = Number(uiState.replay.speed) || 1;
		timer = setTimeout(stepReplay, (interval / speed) * 1000);
	}

	async function stepReplay() {
		if (!uiState.replay.playing) return;
		const ts = getReplayTimestamp();
		if (!ts) return;

		await loadReplay(ts);
		if (!parsedChunk) return;

		const sliceResult = applySliceAtIndex(ts, sliceIndex);
		if (!sliceResult) return;

		const ival = sliceResult.ival ?? parsedChunk.ival ?? 1;
		const nextTime = advanceReplayTime(ts, ival, sliceIndex);
		uiState.replay.ts = nextTime;
		uiState.replay.hours = nextTime.getUTCHours();
		uiState.replay.minutes = nextTime.getUTCMinutes();
		uiState.replay.seconds = nextTime.getUTCSeconds();

		sliceIndex += 1;
		if (sliceIndex >= parsedChunk.slices.length) {
			const nextTs = nextReplayTimestamp(ts);
			uiState.replay.ts = nextTs;
			uiState.replay.dateText = toUtcDateString(nextTs);
			uiState.replay.hours = nextTs.getUTCHours();
			uiState.replay.minutes = nextTs.getUTCMinutes();
			uiState.replay.seconds = nextTs.getUTCSeconds();
			loadedKey = null;
			parsedChunk = null;
			sliceIndex = 0;
		}

		scheduleStep();
	}

	function applySliceAtIndex(ts, index) {
		if (!parsedChunk) return null;
		const nextIndex = clampReplaySliceIndex(index, parsedChunk.slices.length);
		sliceIndex = nextIndex;
		const sliceResult = decodeReplaySlice(parsedChunk, nextIndex, cache);
		cache = sliceResult.cache || cache;
		if (sliceResult.records?.length) {
			planeEngine.updateBatch(sliceResult.records);
		}

		const ival = sliceResult.ival ?? parsedChunk.ival ?? 1;
		const nextTime = advanceReplayTime(ts, ival, nextIndex);
		uiState.replay.ts = nextTime;
		uiState.replay.hours = nextTime.getUTCHours();
		uiState.replay.minutes = nextTime.getUTCMinutes();
		uiState.replay.seconds = nextTime.getUTCSeconds();

		return sliceResult;
	}

	function applyReplayTime() {
		const ts = getReplayTimestamp();
		uiState.replay.ts = ts;
		loadedKey = null;
		parsedChunk = null;
		sliceIndex = 0;
		if (uiState.replay.playing) {
			scheduleStep();
		}
	}

	async function scrubReplay(event) {
		const ts = getReplayTimestamp();
		if (!ts) return;
		await loadReplay(ts);
		if (!parsedChunk) return;
		const nextIndex = Number(event.currentTarget.value);
		applySliceAtIndex(ts, nextIndex);
		if (uiState.replay.playing) {
			scheduleStep();
		}
	}
</script>

<div class="panel replay-panel">
	<div class="section">
		<label class="checkbox-row">
			<input type="checkbox" bind:checked={uiState.replay.enabled} />
			<span>Enable replay</span>
		</label>
	</div>

	<div class="section">
		<div class="row">
			<label for="replay-date">Date (UTC)</label>
			<input
				id="replay-date"
				type="date"
				bind:value={uiState.replay.dateText}
				onchange={applyReplayTime}
			/>
		</div>
		<div class="row">
			<label for="replay-hour">Hour: {uiState.replay.hours}</label>
			<input
				id="replay-hour"
				type="range"
				min="0"
				max="23"
				bind:value={uiState.replay.hours}
				oninput={applyReplayTime}
			/>
		</div>
		<div class="row">
			<label for="replay-minute">Minute: {uiState.replay.minutes}</label>
			<input
				id="replay-minute"
				type="range"
				min="0"
				max="59"
				bind:value={uiState.replay.minutes}
				oninput={applyReplayTime}
			/>
		</div>
	</div>

	<div class="section">
		<div class="row">
			<button class="btn" onclick={() => (uiState.replay.playing ? pauseReplay() : startReplay())}>
				{uiState.replay.playing ? 'Pause' : 'Play'}
			</button>
			<button class="btn secondary" onclick={setReplayNow}>Now</button>
		</div>
		<div class="row">
			<label for="replay-speed">Speed</label>
			<select id="replay-speed" bind:value={uiState.replay.speed}>
				{#each speedOptions as option}
					<option value={option}>{option}x</option>
				{/each}
			</select>
		</div>
		{#if parsedChunk}
			<div class="row">
				<label for="replay-slice">Timeline: {sliceIndex + 1}/{parsedChunk.slices.length}</label>
				<input
					id="replay-slice"
					type="range"
					min="0"
					max={Math.max(0, parsedChunk.slices.length - 1)}
					step="1"
					value={sliceIndex}
					oninput={scrubReplay}
				/>
			</div>
		{/if}
		{#if uiState.replay.loading}
			<div class="hint">Loading replay chunk...</div>
		{/if}
		{#if uiState.replay.error}
			<div class="hint error">{uiState.replay.error}</div>
		{/if}
	</div>
</div>

<style>
	.replay-panel {
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

	input[type="date"],
	select {
		padding: 6px 8px;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 13px;
	}

	input[type="range"] {
		width: 100%;
	}

	.btn {
		padding: 8px 12px;
		border: none;
		border-radius: 4px;
		background: #0066cc;
		color: #fff;
		font-size: 13px;
		cursor: pointer;
	}

	.btn.secondary {
		background: #f0f0f0;
		color: #333;
	}

	.hint {
		font-size: 12px;
		color: #777;
	}

	.hint.error {
		color: #b00020;
	}
</style>
