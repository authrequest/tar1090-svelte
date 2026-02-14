#!/bin/bash
# update-db.sh - Download and update aircraft database files
# Inspired by upstream tar1090-db integration

set -e

echo "=== tar1090-svelte Database Update ==="
echo

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# Functions
print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[i]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

# Configuration
DB_URL="https://github.com/wiedehopf/tar1090-db/raw/csv/aircraft.csv.gz"
STATIC_DIR="static/data"
DB_FILE="$STATIC_DIR/aircraft.csv.gz"

# Create data directory
mkdir -p "$STATIC_DIR"

# Check for required tools
echo "Checking prerequisites..."
if command -v curl >/dev/null 2>&1; then
    DOWNLOADER="curl -L -o"
elif command -v wget >/dev/null 2>&1; then
    DOWNLOADER="wget -O"
else
    print_error "Neither curl nor wget found. Please install one of them."
    exit 1
fi
print_status "Downloader available"

# Download aircraft database
echo
print_info "Downloading aircraft database..."
print_info "Source: $DB_URL"

if [ -f "$DB_FILE" ]; then
    OLD_SIZE=$(stat -f%z "$DB_FILE" 2>/dev/null || stat -c%s "$DB_FILE" 2>/dev/null || echo "0")
    print_info "Existing database found (${OLD_SIZE} bytes)"
    print_info "Backing up existing database..."
    cp "$DB_FILE" "$DB_FILE.backup.$(date +%Y%m%d_%H%M%S)"
fi

if $DOWNLOADER "$DB_FILE.tmp" "$DB_URL"; then
    mv "$DB_FILE.tmp" "$DB_FILE"
    NEW_SIZE=$(stat -f%z "$DB_FILE" 2>/dev/null || stat -c%s "$DB_FILE" 2>/dev/null || echo "0")
    print_status "Database downloaded successfully (${NEW_SIZE} bytes)"
else
    print_error "Failed to download database"
    rm -f "$DB_FILE.tmp"
    exit 1
fi

# Verify the download
echo
print_info "Verifying database..."
if command -v gunzip >/dev/null 2>&1; then
    if gunzip -t "$DB_FILE" 2>/dev/null; then
        print_status "Database integrity verified (valid gzip)"
    else
        print_error "Database file appears to be corrupted"
        exit 1
    fi
else
    print_warning "gunzip not available, skipping integrity check"
fi

# Show database stats
echo
print_info "Database statistics:"
if command -v gunzip >/dev/null 2>&1; then
    LINES=$(gunzip -c "$DB_FILE" | wc -l)
    print_status "Total entries: $LINES"
fi

# Download type cache from upstream
echo
print_info "Checking type cache..."
TYPE_CACHE_URL="https://github.com/wiedehopf/tar1090-db/raw/master/icao_aircraft_types2.js"
TYPE_CACHE_FILE="$STATIC_DIR/icao_aircraft_types2.js"

if $DOWNLOADER "$TYPE_CACHE_FILE.tmp" "$TYPE_CACHE_URL" 2>/dev/null; then
    mv "$TYPE_CACHE_FILE.tmp" "$TYPE_CACHE_FILE"
    print_status "Type cache updated"
else
    print_warning "Could not download type cache (optional)"
    rm -f "$TYPE_CACHE_FILE.tmp"
fi

# Clean up old backups (keep last 5)
echo
print_info "Cleaning up old backups..."
ls -t "$STATIC_DIR"/aircraft.csv.gz.backup.* 2>/dev/null | tail -n +6 | xargs -r rm -f
print_status "Cleanup complete"

# Summary
echo
print_status "Database update complete!"
echo
echo "Files updated:"
echo "  - $DB_FILE"
[ -f "$TYPE_CACHE_FILE" ] && echo "  - $TYPE_CACHE_FILE"
echo
echo "Next steps:"
echo "  1. Restart development server if running"
echo "  2. Run: pnpm build  (to include in production build)"
echo
echo "To restore a backup:"
echo "  cp $STATIC_DIR/aircraft.csv.gz.backup.YYYYMMDD_HHMMSS $DB_FILE"
