#!/bin/bash
# tar1090-svelte History Daemon
# Maintains rolling aircraft history for pTracks visualization
# Adapted from upstream tar1090.sh for Node.js/SvelteKit deployment

set -e
set -o pipefail

# Signal handling for clean shutdown
cleanup() {
    echo "[$SERVICE_NAME] Shutting down..."
    trap - SIGTERM SIGINT SIGHUP SIGQUIT
    pkill -P $$ || true
    exit 0
}
trap 'echo "[ERROR] Error in line $LINENO when executing: $BASH_COMMAND"' ERR
trap cleanup SIGTERM SIGINT SIGHUP SIGQUIT

# Run with low priority to not interfere with decoder
renice 20 $$ || true

# Configuration with defaults
SERVICE_NAME="${SERVICE_NAME:-tar1090-svelte-history}"
RUN_DIR="${RUN_DIR:-/var/lib/tar1090-svelte/history}"
SRC_URL="${SRC_URL:-http://127.0.0.1:8080/data/aircraft.json}"
INTERVAL="${INTERVAL:-8}"
HISTORY_SIZE="${HISTORY_SIZE:-450}"
CHUNK_SIZE="${CHUNK_SIZE:-60}"
PTRACKS="${PTRACKS:-8}"
GZIP_LVL="${GZIP_LVL:-1}"
ENABLE_COMPRESSION="${ENABLE_COMPRESSION:-yes}"

# Ensure directories exist
mkdir -p "$RUN_DIR"
cd "$RUN_DIR"

print_info() {
    echo "[$SERVICE_NAME] $1"
}

print_error() {
    echo "[$SERVICE_NAME] [ERROR] $1" >&2
}

# Validate configuration
if (( INTERVAL < 1 )); then
    print_error "INTERVAL must be at least 1 second"
    exit 1
fi

if (( HISTORY_SIZE < 10 )); then
    print_error "HISTORY_SIZE must be at least 10"
    exit 1
fi

if (( GZIP_LVL < 1 || GZIP_LVL > 9 )); then
    GZIP_LVL=1
fi

# Calculate chunk parameters
chunks=$(( HISTORY_SIZE / CHUNK_SIZE + 1 ))
CHUNK_SIZE=$(( CHUNK_SIZE - ( (CHUNK_SIZE - HISTORY_SIZE % CHUNK_SIZE) / chunks ) ))
chunksAll=$(awk "function ceil(x){return int(x)+(x>int(x))} BEGIN {printf ceil($PTRACKS * 3600 / $INTERVAL / $CHUNK_SIZE)}")

if (( chunksAll < chunks )); then
    chunksAll="$chunks"
fi

print_info "Starting history daemon"
print_info "Run directory: $RUN_DIR"
print_info "Source URL: $SRC_URL"
print_info "Interval: ${INTERVAL}s"
print_info "History size: $HISTORY_SIZE entries"
print_info "Chunk size: $CHUNK_SIZE"
print_info "pTracks duration: ${PTRACKS}h"

# Function to compress data
compress() {
    if [[ "$ENABLE_COMPRESSION" == "yes" ]]; then
        gzip -"$GZIP_LVL"
    else
        cat
    fi
}

# Function to decompress data
decompress() {
    if [[ "$ENABLE_COMPRESSION" == "yes" ]]; then
        gunzip -c
    else
        cat
    fi
}

# Create new chunk from file
newChunk() {
    local source_file="$1"
    local timestamp
    timestamp=$(date +%s%3N)
    
    if [[ "$source_file" != "refresh" ]]; then
        curChunk="chunk_${timestamp}.json"
        if [[ "$ENABLE_COMPRESSION" == "yes" ]]; then
            curChunk="${curChunk}.gz"
        fi
        echo "$curChunk" >> chunk_list
        echo "$curChunk" >> chunk_list_all
        cp "$source_file" "$curChunk"
    fi
    
    # Cleanup old chunks
    if [[ -f chunk_list_all ]]; then
        while IFS= read -r ITEM; do
            if [[ -n "$ITEM" && -f "$RUN_DIR/$ITEM" ]]; then
                rm -f "$RUN_DIR/$ITEM"
            fi
        done < <(head -n-$chunksAll chunk_list_all 2>/dev/null || true)
        
        tail -n$chunksAll chunk_list_all > chunk_list_all.tmp 2>/dev/null || touch chunk_list_all.tmp
        mv chunk_list_all.tmp chunk_list_all
    fi
    
    if [[ -f chunk_list ]]; then
        tail -n$chunks chunk_list > chunk_list.tmp 2>/dev/null || touch chunk_list.tmp
        mv chunk_list.tmp chunk_list
    fi
    
    # Construct chunks.json index
    local JSON='{'
    JSON+=' "interval": "'"$INTERVAL"'",'
    JSON+=' "history_size": "'"$HISTORY_SIZE"'",'
    JSON+=' "ptracks_duration": "'"$PTRACKS"'",'
    JSON+=' "chunks": [ '
    
    if [[ -f chunk_list ]]; then
        while IFS= read -r LINE; do
            [[ -n "$LINE" ]] && JSON+="\"$LINE\", "
        done < chunk_list
    fi
    
    JSON+=' "current_large.json'"
    [[ "$ENABLE_COMPRESSION" == "yes" ]] && JSON+='.gz'
    JSON+='", "current_small.json'
    [[ "$ENABLE_COMPRESSION" == "yes" ]] && JSON+='.gz'
    JSON+='" ],'
    
    JSON+=' "chunks_all": [ '
    if [[ -f chunk_list_all ]]; then
        while IFS= read -r LINE; do
            [[ -n "$LINE" ]] && JSON+="\"$LINE\", "
        done < chunk_list_all
    fi
    
    JSON+=' "current_large.json'
    [[ "$ENABLE_COMPRESSION" == "yes" ]] && JSON+='.gz'
    JSON+='", "current_small.json'
    [[ "$ENABLE_COMPRESSION" == "yes" ]] && JSON+='.gz'
    JSON+='" ]'
    JSON+=' }'
    
    echo "$JSON" > "$RUN_DIR/chunks.json"
}

# Prune aircraft.json to essential fields only
prune() {
    local input="$1"
    local output="$2"
    
    # Extract only essential fields to reduce size
    # Matches upstream format: hex, altitude, speed, track, lat, lon, seen_pos, type, flight, messages
    jq -c '
    .aircraft |= map(select(has("seen") and .seen < '"$INTERVAL"' + 5))
    | .aircraft[] |= [.hex,
        (if .ground == true then "ground" 
         elif .alt_baro != null then .alt_baro 
         elif .altitude != null then .altitude 
         else .alt_geom end),
        (if .gs != null then .gs else .tas end),
        .track, .lat, .lon, .seen_pos,
        (if .mlat != null and (.mlat | contains(["lat"])) then "mlat"
         elif .tisb != null and (.tisb | contains(["lat"])) then "tisb" 
         else .type end),
        .flight, .messages]
    ' "$input" > "$output" 2>/dev/null || echo '{"aircraft":[]}' > "$output"
}

# Fetch aircraft data from source
fetch_aircraft() {
    local output="$1"
    local timeout=10
    
    if command -v curl >/dev/null 2>&1; then
        curl -fsSL --max-time "$timeout" "$SRC_URL" -o "$output" 2>/dev/null || return 1
    elif command -v wget >/dev/null 2>&1; then
        wget -q --timeout="$timeout" -O "$output" "$SRC_URL" 2>/dev/null || return 1
    else
        print_error "Neither curl nor wget available"
        return 1
    fi
    
    # Validate JSON
    if ! jq empty "$output" 2>/dev/null; then
        return 1
    fi
    
    return 0
}

# Initialize
print_info "Initializing history..."
cd "$RUN_DIR"

# Cleanup any stale files
rm -f chunk_list chunk_list_all ./chunk_*.json ./chunk_*.json.gz ./current_*.json ./current_*.gz history_*.json latest_*.json 2>/dev/null || true

# Create empty chunk
echo '{ "files" : [] }' | compress > empty.json
newChunk empty.json

cp empty.json current_small.json
cp empty.json current_large.json

# Main loop
i=0
error_count=0
max_errors=5

print_info "History daemon running"

while true; do
    cd "$RUN_DIR"
    
    # Check if chunks.json exists (fatal if removed)
    if ! [[ -f chunks.json ]]; then
        print_error "chunks.json was corrupted or removed, restarting..."
        newChunk refresh
    fi
    
    # Ensure empty file exists
    if ! [[ -f empty.json ]]; then
        echo '{ "files" : [] }' | compress > empty.json
    fi
    
    timestamp=$(date +%s%3N)
    date_str=$(date '+%Y-%m-%d %H:%M:%S')
    
    # Fetch aircraft data
    if fetch_aircraft "aircraft_raw_${timestamp}.json"; then
        # Prune to essential fields
        if prune "aircraft_raw_${timestamp}.json" "history_${timestamp}.json"; then
            # Add comma for JSON array concatenation
            echo ',' >> "history_${timestamp}.json"
            
            error_count=0
            
            if (( i % 6 == 5 )); then
                # Every 6th iteration, create large chunk
                # Combine all history files into one large chunk
                {
                    echo '{ "files" : ['
                    cat history_*.json 2>/dev/null | sed '$ s/,$//'
                    echo ']}'
                } | compress > temp.json
                mv temp.json current_large.json
                cp empty.json current_small.json
                rm -f latest_*.json 2>/dev/null || true
            else
                # Create small chunk from recent data
                ln -sf "history_${timestamp}.json" "latest_${timestamp}.json" 2>/dev/null || true
                
                {
                    echo '{ "files" : ['
                    cat latest_*.json 2>/dev/null | sed '$ s/,$//'
                    echo ']}'
                } | compress > temp.json
                mv temp.json current_small.json
            fi
            
            i=$(( i + 1 ))
            
            # Create new chunk when we hit CHUNK_SIZE
            if (( i == CHUNK_SIZE )); then
                {
                    echo '{ "files" : ['
                    cat history_*.json 2>/dev/null | sed '$ s/,$//'
                    echo ']}'
                } | compress > temp.json
                newChunk temp.json
                cp empty.json current_small.json
                cp empty.json current_large.json
                i=0
                rm -f history_*.json latest_*.json 2>/dev/null || true
            fi
        fi
        
        # Cleanup raw file
        rm -f "aircraft_raw_${timestamp}.json"
    else
        error_count=$(( error_count + 1 ))
        if (( error_count >= max_errors )); then
            print_error "Failed to fetch aircraft.json $max_errors times. Check if decoder is running at $SRC_URL"
            error_count=0
        fi
    fi
    
    # Sleep until next interval
    sleep "$INTERVAL" &
    wait $! || true
done
