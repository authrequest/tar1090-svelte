// PlaneObject.js - Aircraft data model
// Ported from tar1090 html/planeObject.js

import { findICAORange } from './icaoRanges.js';
import { dbLoad, lookupTypeData } from './aircraftDbLoader.js';

export class PlaneObject {
	icao = '';
	numHex = 0;
	fakeHex = false;
	country = '';
	countryCode = '';
	
	// Position
	lat = null;
	lon = null;
	altitude = null;
	altitudeGeom = null;
	altitudeBaro = null;
	altitudeEstimated = false;
	
	// Movement
	speed = null;		// Ground speed
	speedTrue = null;	// True airspeed
	speedIndicated = null;
	mach = null;
	track = null;		// Ground track
	heading = null;		// True heading
	magHeading = null;
	roll = null;
	trackRate = null;
	
	// Vertical
	vertRate = null;
	baroRate = null;
	geomRate = null;
	
	// Navigation
	navAltitude = null;
	navHeading = null;
	navQnh = null;
	navModes = [];
	navAltitudeSrc = null;
	
	// Aircraft info
	registration = '';
	icaoType = '';
	typeDescription = '';
	typeLong = '';
	wtc = ''; // Wake turbulence category
	ownOp = '';
	manufacturer = '';
	year = null;
	
	// Flight
	callsign = '';
	route = '';
	origin = '';
	destination = '';
	
	// Signal/tracking
	source = 'other';	rssi = null;		// Signal strength
	messageCount = 0;
	messageRate = 0;
	seen = 0;			// Seconds since last message
	seenPos = 0;		// Seconds since last position
	positionTime = null;
	receiverCount = null;
	siteDist = null;	// Distance from receiver
	ws = null;
	wd = null;
	oat = null;
	tat = null;
	rc = null;
	nacP = null;
	nacV = null;
	sil = null;
	nicBaro = null;
	adsbVersion = null;
	
	// MLAT/PIA
	mlat = false;		// MLAT position
	tisb = false;		// TIS-B relay
	pia = false;		// Privacy ICAO address
	ladd = false;		// Limit aircraft data display
	military = false;
	groundVehicle = false; // Ground vehicle (e.g., airport service vehicle)
	addrType = null;	// Address type (e.g., 'adsb_icao', 'adsb_icao_nt', 'tisb_other')
	onGround = false;	// Aircraft is on ground
	
	// DB flags	dbFlags = 0;
	dbinfoLoaded = false;
	icaoTypeCache = null;
	dbLoadPromise = null;
	onMetadataUpdate = null;
	
	// Display
	visible = false;	selected = false;
	highlighted = false;
	
	// Track history
	trackLinesegs = [];	historySize = 0;
	trace = [];			// Recent positions for smoothing
	lastTraceTs = 0;
	
	// Constructor
	constructor(icao) {
		this.icao = icao;
		this.numHex = parseInt(icao.replace('~', '1'), 16);
		this.fakeHex = this.numHex > 16777215; // Non-ICAO hex
		
		// Set country and country code from ICAO address range
		const icaorange = findICAORange(icao);
		this.country = icaorange.country || '';
		this.countryCode = (icaorange.country_code || '').toUpperCase();
		
		this.setNull();
		this.checkForDB();
	}
	
	setNull() {
		// Reset mutable properties
		this.lat = null;
		this.lon = null;
		this.altitude = null;
		this.speed = null;
		this.track = null;
		this.seen = 0;
		this.seenPos = 0;
	}
	
	updateData(data) {
		// Update from aircraft.json data
		if (data.lat !== undefined) this.lat = data.lat;
		if (data.lon !== undefined) this.lon = data.lon;
		if (data.altitude !== undefined) this.altitude = data.altitude;
		if (data.alt_baro !== undefined) this.altitudeBaro = data.alt_baro;
		if (data.alt_geom !== undefined) this.altitudeGeom = data.alt_geom;
		if (data.gs !== undefined) this.speed = data.gs;
		if (data.tas !== undefined) this.speedTrue = data.tas;
		if (data.ias !== undefined) this.speedIndicated = data.ias;
		if (data.mach !== undefined) this.mach = data.mach;
		if (data.track !== undefined) this.track = data.track;
		if (data.true_heading !== undefined) this.heading = data.true_heading;
		if (data.mag_heading !== undefined) this.magHeading = data.mag_heading;
		if (data.roll !== undefined) this.roll = data.roll;
		if (data.track_rate !== undefined) this.trackRate = data.track_rate;
		if (data.baro_rate !== undefined) this.baroRate = data.baro_rate;
		if (data.geom_rate !== undefined) this.geomRate = data.geom_rate;
		if (data.vert_rate !== undefined) this.vertRate = data.vert_rate;
		if (data.nav_altitude !== undefined) this.navAltitude = data.nav_altitude;
		if (data.nav_heading !== undefined) this.navHeading = data.nav_heading;
		if (data.nav_qnh !== undefined) this.navQnh = data.nav_qnh;
		if (data.nav_modes !== undefined) this.navModes = data.nav_modes;
		if (data.nav_altitude_src !== undefined) this.navAltitudeSrc = data.nav_altitude_src;
		if (data.callsign !== undefined) this.callsign = data.callsign.trim();
		if (data.country !== undefined) this.country = data.country;
		if (data.country_name !== undefined) this.country = data.country_name;
		if (data.countryCode !== undefined) this.countryCode = data.countryCode;
		if (data.country_code !== undefined) this.countryCode = data.country_code;
		if (data.icaoType !== undefined) this.icaoType = data.icaoType;
		if (data.t !== undefined) this.icaoType = data.t;
		if (data.typeDescription !== undefined) this.typeDescription = data.typeDescription;
		if (data.typeLong !== undefined) this.typeLong = data.typeLong;
		if (data.wtc !== undefined) this.wtc = data.wtc;
		if (data.route !== undefined) this.route = data.route;
		if (data.squawk !== undefined) this.squawk = data.squawk;
		if (data.category !== undefined) this.category = data.category;
		if (data.seen !== undefined) this.seen = data.seen;
		if (data.seen_pos !== undefined) this.seenPos = data.seen_pos;
		if (data.rssi !== undefined) this.rssi = data.rssi;
		if (data.messages !== undefined) this.messageCount = data.messages;
		if (data.messageRate !== undefined) this.messageRate = data.messageRate;
		if (data.source !== undefined) this.source = data.source;
		if (data.receiverCount !== undefined) this.receiverCount = data.receiverCount;
		if (data.position_time !== undefined) this.positionTime = data.position_time;
		if (data.ws !== undefined) this.ws = data.ws;
		if (data.wd !== undefined) this.wd = data.wd;
		if (data.oat !== undefined) this.oat = data.oat;
		if (data.tat !== undefined) this.tat = data.tat;
		if (data.rc !== undefined) this.rc = data.rc;
		if (data.nac_p !== undefined) this.nacP = data.nac_p;
		if (data.nac_v !== undefined) this.nacV = data.nac_v;
		if (data.sil !== undefined) this.sil = data.sil;
		if (data.nic_baro !== undefined) this.nicBaro = data.nic_baro;
		if (data.adsb_version !== undefined) this.adsbVersion = data.adsb_version;
		if (data.mlat !== undefined) this.mlat = data.mlat;
		if (data.tisb !== undefined) this.tisb = data.tisb;
		if (data.dbFlags !== undefined) this.dbFlags = data.dbFlags;
		if (data.type !== undefined) this.addrType = data.type;
		if (data.airground !== undefined) this.onGround = data.airground === 1;
		if (data.r !== undefined && !this.registration) this.registration = data.r;

		this.setTypeFlagsReg(data);
		this.checkForDB(data);
		
		// Detect ground vehicles (matches upstream logic)
		this.groundVehicle = (this.altitude === 'ground') && 
			(this.addrType === 'adsb_icao_nt' || this.addrType === 'tisb_other' || this.addrType === 'tisb_trackfile');
		
		// Calculate derived values
		if (data.calc_track !== undefined && this.track === null) {
			this.track = data.calc_track;
		}
		
		// Update timestamp
		this.lastUpdate = Date.now();
	}

	setTypeData() {
		if (!this.icaoType || this.icaoType === this.icaoTypeCache) return;
		this.icaoTypeCache = this.icaoType;

		const typeData = lookupTypeData(this.icaoType);
		if (!typeData) return;

		if (typeData.typeDescription != null) this.typeDescription = `${typeData.typeDescription}`;
		if (typeData.wtc != null) this.wtc = `${typeData.wtc}`;
		if ((this.typeLong == null || this.typeLong === '') && typeData.typeLong != null) {
			this.typeLong = `${typeData.typeLong}`;
		}
	}

	setTypeFlagsReg(data) {
		if (data?.t && data.t !== this.icaoType) {
			this.icaoType = `${data.t}`;
		}
		this.setTypeData();

		if (data?.dbFlags) {
			this.military = (data.dbFlags & 1) !== 0;
			this.pia = (data.dbFlags & 4) !== 0;
			this.ladd = (data.dbFlags & 8) !== 0;
			if (this.pia) this.registration = null;
		}

		if (data?.r) this.registration = `${data.r}`;
	}

	checkForDB(data) {
		if (!this.dbinfoLoaded && this.icao >= 'ae6620' && this.icao <= 'ae6899') {
			this.icaoType = 'P8 ?';
			this.setTypeData();
		}

		if (data) {
			if (data.desc) this.typeLong = `${data.desc}`;
			if (data.ownOp) this.ownOp = `${data.ownOp}`;
			if (data.year) this.year = `${data.year}`;
			if (data.r || data.t) this.dbinfoLoaded = true;
		}

		if (!this.dbinfoLoaded && !this.fakeHex && !this.dbLoadPromise) {
			void this.getAircraftData();
		}
	}

	async getAircraftData() {
		if (this.dbLoadPromise) return this.dbLoadPromise;

		this.dbLoadPromise = dbLoad(this.icao)
			.then((dbData) => {
				if (Array.isArray(dbData)) {
					if (dbData[0]) this.registration = `${dbData[0]}`;
					if (dbData[1]) this.icaoType = `${dbData[1]}`;
					if (dbData[2]) this.typeDescription = `${dbData[2]}`;
					if (dbData[3]) this.wtc = `${dbData[3]}`;
					if (dbData[4]) this.typeLong = `${dbData[4]}`;
					if (dbData[5]) this.ownOp = `${dbData[5]}`;
					if (dbData[6]) this.year = `${dbData[6]}`;
				}

				this.setTypeData();
				this.dbinfoLoaded = true;
				if (this.onMetadataUpdate) this.onMetadataUpdate();
			})
			.catch(() => {
				this.dbinfoLoaded = true;
			})
			.finally(() => {
				this.dbLoadPromise = null;
			});

		return this.dbLoadPromise;
	}
	
	isVisible() {
		return this.visible && this.lat !== null && this.lon !== null;
	}
	
	isSelected() {
		return this.selected;
	}
	
	getPosition() {
		return this.lat !== null && this.lon !== null 
			? [this.lon, this.lat] 
			: null;
	}

	/**
	 * Compute aircraft rotation/heading for icon rendering.
	 * Priority (as implemented):
	 * 1) If on ground, derive from recent position change (track) -> bearing between last two trace points
	 * 2) true_heading (if available)
	 * 3) mag_heading (if available)
	 * 4) calc_track (if available)
	 * 5) track (if available)
	 * 6) fallback to null
	 */
	get rotation() {
		const onGround = this.onGround === true || this.altitude === 'ground';
		// 1) On ground: try to derive from recent position change
		if (onGround) {
			try {
				const t = this.trace;
				if (Array.isArray(t) && t.length >= 2) {
					const p1 = t[t.length - 2];
					const p2 = t[t.length - 1];
					const bearing = this._bearingBetween(p1, p2);
					if (bearing != null) return bearing;
				}
			} catch (e) {
				// fall through to other headings if bearing computation fails
			}
		}
		// 2) true_heading
		if (this.true_heading != null) return this.true_heading;
		// 3) mag_heading
		if (this.magHeading != null) return this.magHeading;
		// 4) calc_track
		if (this.calc_track != null) return this.calc_track;
		// 5) track
		if (this.track != null) return this.track;
		// 6) nothing available
		return null;
	}

	/**
	 * Helper: compute bearing from point A to point B (lat/lon in degrees).
	 * Returns bearing in degrees [0,360) or null if invalid input.
	 */
	_bearingBetween(pA, pB) {
		if (!pA || !pB) return null;
		const lat1 = Number(pA.lat);
		const lon1 = Number(pA.lon);
		const lat2 = Number(pB.lat);
		const lon2 = Number(pB.lon);
		if ([lat1, lon1, lat2, lon2].some(v => Number.isNaN(v))) return null;
		const toRad = (deg) => (deg * Math.PI) / 180;
		const φ1 = toRad(lat1);
		const φ2 = toRad(lat2);
		const Δλ = toRad(lon2 - lon1);
		const y = Math.sin(Δλ) * Math.cos(φ2);
		const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
		let brng = Math.atan2(y, x) * (180 / Math.PI);
		brng = (brng + 360) % 360;
		return brng;
	}
	
	// Check if aircraft matches filter criteria
	matchesFilter(filters) {
		if (filters.militaryOnly && !this.military) return false;
		if (filters.altitudeMin !== null && this.altitude !== null && this.altitude < filters.altitudeMin) return false;
		if (filters.altitudeMax !== null && this.altitude !== null && this.altitude > filters.altitudeMax) return false;
		if (filters.sources && !filters.sources.includes(this.source)) return false;
		return true;
	}
	
	/**
	 * Update track history with new position
	 * @param {number} maxHistory - Maximum number of track points to keep
	 */
	updateTrack(maxHistory = 50) {
		if (this.lat === null || this.lon === null) return;
		
		const now = Date.now();
		const newPoint = {
			lat: this.lat,
			lon: this.lon,
			altitude: this.altitude,
			timestamp: now
		};
		
		// Add to trace for smoothing
		this.trace.push(newPoint);
		if (this.trace.length > 5) {
			this.trace.shift();
		}
		
		// Add to track history
		if (this.trackLinesegs.length === 0) {
			// Start new track segment
			this.trackLinesegs.push([newPoint]);
		} else {
			const currentSeg = this.trackLinesegs[this.trackLinesegs.length - 1];
			const lastPoint = currentSeg[currentSeg.length - 1];
			
			// Check if position changed significantly (> 0.001 degrees ~ 100m)
			const latDiff = Math.abs(newPoint.lat - lastPoint.lat);
			const lonDiff = Math.abs(newPoint.lon - lastPoint.lon);
			
			if (latDiff > 0.0001 || lonDiff > 0.0001) {
				currentSeg.push(newPoint);
				
				// Limit history size
				const totalPoints = this.trackLinesegs.reduce((sum, seg) => sum + seg.length, 0);
				if (totalPoints > maxHistory) {
					// Remove oldest points from first segment
					const firstSeg = this.trackLinesegs[0];
					if (firstSeg.length > 1) {
						firstSeg.shift();
					} else {
						this.trackLinesegs.shift();
					}
				}
			}
		}
		
		this.lastTraceTs = now;
	}
	
	/**
	 * Get track segments for display
	 * @returns {Array} Array of track segments with coordinates
	 */
	getTrackSegments() {
		return this.trackLinesegs
			.filter(seg => seg.length >= 2)
			.map(seg => seg.map(pt => [pt.lon, pt.lat]));
	}
	
	/**
	 * Clear track history
	 */
	clearTrack() {
		this.trackLinesegs = [];
		this.trace = [];
	}
}

export default PlaneObject;
