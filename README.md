# tar1090-svelte

Modern Svelte 5 + SvelteKit implementation of tar1090 aircraft tracking interface.

## Architecture

This implementation uses a **two-lane architecture** for optimal performance:

### Lane A: Hot Path (Framework Agnostic)
- **Location**: `src/lib/engine/`
- **Purpose**: High-frequency aircraft data updates (1000+ aircraft, 1Hz)
- **Pattern**: Direct mutation, minimal overhead
- **Key Files**:
  - `planeEngine.svelte.js` - Mutable aircraft registry
  - `PlaneObject.js` - Aircraft data model
  - `fetcher.js` - Data fetching from readsb/dump1090

### Lane B: UI State (Svelte 5 Reactive)
- **Location**: `src/lib/stores/`
- **Purpose**: UI state management with full reactivity
- **Pattern**: Svelte 5 runes ($state, $derived)
- **Key Files**:
  - `uiState.svelte.js` - UI reactive state

### OpenLayers Bridge
- **Location**: `src/lib/engine/openlayers/`
- **Pattern**: Imperative OL updates triggered by reactive subscriptions
- Updates aircraft markers efficiently without re-rendering entire map

## Project Structure

```
src/
├── lib/
│   ├── components/
│   │   ├── Map.svelte              # OpenLayers map container
│   │   └── panels/
│   │       ├── FilterPanel.svelte  # Aircraft filters
│   │       └── InfoPanel.svelte    # Selected aircraft details
│   ├── engine/                     # LANE A: Hot path
│   │   ├── planeEngine.svelte.js   # Core registry
│   │   ├── PlaneObject.js          # Aircraft model
│   │   ├── fetcher.js              # Data fetching
│   │   └── openlayers/
│   │       └── adapter.js          # OL integration
│   └── stores/                     # LANE B: UI state
│       └── uiState.svelte.js       # Reactive UI state
└── routes/
    └── +page.svelte                # Main page
```

## Performance Design

### Anti-Patterns Avoided

❌ **Don't** make each aircraft reactive:
```javascript
// WRONG - Creates 1000+ reactive proxies
const planes = $state(new Map());
planes.get(icao).altitude = newAlt; // Triggers cascade
```

✅ **Do** batch updates with single notification:
```javascript
// RIGHT - Batch mutation, single tick
planes.get(icao).altitude = newAlt; // Direct mutation
// ... update all planes ...
updateTick++; // One reactive notification
```

### Key Optimizations

1. **Batch Updates**: All aircraft updated in single batch, one reactive tick
2. **Direct Map Updates**: OpenLayers updated imperatively, not via Svelte re-renders
3. **Virtual Lists**: Table view uses virtual scrolling for 1000+ rows
4. **Object Pooling**: Feature reuse in OpenLayers to minimize GC

## Development

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview
```

## Configuration

The app expects a readsb/dump1090-fa data source at:
- Default: `/data/aircraft.json`

Configure in `src/lib/engine/fetcher.js`.

### Sentry configuration

Set these public environment variables for client-side Sentry:

- `PUBLIC_SENTRY_DSN`
- `PUBLIC_SENTRY_ENABLED` (optional, default `true`)
- `PUBLIC_SENTRY_ENVIRONMENT` (optional, defaults to `development` or `production`)
- `PUBLIC_SENTRY_RELEASE` (optional)
- `PUBLIC_SENTRY_TRACES_SAMPLE_RATE` (optional, default `1.0` in dev, `0.2` in prod)
- `PUBLIC_SENTRY_REPLAYS_SESSION_SAMPLE_RATE` (optional, default `1.0` in dev, `0.05` in prod)
- `PUBLIC_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE` (optional, default `1.0`)
- `PUBLIC_SENTRY_ENABLE_LOGS` (optional, default `false` in dev, `true` in prod)
- `PUBLIC_SENTRY_SEND_DEFAULT_PII` (optional, default `false`)

For the `GET /api/aircraft-zst` proxy endpoint, you can optionally set:

- `AIRCRAFT_ZST_REMOTE_URL`

For upstream tar1090 metadata/type enrichment (`db2` lookup), you can optionally set:

- `AIRCRAFT_DB_REMOTE_BASE_URL` (example: `http://192.168.1.56/tar1090`)

Source-map upload for production builds still uses `SENTRY_AUTH_TOKEN` (see `.env.sentry-build-plugin`).

## Migration Status

✅ Completed:
- Project structure
- Two-lane architecture
- OpenLayers integration
- Filter panel (POC)
- Info panel
- Basic map controls

🚧 TODO:
- Aircraft table with virtual list
- Heatmap visualization
- History playback
- Settings panel
- Mobile responsive design
- Icon/sprites from original tar1090

## Bundle Size

- **Svelte 5 runtime**: ~5kb
- **OpenLayers**: ~100kb
- **Total**: ~50% smaller than original (removed jQuery/jQuery UI)

## License

GPL-2.0+ (same as original tar1090)
