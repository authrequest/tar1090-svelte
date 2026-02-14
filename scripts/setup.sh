#!/bin/bash
# setup.sh - Development environment setup for tar1090-svelte
# Replicates upstream install.sh functionality for Node.js/SvelteKit environment

set -e

echo "=== tar1090-svelte Development Setup ==="
echo

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to print status
print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

# Get project root
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "Project root: $PROJECT_ROOT"
echo

# Check Node.js version
echo "Checking Node.js..."
if command_exists node; then
    NODE_VERSION=$(node --version | cut -d'v' -f2)
    print_status "Node.js found: v$NODE_VERSION"
else
    print_error "Node.js not found. Please install Node.js 18+"
    echo "Visit: https://nodejs.org/"
    exit 1
fi

# Check pnpm
echo
echo "Checking pnpm..."
if command_exists pnpm; then
    PNPM_VERSION=$(pnpm --version)
    print_status "pnpm found: v$PNPM_VERSION"
else
    print_warning "pnpm not found. Installing..."
    if command_exists npm; then
        npm install -g pnpm
        print_status "pnpm installed successfully"
    else
        print_error "npm not found. Cannot install pnpm."
        exit 1
    fi
fi

# Install dependencies
echo
echo "Installing dependencies..."
if [ -f "pnpm-lock.yaml" ]; then
    pnpm install --frozen-lockfile
    print_status "Dependencies installed from lockfile"
else
    pnpm install
    print_status "Dependencies installed"
fi

# Setup environment file
echo
echo "Setting up environment..."
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        print_status "Created .env from .env.example"
        print_warning "Please edit .env and add your SENTRY_AUTH_TOKEN if building for production"
    else
        print_warning ".env.example not found. You may need to create .env manually"
    fi
else
    print_status ".env already exists"
fi

# Create necessary directories
echo
echo "Creating directories..."
mkdir -p static/data
mkdir -p static/vendor
print_status "Directories created"

# Check for upstream reference
echo
if [ -d "upstream-tar1090" ]; then
    print_status "upstream-tar1090 directory found (not tracked by git)"
else
    print_warning "upstream-tar1090 directory not found"
    echo "  You can clone it for reference:"
    echo "  git clone https://github.com/wiedehopf/tar1090.git upstream-tar1090"
fi

# Final status
echo
echo "=== Setup Complete ==="
echo
echo "Next steps:"
echo "  1. Edit .env file with your configuration"
echo "  2. Run: pnpm dev        (start development server)"
echo "  3. Run: pnpm build      (build for production)"
echo "  4. Run: ./scripts/update-db.sh  (download aircraft database)"
echo

print_status "tar1090-svelte is ready for development!"
