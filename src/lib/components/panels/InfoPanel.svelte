<script>
	import { getSelectedPlane } from '$lib/stores/uiState.svelte.js';
	import { getPhotoForPlane } from '$lib/engine/aircraftPhotos.js';

	const selectedPlane = $derived(getSelectedPlane());
	let photo = $state(null);
	let photoRequestId = 0;

	$effect(() => {
		const plane = selectedPlane;
		const requestId = ++photoRequestId;
		if (!plane) {
			photo = null;
			return;
		}
		getPhotoForPlane(plane).then((result) => {
			if (requestId !== photoRequestId) return;
			photo = result;
		});
	});

	function fmtAlt(value) {
		if (value === null || value === undefined) return 'n/a';
		if (value === 'ground') return 'ground';
		return `${Math.round(Number(value)).toLocaleString()} ft`;
	}

	function fmtSpeed(value) {
		if (value === null || value === undefined || Number.isNaN(Number(value))) return 'n/a';
		return `${Math.round(Number(value))} kt`;
	}

	function fmtTrack(value) {
		if (value === null || value === undefined || Number.isNaN(Number(value))) return 'n/a';
		return `${Math.round(Number(value))}deg`;
	}

	function fmtRate(value) {
		if (value === null || value === undefined || Number.isNaN(Number(value))) return 'n/a';
		return `${Math.round(Number(value))} fpm`;
	}

	function fmtNum(value, digits = 1, suffix = '') {
		if (value === null || value === undefined || Number.isNaN(Number(value))) return 'n/a';
		return `${Number(value).toFixed(digits)}${suffix}`;
	}

	function fmtInt(value, suffix = '') {
		if (value === null || value === undefined || Number.isNaN(Number(value))) return 'n/a';
		return `${Math.round(Number(value)).toLocaleString()}${suffix}`;
	}

	function fmtDuration(seconds) {
		if (seconds === null || seconds === undefined || Number.isNaN(Number(seconds))) return 'n/a';
		const s = Number(seconds);
		if (s < 60) return `${s.toFixed(1)}s`;
		const m = Math.floor(s / 60);
		return `${m}m ${Math.round(s % 60)}s`;
	}

	function fmtLatLon(lat, lon) {
		if (lat === null || lon === null || lat === undefined || lon === undefined) return 'n/a';
		return `${Number(lat).toFixed(4)}, ${Number(lon).toFixed(4)}`;
	}

	function fmtDbFlags(plane) {
		const flags = [];
		if (plane?.military) flags.push('military');
		if (plane?.pia) flags.push('pia');
		if (plane?.ladd) flags.push('ladd');
		return flags.length ? flags.join(', ') : 'none';
	}

	function fmtSource(source) {
		const map = {
			adsb: 'ADS-B',
			uat: 'UAT',
			adsr: 'ADS-R',
			mlat: 'MLAT',
			tisb: 'TIS-B',
			modeS: 'Mode-S',
			adsc: 'ADS-C',
			other: 'Other'
		};
		return map[source] || source || 'n/a';
	}

	function fmtRegistration(plane) {
		return plane?.registration || plane?.callsign || 'n/a';
	}

	function fmtRoute(plane) {
		if (plane?.route && String(plane.route).trim()) return plane.route;
		if (plane?.origin && plane?.destination) return `${plane.origin} -> ${plane.destination}`;
		return 'n/a';
	}

	function fmtCategoryLabel(category) {
		if (!category) return 'n/a';
		const c = String(category).toUpperCase();
		if (c.startsWith('A')) return 'Aircraft';
		if (c.startsWith('B')) return 'Glider/Ultralight';
		if (c.startsWith('C')) return 'Rotorcraft';
		if (c.startsWith('D')) return 'Ground vehicle';
		return 'n/a';
	}

	function fmtNicBaro(value) {
		if (value === null || value === undefined) return 'n/a';
		return value ? 'cross-checked' : 'not cross-checked';
	}

	function fmtAdsbVersion(value) {
		if (value === null || value === undefined || Number.isNaN(Number(value))) return 'none';
		const v = Number(value);
		if (v === 0) return 'v0 (DO-260)';
		if (v === 1) return 'v1 (DO-260A)';
		if (v === 2) return 'v2 (DO-260B)';
		return `v${v}`;
	}

	function fmtNavModes(modes) {
		if (!Array.isArray(modes) || modes.length === 0) return 'n/a';
		return modes.join(', ');
	}
</script>

{#if selectedPlane}
	<div class="info-panel glass-card">
		<div class="header">
			<div class="callsign">{selectedPlane.callsign || 'n/a'}</div>
			<div class="icao">{selectedPlane.icao}</div>
		</div>

		{#if photo}
			<div class="photo-block">
				<img src={photo.src} alt={`Photo of ${selectedPlane.callsign || selectedPlane.icao}`} />
				{#if photo.link || photo.credit}
					<div class="photo-credit">
						{#if photo.link}
							<a href={photo.link} target="_blank" rel="noreferrer">Source</a>
						{/if}
						{#if photo.credit}
							<span>{photo.credit}</span>
						{/if}
					</div>
				{/if}
			</div>
		{/if}

		<div class="section">
			<div class="section-title">Identity</div>
			<div class="row"><span class="label">Reg.:</span><span class="value">{fmtRegistration(selectedPlane)}</span></div>
			<div class="row"><span class="label">Country:</span><span class="value">{selectedPlane.country || 'n/a'}</span></div>
			<div class="row"><span class="label">DB flags:</span><span class="value">{fmtDbFlags(selectedPlane)}</span></div>
			<div class="row"><span class="label">Type:</span><span class="value">{selectedPlane.icaoType || 'n/a'}</span></div>
			<div class="row"><span class="label">Type Desc.:</span><span class="value">{selectedPlane.typeDescription || 'n/a'}</span></div>
			<div class="row"><span class="label">Type Long:</span><span class="value">{selectedPlane.typeLong || 'n/a'}</span></div>
			<div class="row"><span class="label">Operator:</span><span class="value">{selectedPlane.ownOp || 'n/a'}</span></div>
			<div class="row"><span class="label">Squawk:</span><span class="value">{selectedPlane.squawk || 'n/a'}</span></div>
			<div class="row"><span class="label">Route:</span><span class="value">{fmtRoute(selectedPlane)}</span></div>
		</div>

		<div class="section">
			<div class="section-title">Spatial</div>
			<div class="row"><span class="label">Groundspeed:</span><span class="value">{fmtSpeed(selectedPlane.speed)}</span></div>
			<div class="row"><span class="label">Baro. Altitude:</span><span class="value">{fmtAlt(selectedPlane.altitude)}</span></div>
			<div class="row"><span class="label">WGS84 Altitude:</span><span class="value">{fmtAlt(selectedPlane.altitudeGeom)}</span></div>
			<div class="row"><span class="label">Vert. Rate:</span><span class="value">{fmtRate(selectedPlane.vertRate)}</span></div>
			<div class="row"><span class="label">Track:</span><span class="value">{fmtTrack(selectedPlane.track)}</span></div>
			<div class="row"><span class="label">Pos.:</span><span class="value">{fmtLatLon(selectedPlane.lat, selectedPlane.lon)}</span></div>
			<div class="row"><span class="label">Distance:</span><span class="value">{fmtNum(selectedPlane.siteDist, 1, ' nmi')}</span></div>
		</div>

		<div class="section">
			<div class="section-title">Signal</div>
			<div class="row"><span class="label">Source:</span><span class="value">{fmtSource(selectedPlane.source)}</span></div>
			<div class="row"><span class="label">RSSI:</span><span class="value">{fmtNum(selectedPlane.rssi, 1, ' dB')}</span></div>
			<div class="row"><span class="label">Msg. Rate:</span><span class="value">{fmtNum(selectedPlane.messageRate, 1, '/s')}</span></div>
			<div class="row"><span class="label">Messages:</span><span class="value">{selectedPlane.messageCount?.toLocaleString() || 'n/a'}</span></div>
			<div class="row"><span class="label">Last Pos.:</span><span class="value">{fmtDuration(selectedPlane.seenPos)}</span></div>
			<div class="row"><span class="label">Last Seen:</span><span class="value">{fmtDuration(selectedPlane.seen)}</span></div>
		</div>

		<div class="section">
			<div class="section-title">FMS SEL</div>
			<div class="row"><span class="label">Sel. Alt.:</span><span class="value">{fmtAlt(selectedPlane.navAltitude)}</span></div>
			<div class="row"><span class="label">Sel. Head.:</span><span class="value">{fmtTrack(selectedPlane.navHeading)}</span></div>
		</div>

		<div class="section">
			<div class="section-title">Wind</div>
			<div class="row"><span class="label">Speed:</span><span class="value">{fmtSpeed(selectedPlane.ws)}</span></div>
			<div class="row"><span class="label">Direction (from):</span><span class="value">{fmtTrack(selectedPlane.wd)}</span></div>
			<div class="row"><span class="label">TAT / OAT:</span><span class="value">{fmtInt(selectedPlane.tat, ' C')} / {fmtInt(selectedPlane.oat, ' C')}</span></div>
		</div>

		<div class="section">
			<div class="section-title">Speed</div>
			<div class="row"><span class="label">Ground:</span><span class="value">{fmtSpeed(selectedPlane.speed)}</span></div>
			<div class="row"><span class="label">True:</span><span class="value">{fmtSpeed(selectedPlane.speedTrue)}</span></div>
			<div class="row"><span class="label">Indicated:</span><span class="value">{fmtSpeed(selectedPlane.speedIndicated)}</span></div>
			<div class="row"><span class="label">Mach:</span><span class="value">{fmtNum(selectedPlane.mach, 3)}</span></div>
		</div>

		<div class="section">
			<div class="section-title">Altitude</div>
			<div class="row"><span class="label">Barometric:</span><span class="value">{fmtAlt(selectedPlane.altitude)}</span></div>
			<div class="row"><span class="label">Baro. Rate:</span><span class="value">{fmtRate(selectedPlane.baroRate)}</span></div>
			<div class="row"><span class="label">WGS84:</span><span class="value">{fmtAlt(selectedPlane.altitudeGeom)}</span></div>
			<div class="row"><span class="label">Geom. Rate:</span><span class="value">{fmtRate(selectedPlane.geomRate)}</span></div>
			<div class="row"><span class="label">QNH:</span><span class="value">{fmtNum(selectedPlane.navQnh, 1, ' hPa')}</span></div>
		</div>

		<div class="section">
			<div class="section-title">Direction</div>
			<div class="row"><span class="label">Ground Track:</span><span class="value">{fmtTrack(selectedPlane.track)}</span></div>
			<div class="row"><span class="label">True Heading:</span><span class="value">{fmtTrack(selectedPlane.heading)}</span></div>
			<div class="row"><span class="label">Magnetic Heading:</span><span class="value">{fmtTrack(selectedPlane.magHeading)}</span></div>
			<div class="row"><span class="label">Magnetic Decl.:</span><span class="value">n/a</span></div>
			<div class="row"><span class="label">Track Rate:</span><span class="value">{fmtNum(selectedPlane.trackRate, 2, ' deg/s')}</span></div>
			<div class="row"><span class="label">Roll:</span><span class="value">{fmtNum(selectedPlane.roll, 1, ' deg')}</span></div>
		</div>

		<div class="section">
			<div class="section-title">Stuff</div>
			<div class="row"><span class="label">Nav. Modes:</span><span class="value">{fmtNavModes(selectedPlane.navModes)}</span></div>
			<div class="row"><span class="label">ADS-B Ver.:</span><span class="value">{fmtAdsbVersion(selectedPlane.adsbVersion)}</span></div>
			<div class="row"><span class="label">Category:</span><span class="value">{selectedPlane.category || 'n/a'}</span></div>
			<div class="row"><span class="label">Category label:</span><span class="value">{fmtCategoryLabel(selectedPlane.category)}</span></div>
		</div>

		<div class="section">
			<div class="section-title">Accuracy</div>
			<div class="row"><span class="label">NACp:</span><span class="value">{fmtInt(selectedPlane.nacP)}</span></div>
			<div class="row"><span class="label">SIL:</span><span class="value">{fmtInt(selectedPlane.sil)}</span></div>
			<div class="row"><span class="label">NACv:</span><span class="value">{fmtInt(selectedPlane.nacV)}</span></div>
			<div class="row"><span class="label">NIC Baro:</span><span class="value">{fmtNicBaro(selectedPlane.nicBaro)}</span></div>
			<div class="row"><span class="label">Rc:</span><span class="value">{fmtInt(selectedPlane.rc, ' m')}</span></div>
			<div class="row"><span class="label">Pos Epoch:</span><span class="value">{fmtInt(selectedPlane.positionTime, ' s')}</span></div>
		</div>
	</div>
{:else}
	<div class="no-selection">
		<p>Click on an aircraft to view details</p>
	</div>
{/if}

<style>
	.info-panel {
		position: relative;
		padding: 16px;
		background: color-mix(in oklab, #f6f9ff 90%, white);
		color: #0f172a;
	}

	.info-panel::after {
		display: none;
	}

	.header {
		margin-bottom: 16px;
		border-bottom: 1px solid var(--glass-border);
		background: #e8f0ff;
		border-radius: 8px;
		padding: 10px 12px;
	}

	.callsign {
		font-size: 20px;
		font-weight: 700;
		color: #0b1220;
	}

	.icao {
		font-size: 13px;
		color: #334155;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
		margin-top: 4px;
	}

	.photo-block {
		margin-bottom: 12px;
	}

	.photo-block img {
		width: 100%;
		max-height: 160px;
		object-fit: cover;
		border-radius: 6px;
		border: 1px solid color-mix(in oklab, white 18%, transparent);
	}

	.photo-credit {
		margin-top: 6px;
		font-size: 11px;
		color: #334155;
		display: flex;
		gap: 8px;
		align-items: center;
		flex-wrap: wrap;
	}

	.photo-credit a {
		color: #0a66d6;
		text-decoration: none;
	}

	.photo-credit a:hover {
		text-decoration: underline;
	}

	.section {
		margin-bottom: 12px;
		padding: 10px 12px;
		border: 1px solid #c9d7ef;
		border-radius: 8px;
		background: #eef4ff;
	}

	.section:last-child {
		margin-bottom: 0;
	}

	.section-title {
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		color: #1e3a8a;
		margin-bottom: 8px;
		letter-spacing: 0.5px;
	}

	.row {
		display: grid;
		grid-template-columns: minmax(120px, 1fr) minmax(0, 1.4fr);
		align-items: center;
		column-gap: 10px;
		margin-bottom: 6px;
		font-size: 13px;
	}

	.row:last-child {
		margin-bottom: 0;
	}

	.label {
		color: #334155;
		white-space: nowrap;
	}

	.value {
		font-weight: 600;
		color: #0f172a;
		text-align: right;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		word-break: normal;
	}

	.no-selection {
		padding: 32px 16px;
		text-align: center;
		color: #334155;
	}
</style>
