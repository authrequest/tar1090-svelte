#!/bin/bash
# build.sh - Production build script for tar1090-svelte
# Inspired by upstream cachebust.sh - adds cache busting to static assets

set -e

echo "=== tar1090-svelte Production Build ==="
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

# Check environment
if [ ! -f ".env.sentry-build-plugin" ]; then
    print_warning "Sentry build plugin config not found"
    echo "  Create .env.sentry-build-plugin with SENTRY_AUTH_TOKEN for source maps"
fi

# Clean previous build
echo "Cleaning previous build..."
if [ -d ".svelte-kit" ]; then
    rm -rf .svelte-kit/output
fi
if [ -d "build" ]; then
    rm -rf build
fi
print_status "Cleaned previous build"

# Run type checking
echo
print_info "Running type check..."
if pnpm check; then
    print_status "Type check passed"
else
    print_error "Type check failed"
    exit 1
fi

# Build for production
echo
print_info "Building for production..."
if pnpm build; then
    print_status "Build completed"
else
    print_error "Build failed"
    exit 1
fi

# Cache busting for static assets (inspired by upstream cachebust.sh)
echo
print_info "Applying cache busting to static assets..."

BUILD_DIR=".svelte-kit/output/client"
if [ ! -d "$BUILD_DIR" ]; then
    print_error "Build output not found at $BUILD_DIR"
    exit 1
fi

# Function to hash files and update references
hash_files() {
    local dir=$1
    local pattern=$2
    
    find "$dir" -name "$pattern" -type f | while read -r file; do
        # Calculate MD5 hash
        hash=$(md5sum "$file" | cut -d' ' -f1 | cut -c1-8)
        
        # Get filename and extension
        filename=$(basename "$file")
        name="${filename%.*}"
        ext="${filename##*.}"
        
        # Create new filename with hash
        newname="${name}.${hash}.${ext}"
        newpath="$(dirname "$file")/$newname"
        
        # Rename file
        mv "$file" "$newpath"
        
        echo "  $filename -> $newname"
    done
}

# Hash static assets in _app/immutable (SvelteKit's immutable assets)
if [ -d "$BUILD_DIR/_app/immutable" ]; then
    print_info "Processing immutable assets..."
    
    # Note: SvelteKit already includes content hashes in filenames
    # This is just for any additional static assets
    
    # Hash vendor files if they exist
    if [ -d "static/vendor" ]; then
        print_info "Processing vendor files..."
        hash_files "static/vendor" "*.js"
    fi
    
    print_status "Cache busting applied"
else
    print_warning "Immutable assets directory not found"
fi

# Build size summary
echo
print_info "Build size summary:"
if command_exists du; then
    echo "  Total build size: $(du -sh "$BUILD_DIR" | cut -f1)"
    echo "  Client assets: $(du -sh "$BUILD_DIR/_app" 2>/dev/null | cut -f1 || echo 'N/A')"
fi

# Verify build integrity
echo
print_info "Verifying build integrity..."
if [ -f "$BUILD_DIR/_app/immutable/entry/start.*.js" ]; then
    print_status "Build integrity verified"
else
    print_error "Build integrity check failed - entry point not found"
    exit 1
fi

# Optional: Copy to deployment directory
if [ -n "$DEPLOY_DIR" ]; then
    echo
    print_info "Copying to deployment directory: $DEPLOY_DIR"
    mkdir -p "$DEPLOY_DIR"
    cp -r .svelte-kit/output/* "$DEPLOY_DIR/"
    print_status "Copied to $DEPLOY_DIR"
fi

echo
print_status "Production build complete!"
echo
echo "Output locations:"
echo "  - Client: .svelte-kit/output/client/"
echo "  - Server: .svelte-kit/output/server/"
echo
echo "To preview: pnpm preview"
echo "To deploy: Copy .svelte-kit/output to your web server"
