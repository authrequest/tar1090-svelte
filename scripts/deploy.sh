#!/bin/bash
# deploy.sh - Deploy tar1090-svelte to various platforms
# Supports: static hosting, Node.js server, Docker

set -e

echo "=== tar1090-svelte Deployment ==="
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

# Show usage
usage() {
    echo "Usage: $0 [TARGET]"
    echo
    echo "Targets:"
    echo "  static       Deploy to static hosting (requires adapter-static)"
    echo "  node         Deploy as Node.js application (requires adapter-node)"
    echo "  docker       Build and run Docker container"
    echo "  vercel       Deploy to Vercel"
    echo "  netlify      Deploy to Netlify"
    echo
    echo "Examples:"
    echo "  $0 static"
    echo "  $0 node"
    echo "  $0 docker"
    exit 1
}

# Check if build exists
check_build() {
    if [ ! -d ".svelte-kit/output" ] && [ ! -d "build" ]; then
        print_warning "No build found. Running build first..."
        ./scripts/build.sh
    fi
}

# Static deployment
deploy_static() {
    print_info "Deploying to static hosting..."
    
    # Check for adapter-static
    if ! grep -q "@sveltejs/adapter-static" package.json 2>/dev/null; then
        print_error "@sveltejs/adapter-static not found"
        echo "Install with: pnpm add -D @sveltejs/adapter-static"
        exit 1
    fi
    
    check_build
    
    # Static files are in build/ directory
    if [ -d "build" ]; then
        print_status "Static build ready in: build/"
        echo
        echo "To deploy:"
        echo "  - Copy build/ to your web server"
        echo "  - Or use: npx surge build/"
        echo "  - Or use: npx netlify deploy build/"
    else
        print_error "Static build not found"
        exit 1
    fi
}

# Node.js deployment
deploy_node() {
    print_info "Deploying as Node.js application..."
    
    # Check for adapter-node
    if ! grep -q "@sveltejs/adapter-node" package.json 2>/dev/null; then
        print_error "@sveltejs/adapter-node not found"
        echo "Install with: pnpm add -D @sveltejs/adapter-node"
        exit 1
    fi
    
    check_build
    
    if [ -d "build" ]; then
        print_status "Node.js build ready in: build/"
        echo
        echo "To run:"
        echo "  cd build && node index.js"
        echo
        echo "Environment variables:"
        echo "  PORT=3000                 (default port)"
        echo "  HOST=0.0.0.0             (default host)"
    else
        print_error "Node.js build not found"
        exit 1
    fi
}

# Docker deployment
deploy_docker() {
    print_info "Building Docker container..."
    
    if ! command -v docker >/dev/null 2>&1; then
        print_error "Docker not found. Please install Docker."
        exit 1
    fi
    
    check_build
    
    # Build Docker image
    if [ -f "Dockerfile" ]; then
        docker build -t tar1090-svelte:latest .
        print_status "Docker image built: tar1090-svelte:latest"
        echo
        echo "To run:"
        echo "  docker run -p 3000:3000 tar1090-svelte:latest"
        echo
        echo "With environment variables:"
        echo "  docker run -p 3000:3000 -e PUBLIC_SENTRY_DSN=your_dsn tar1090-svelte:latest"
    else
        print_warning "Dockerfile not found. Creating basic Dockerfile..."
        cat > Dockerfile << 'EOF'
FROM node:18-alpine
WORKDIR /app
COPY build/ ./
EXPOSE 3000
ENV PORT=3000
ENV HOST=0.0.0.0
CMD ["node", "index.js"]
EOF
        print_status "Dockerfile created. Run again to build."
    fi
}

# Vercel deployment
deploy_vercel() {
    print_info "Deploying to Vercel..."
    
    if ! command -v vercel >/dev/null 2>&1; then
        print_warning "Vercel CLI not found. Installing..."
        pnpm add -g vercel
    fi
    
    check_build
    
    # For Vercel, we need adapter-auto or adapter-vercel
    print_info "Deploying with Vercel CLI..."
    vercel --prod
}

# Netlify deployment
deploy_netlify() {
    print_info "Deploying to Netlify..."
    
    if ! command -v netlify >/dev/null 2>&1; then
        print_warning "Netlify CLI not found. Installing..."
        pnpm add -g netlify-cli
    fi
    
    check_build
    
    print_info "Deploying with Netlify CLI..."
    netlify deploy --prod --dir=build
}

# Main logic
TARGET=${1:-}

if [ -z "$TARGET" ]; then
    usage
fi

case "$TARGET" in
    static)
        deploy_static
        ;;
    node)
        deploy_node
        ;;
    docker)
        deploy_docker
        ;;
    vercel)
        deploy_vercel
        ;;
    netlify)
        deploy_netlify
        ;;
    *)
        print_error "Unknown target: $TARGET"
        usage
        ;;
esac

echo
print_status "Deployment preparation complete!"
