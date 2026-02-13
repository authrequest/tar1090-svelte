// config.js - tar1090-svelte configuration
// This file configures the application settings
// All settings are optional - defaults will be used if not specified

// -- Display Settings ------------------------------------
// Display units: "nautical" (ft, nmi, kt), "metric" (m, km, km/h), or "imperial" (ft, mi, mph)
// DisplayUnits = "nautical";

// -- Map Settings ----------------------------------------
// Default zoom level (0-16, lower is further out)
// DefaultZoomLvl = 9;

// Default map center if no receiver position is set
// DefaultCenterLat = 45.0;
// DefaultCenterLon = 9.0;

// Show site marker at receiver location
// SiteShow = true;

// Site marker name (tooltip)
// SiteName = "My Radar Site";

// Default map type
// MapType_tar1090 = "osm";

// Valid map types:
// "osm" - OpenStreetMap
// "carto_light_all" - CartoDB Light
// "carto_dark_all" - CartoDB Dark
// "esri" - ESRI Satellite
// "esri_streets" - ESRI Streets

// Map dimming settings
// MapDim = true;
// mapDimPercentage = 0.45;

// -- Site Circles (Range Rings) ---------------------------
// Show range rings around receiver
// SiteCircles = true;

// Distances for range rings (in display units)
// SiteCirclesDistances = [100, 150, 200, 250];

// Colors for range rings
// SiteCirclesColors = ['#FF0000', '#0000FF', '#00FF00'];

// -- Marker Settings -------------------------------------
// Aircraft icon opacity
// webglIconOpacity = 1.0;

// Marker size factors
// markerZoomDivide = 8.5;
// markerSmall = 1;
// markerBig = 1.18;

// Outline settings
// OutlineADSBColor = '#000000';
// outlineWidth = 1;

// -- Table/Display Settings ------------------------------
// Default column visibility
// See HideCols array in defaults for all options

// Show aircraft pictures
// showPictures = true;
// planespottersAPI = true;

// -- API Keys -------------------------------------------
// Bing Maps API key (optional)
// BingMapsAPIKey = null;

// Mapbox API key (optional)
// MapboxAPIKey = null;

// -- Advanced Settings ----------------------------------
// Filter implausible positions
// positionFilter = true;

// Altitude filter
// altitudeFilter = true;

// MLAT timeout (seconds)
// mlatTimeout = 30;

// Enable mouseover info
// enableMouseover = true;

// Show temporary trails
// tempTrails = false;
// tempTrailsTimeout = 90;

// -- Page Settings --------------------------------------
// Page title
// PageName = "tar1090";

// Show country flags
// ShowFlags = true;

// Show plane count in title
// PlaneCountInTitle = false;

// Show message rate in title
// MessageRateInTitle = false;

// UTC times
// utcTimesLive = false;
// utcTimesHistoric = true;

// -- Colors (Advanced) ----------------------------------
// Uncomment and modify to customize colors
// See config.js.example for full color configuration

// -------------------------------------------------------
// Note: Most users only need to set DisplayUnits, MapType_tar1090,
// DefaultZoomLvl, and SiteShow/SiteName
// -------------------------------------------------------
