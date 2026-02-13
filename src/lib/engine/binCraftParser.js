// binCraftParser.js - Parse binary aircraft data format
// Ported from upstream tar1090 formatter.js wqi() function

const INT32_MAX = 2147483647;

/**
 * Parse binCraft binary format into aircraft data
 * @param {ArrayBuffer} buffer - Raw binary data (after zstd decompression if applicable)
 * @returns {Object} - Parsed data with aircraft array and metadata
 */
export function parseBinCraft(buffer) {
	const data = { buffer };
	
	// Read header (first 13 uint32 values)
	let u32 = new Uint32Array(buffer, 0, 13);
	
	// Timestamp (split across 2 uint32 for high precision)
	data.now = u32[0] / 1000 + u32[1] * 4294967.296;
	
	// Stride = bytes per aircraft record
	const stride = u32[2];
	
	// Global stats
	data.global_ac_count_withpos = u32[3];
	data.globeIndex = u32[4];
	
	// Geographic bounds (int16 array starting at byte 20)
	let limits = new Int16Array(buffer, 20, 4);
	data.south = limits[0];
	data.west = limits[1];
	data.north = limits[2];
	data.east = limits[3];
	
	// Message stats
	data.messages = u32[7];
	
	// Receiver position
	let s32 = new Int32Array(buffer, 0, stride / 4);
	const receiver_lat = s32[8] / 1e6;
	const receiver_lon = s32[9] / 1e6;
	
	// Version and message rate
	const binCraftVersion = u32[10];
	data.messageRate = u32[11] / 10;
	
	// Flags
	const flags = u32[12];
	const useMessageRate = flags & (1 << 0);
	
	// Parse aircraft array
	data.aircraft = [];
	
	for (let off = stride; off < buffer.byteLength; off += stride) {
		let ac = {};
		
		// Create typed array views for this aircraft record
		let acU32 = new Uint32Array(buffer, off, stride / 4);
		let acS32 = new Int32Array(buffer, off, stride / 4);
		let acU16 = new Uint16Array(buffer, off, stride / 2);
		let acS16 = new Int16Array(buffer, off, stride / 2);
		let acU8 = new Uint8Array(buffer, off, stride);
		
		// Hex address (24 bits) with T-bit flag
		let t = acS32[0] & (1 << 24);
		ac.hex = (acS32[0] & ((1 << 24) - 1)).toString(16).padStart(6, '0');
		ac.hex = t ? ('~' + ac.hex) : ac.hex;
		
		// Seen timestamps (version dependent)
		if (binCraftVersion >= 20240218) {
			ac.seen = acS32[1] / 10;
			ac.seen_pos = acS32[27] / 10;
		} else {
			ac.seen_pos = acU16[2] / 10;
			ac.seen = acU16[3] / 10;
		}
		
		// Position
		ac.lon = acS32[2] / 1e6;
		ac.lat = acS32[3] / 1e6;
		
		// Rates and altitudes
		ac.baro_rate = acS16[8] * 8;
		ac.geom_rate = acS16[9] * 8;
		ac.alt_baro = acS16[10] * 25;
		ac.alt_geom = acS16[11] * 25;
		
		// Navigation
		ac.nav_altitude_mcp = acU16[12] * 4;
		ac.nav_altitude_fms = acU16[13] * 4;
		ac.nav_qnh = acS16[14] / 10;
		ac.nav_heading = acS16[15] / 90;
		
		// Squawk code
		const s = acU16[16].toString(16).padStart(4, '0');
		if (s[0] > '9') {
			ac.squawk = String(parseInt(s[0], 16)) + s[1] + s[2] + s[3];
		} else {
			ac.squawk = s;
		}
		
		// Speed and heading
		ac.gs = acS16[17] / 10;
		ac.mach = acS16[18] / 1000;
		ac.roll = acS16[19] / 100;
		ac.track = acS16[20] / 90;
		ac.track_rate = acS16[21] / 100;
		ac.mag_heading = acS16[22] / 90;
		ac.true_heading = acS16[23] / 90;
		
		// Weather
		ac.wd = acS16[24];
		ac.ws = acS16[25];
		ac.oat = acS16[26];
		ac.tat = acS16[27];
		
		// Speeds
		ac.tas = acU16[28];
		ac.ias = acU16[29];
		ac.rc = acU16[30];
		
		// Messages or message rate
		if (useMessageRate) {
			ac.messageRate = acU16[31] / 10;
		} else {
			ac.messages = acU16[31];
		}
		
		// Category and navigation integrity
		ac.category = acU8[64] ? acU8[64].toString(16).toUpperCase() : undefined;
		ac.nic = acU8[65];
		
		// Navigation modes and emergency
		let nav_modes = acU8[66];
		ac.nav_modes = true;
		ac.emergency = acU8[67] & 15;
		ac.type = (acU8[67] & 240) >> 4;
		
		// Airground and altitude source
		ac.airground = acU8[68] & 15;
		ac.nav_altitude_src = (acU8[68] & 240) >> 4;
		
		// Version info
		ac.sil_type = acU8[69] & 15;
		ac.adsb_version = (acU8[69] & 240) >> 4;
		ac.adsr_version = acU8[70] & 15;
		ac.tisb_version = (acU8[70] & 240) >> 4;
		
		// Accuracy
		ac.nac_p = acU8[71] & 15;
		ac.nac_v = (acU8[71] & 240) >> 4;
		ac.sil = acU8[72] & 3;
		ac.gva = (acU8[72] & 12) >> 2;
		ac.sda = (acU8[72] & 48) >> 4;
		ac.nic_a = (acU8[72] & 64) >> 6;
		ac.nic_c = (acU8[72] & 128) >> 7;
		
		// Callsign (8 bytes)
		ac.flight = "";
		for (let i = 78; acU8[i] && i < 86; i++) {
			ac.flight += String.fromCharCode(acU8[i]);
		}
		
		// Database flags
		ac.dbFlags = acU16[43];
		
		// Aircraft type code (4 bytes)
		ac.t = "";
		for (let i = 88; acU8[i] && i < 92; i++) {
			ac.t += String.fromCharCode(acU8[i]);
		}
		
		// Registration (12 bytes)
		ac.r = "";
		for (let i = 92; acU8[i] && i < 104; i++) {
			ac.r += String.fromCharCode(acU8[i]);
		}
		
		ac.receiverCount = acU8[104];
		
		// RSSI (version dependent calculation)
		if (binCraftVersion >= 20250403) {
			ac.rssi = (acU8[105] * (50 / 255)) - 50;
		} else {
			let level = acU8[105] * acU8[105] / 65025 + 1.125e-5;
			ac.rssi = 10 * Math.log(level) / Math.log(10);
		}
		
		// Extra flags
		ac.extraFlags = acU8[106];
		ac.nogps = ac.extraFlags & 1;
		
		// Validity flags - determine which fields are actually valid
		ac.nic_baro = (acU8[73] & 1);
		ac.alert1 = (acU8[73] & 2);
		ac.spi = (acU8[73] & 4);
		
		// Clear invalid fields based on validity flags
		if (!(acU8[73] & 8)) ac.flight = undefined;
		if (!(acU8[73] & 16)) ac.alt_baro = undefined;
		if (!(acU8[73] & 32)) ac.alt_geom = undefined;
		if (!(acU8[73] & 64)) {
			ac.lat = undefined;
			ac.lon = undefined;
			ac.seen_pos = undefined;
		}
		if (!(acU8[73] & 128)) ac.gs = undefined;
		
		if (!(acU8[74] & 1)) ac.ias = undefined;
		if (!(acU8[74] & 2)) ac.tas = undefined;
		if (!(acU8[74] & 4)) ac.mach = undefined;
		if (!(acU8[74] & 8)) ac.track = undefined;
		else ac.calc_track = undefined; // track is valid, not calculated
		if (!(acU8[74] & 16)) ac.track_rate = undefined;
		if (!(acU8[74] & 32)) ac.roll = undefined;
		if (!(acU8[74] & 64)) ac.mag_heading = undefined;
		if (!(acU8[74] & 128)) ac.true_heading = undefined;
		
		if (!(acU8[75] & 1)) ac.baro_rate = undefined;
		if (!(acU8[75] & 2)) ac.geom_rate = undefined;
		if (!(acU8[75] & 4)) ac.nic_a = undefined;
		if (!(acU8[75] & 8)) ac.nic_c = undefined;
		if (!(acU8[75] & 16)) ac.nic_baro = undefined;
		if (!(acU8[75] & 32)) ac.nac_p = undefined;
		if (!(acU8[75] & 64)) ac.nac_v = undefined;
		if (!(acU8[75] & 128)) ac.sil = undefined;
		
		if (!(acU8[76] & 1)) ac.gva = undefined;
		if (!(acU8[76] & 2)) ac.sda = undefined;
		if (!(acU8[76] & 4)) ac.nic_baro = undefined;
		if (!(acU8[76] & 8)) ac.alert1 = undefined;
		if (!(acU8[76] & 16)) ac.spi = undefined;
		
		// Ground flag handling (matches upstream formatter behavior)
		if (ac.airground === 1) {
			ac.alt_baro = 'ground';
		}

		// Map numeric type to upstream string type (matches formatter.js)
		switch (ac.type) {
			case 0: ac.type = 'adsb_icao'; break;
			case 1: ac.type = 'adsb_icao_nt'; break;
			case 2: ac.type = 'adsr_icao'; break;
			case 3: ac.type = 'tisb_icao'; break;
			case 4: ac.type = 'adsc'; break;
			case 5: ac.type = 'mlat'; break;
			case 6: ac.type = 'other'; break;
			case 7: ac.type = 'mode_s'; break;
			case 8: ac.type = 'adsb_other'; break;
			case 9: ac.type = 'adsr_other'; break;
			case 10: ac.type = 'tisb_trackfile'; break;
			case 11: ac.type = 'tisb_other'; break;
			case 12: ac.type = 'mode_ac'; break;
			default: ac.type = 'unknown';
		}

		// Map upstream type names to Svelte UI filter source buckets
		if (ac.type.startsWith('adsb')) ac.source = 'adsb';
		else if (ac.type.startsWith('adsr')) ac.source = 'adsr';
		else if (ac.type.startsWith('tisb')) ac.source = 'tisb';
		else if (ac.type === 'mode_s') ac.source = 'modeS';
		else if (ac.type === 'mlat') ac.source = 'mlat';
		else if (ac.type === 'adsc') ac.source = 'adsc';
		else ac.source = 'other';

		// Rename fields to match PlaneObject expectations
		ac.altitude = ac.alt_baro;
		ac.speed = ac.gs;
		ac.icaoType = ac.t;
		ac.registration = ac.r;
		ac.vert_rate = ac.baro_rate;
		ac.callsign = ac.flight;
		
		data.aircraft.push(ac);
	}
	
	return data;
}
