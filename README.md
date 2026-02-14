# tar1090-svelte

Svelte 5 + SvelteKit aircraft tracking UI for tar1090-style ADS-B data.

This project is a frontend/interface layer and does not replace a decoder such as readsb or dump1090-fa.

## Features

- Live map (OpenLayers) + aircraft table
- Filters, settings, and selected-aircraft details
- Heatmap, replay, and trace panels
- URL parameter sync for map/table/filter state
- API proxies for aircraft zstd stream and tar1090 db/db2 metadata
- Optional Sentry client/server instrumentation

## Architecture

The app uses a two-lane model:

- Lane A (`src/lib/engine/`): mutable hot-path updates (`planeEngine`, `PlaneObject`, `fetcher`)
- Lane B (`src/lib/stores/`): reactive UI state (`uiState`)
- OpenLayers bridge (`src/lib/engine/openlayers/adapter.js`): imperative map updates

## Runtime flow

1. `src/routes/+page.svelte` loads config and URL params.
2. `src/lib/components/Map.svelte` initializes OpenLayers layers.
3. `src/lib/engine/fetcher.js` polls aircraft data and updates `planeEngine` in batches.
4. `planeEngine.tick` drives map feature refreshes and reactive UI reads.
5. Replay mode feeds decoded historical slices into `planeEngine` and pauses live fetches.

## Quick start

### Development

```bash
pnpm install
pnpm dev
```

Other useful commands:

```bash
pnpm check
pnpm test
pnpm build
pnpm preview
```

### Linux installation

```bash
sudo bash -c "$(wget -nv -O - https://github.com/authrequest/tar1090-svelte/raw/master/scripts/install.sh)"
```

### Update

```bash
cd /opt/tar1090-svelte
sudo bash install.sh 3000 /opt/tar1090-svelte
```

### Uninstall

```bash
sudo bash scripts/uninstall.sh
```

## Configuration

- Runtime UI/map settings: `static/config.js`
- Environment defaults and examples: `.env.example`
- Key server vars: `AIRCRAFT_ZST_REMOTE_URL`, `AIRCRAFT_DB_REMOTE_BASE_URL`

## Notes on deployment scripts

- `scripts/install.sh` is the production-focused path in this repository.
- `scripts/deploy.sh` includes helper targets but some targets require adapters/tools not currently in `package.json` (for example adapter-node or adapter-static).

## Current gaps

- No built-in persistence for settings/filter state across browser restarts.
- No PWA/service-worker setup in this repository.

## License

GPL-2.0+ (same license family as upstream tar1090)
