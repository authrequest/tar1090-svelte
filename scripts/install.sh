#!/bin/bash
# tar1090-svelte Installation Script
# Adapted from upstream tar1090 install.sh for Node.js/SvelteKit deployment

set -e
set -o pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default configuration
INSTALL_DIR="/opt/tar1090-svelte"
REPO_URL="https://github.com/authrequest/tar1090-svelte"
DB_REPO="https://github.com/wiedehopf/tar1090-db"
NODE_VERSION_MIN="18"
SERVICE_USER="tar1090"
DATA_SOURCE="http://127.0.0.1:8080/data"

# Command line arguments
WEB_PORT="${1:-3000}"
INSTALL_PATH="${2:-$INSTALL_DIR}"
GIT_SOURCE="${3:-}"

print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_command() {
    command -v "$1" >/dev/null 2>&1
}

get_os_info() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$NAME
        VER=$VERSION_ID
    elif type lsb_release >/dev/null 2>&1; then
        OS=$(lsb_release -si)
        VER=$(lsb_release -sr)
    elif [ -f /etc/lsb-release ]; then
        . /etc/lsb-release
        OS=$DISTRIB_ID
        VER=$DISTRIB_RELEASE
    else
        OS=$(uname -s)
        VER=$(uname -r)
    fi
}

install_packages() {
    local packages=("$@")
    
    if [ ${#packages[@]} -eq 0 ]; then
        return 0
    fi
    
    print_info "Installing required packages: ${packages[*]}"
    
    if check_command apt-get; then
        apt-get update -qq
        apt-get install -y --no-install-recommends "${packages[@]}"
    elif check_command yum; then
        yum install -y "${packages[@]}"
    elif check_command dnf; then
        dnf install -y "${packages[@]}"
    elif check_command pacman; then
        pacman -Sy --noconfirm "${packages[@]}"
    else
        print_error "Could not install packages. Please install manually: ${packages[*]}"
        exit 1
    fi
}

check_dependencies() {
    print_info "Checking dependencies..."
    
    local missing_packages=()
    
    # Check for basic tools
    if ! check_command git; then
        missing_packages+=("git")
    fi
    
    if ! check_command curl; then
        missing_packages+=("curl")
    fi
    
    if ! check_command jq; then
        missing_packages+=("jq")
    fi
    
    # Install missing basic packages
    if [ ${#missing_packages[@]} -gt 0 ]; then
        install_packages "${missing_packages[@]}"
    fi
    
    # Check for Node.js
    if check_command node; then
        local node_version
        node_version=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$node_version" -lt "$NODE_VERSION_MIN" ]; then
            print_error "Node.js version $node_version found, but version $NODE_VERSION_MIN or higher is required"
            print_info "Please upgrade Node.js or use a version manager like nvm"
            exit 1
        fi
        print_info "Node.js $(node -v) found"
    else
        print_warn "Node.js not found. Attempting to install..."
        install_nodejs
    fi
    
    # Check for pnpm
    if ! check_command pnpm; then
        print_warn "pnpm not found. Installing..."
        install_pnpm
    else
        print_info "pnpm $(pnpm -v) found"
    fi
}

install_nodejs() {
    get_os_info
    print_info "Installing Node.js for $OS..."
    
    if check_command apt-get; then
        # Debian/Ubuntu
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        apt-get install -y nodejs
    elif check_command yum || check_command dnf; then
        # RHEL/CentOS/Fedora
        curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
        if check_command dnf; then
            dnf install -y nodejs
        else
            yum install -y nodejs
        fi
    else
        print_error "Could not install Node.js automatically. Please install manually from https://nodejs.org/"
        exit 1
    fi
    
    print_info "Node.js $(node -v) installed successfully"
}

install_pnpm() {
    print_info "Installing pnpm..."
    curl -fsSL https://get.pnpm.io/install.sh | sh -
    
    # Source pnpm
    export PNPM_HOME="$HOME/.local/share/pnpm"
    export PATH="$PNPM_HOME:$PATH"
    
    print_info "pnpm $(pnpm -v) installed successfully"
}

create_user() {
    if ! id "$SERVICE_USER" &>/dev/null; then
        print_info "Creating service user: $SERVICE_USER"
        if check_command useradd; then
            useradd -r -s /bin/false -d "$INSTALL_PATH" -M "$SERVICE_USER"
        elif check_command adduser; then
            adduser --system --home "$INSTALL_PATH" --no-create-home --quiet "$SERVICE_USER"
        else
            print_warn "Could not create system user. Will run as current user."
            SERVICE_USER="$(whoami)"
        fi
    else
        print_info "Service user $SERVICE_USER already exists"
    fi
}

clone_repository() {
    print_info "Cloning tar1090-svelte repository..."
    
    if [ -n "$GIT_SOURCE" ]; then
        # Use local source
        print_info "Using local source: $GIT_SOURCE"
        if [ -d "$INSTALL_PATH" ]; then
            rm -rf "$INSTALL_PATH"
        fi
        cp -r "$GIT_SOURCE" "$INSTALL_PATH"
    else
        # Clone from GitHub
        if [ -d "$INSTALL_PATH/.git" ]; then
            print_info "Updating existing installation..."
            cd "$INSTALL_PATH"
            git fetch origin
            git reset --hard origin/master
        else
            if [ -d "$INSTALL_PATH" ]; then
                rm -rf "$INSTALL_PATH"
            fi
            git clone --depth 1 "$REPO_URL" "$INSTALL_PATH"
            cd "$INSTALL_PATH"
        fi
    fi
    
    chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_PATH" 2>/dev/null || true
}

install_dependencies() {
    print_info "Installing Node.js dependencies..."
    cd "$INSTALL_PATH"
    
    # Use pnpm to install dependencies
    pnpm install --frozen-lockfile
    
    chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_PATH/node_modules" 2>/dev/null || true
}

download_aircraft_db() {
    print_info "Downloading aircraft database..."
    
    local db_dir="$INSTALL_PATH/static/db"
    mkdir -p "$db_dir"
    
    # Download aircraft.csv.gz
    if curl -fsSL "https://github.com/wiedehopf/tar1090-db/raw/csv/aircraft.csv.gz" -o "$db_dir/aircraft.csv.gz.tmp"; then
        mv "$db_dir/aircraft.csv.gz.tmp" "$db_dir/aircraft.csv.gz"
        print_info "Aircraft database downloaded successfully"
    else
        print_warn "Could not download aircraft database. Will use online fallback."
        rm -f "$db_dir/aircraft.csv.gz.tmp"
    fi
    
    # Download type cache
    if curl -fsSL "https://raw.githubusercontent.com/wiedehopf/tar1090-db/master/icao_aircraft_types2.js" -o "$db_dir/icao_aircraft_types2.js.tmp"; then
        mv "$db_dir/icao_aircraft_types2.js.tmp" "$db_dir/icao_aircraft_types2.js"
        print_info "Aircraft type cache downloaded successfully"
    else
        print_warn "Could not download aircraft type cache."
        rm -f "$db_dir/icao_aircraft_types2.js.tmp"
    fi
}

configure_environment() {
    print_info "Configuring environment..."
    
    cd "$INSTALL_PATH"
    
    # Create .env file if it doesn't exist
    if [ ! -f ".env" ]; then
        if [ -f ".env.example" ]; then
            cp .env.example .env
            print_info "Created .env from .env.example"
        else
            # Create minimal .env
            cat > .env << EOF
# Aircraft data source (readsb/dump1090-fa)
AIRCRAFT_ZST_REMOTE_URL=$DATA_SOURCE

# Aircraft database (optional - for local db file)
# AIRCRAFT_DB_REMOTE_BASE_URL=http://127.0.0.1:8080

# Sentry configuration (optional)
# PUBLIC_SENTRY_DSN=your-sentry-dsn-here
# PUBLIC_SENTRY_ENABLED=true
EOF
            print_info "Created minimal .env file"
        fi
    fi
    
    # Update data source in .env
    if [ -n "$DATA_SOURCE" ]; then
        if grep -q "AIRCRAFT_ZST_REMOTE_URL" .env; then
            sed -i "s|AIRCRAFT_ZST_REMOTE_URL=.*|AIRCRAFT_ZST_REMOTE_URL=$DATA_SOURCE|" .env
        else
            echo "AIRCRAFT_ZST_REMOTE_URL=$DATA_SOURCE" >> .env
        fi
    fi
    
    chown "$SERVICE_USER:$SERVICE_USER" .env 2>/dev/null || true
}

build_application() {
    print_info "Building application..."
    
    cd "$INSTALL_PATH"
    
    # Run type check and build
    pnpm check
    pnpm build
    
    chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_PATH/build" 2>/dev/null || true
}

create_systemd_service() {
    print_info "Creating systemd service..."
    
    local service_file="/etc/systemd/system/tar1090-svelte.service"
    
    cat > "$service_file" << EOF
[Unit]
Description=tar1090-svelte Aircraft Tracking Interface
After=network.target

[Service]
Type=simple
User=$SERVICE_USER
WorkingDirectory=$INSTALL_PATH
ExecStart=/usr/bin/node build/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=$WEB_PORT

[Install]
WantedBy=multi-user.target
EOF
    
    systemctl daemon-reload
    systemctl enable tar1090-svelte.service
    
    print_info "Systemd service created and enabled"
}

setup_history_daemon() {
    print_info "Setting up history daemon..."
    
    local history_dir="/var/lib/tar1090-svelte/history"
    mkdir -p "$history_dir"
    chown "$SERVICE_USER:$SERVICE_USER" "$history_dir"
    
    # Copy history daemon script
    cp "$INSTALL_PATH/scripts/history-daemon.sh" /usr/local/bin/tar1090-svelte-history
    chmod +x /usr/local/bin/tar1090-svelte-history
    
    # Copy default config
    if [ ! -f /etc/default/tar1090-svelte-history ]; then
        cp "$INSTALL_PATH/scripts/default-history" /etc/default/tar1090-svelte-history
        # Update data source in default config
        sed -i "s|SRC_URL=.*|SRC_URL=$DATA_SOURCE/aircraft.json|" /etc/default/tar1090-svelte-history
    fi
    
    # Copy systemd service
    local service_file="/etc/systemd/system/tar1090-svelte-history.service"
    cp "$INSTALL_PATH/scripts/tar1090-svelte-history.service" "$service_file"
    
    # Update service file with correct paths
    sed -i "s|/opt/tar1090-svelte|$INSTALL_PATH|g" "$service_file"
    
    systemctl daemon-reload
    systemctl enable tar1090-svelte-history.service
    
    print_info "History daemon installed"
}

detect_data_source() {
    print_info "Detecting aircraft data source..."
    
    local sources=(
        "http://127.0.0.1:8080/data"
        "http://127.0.0.1:30053/data"
        "http://localhost:8080/data"
    )
    
    for source in "${sources[@]}"; do
        if curl -fsSL "$source/aircraft.json" -o /dev/null 2>/dev/null; then
            DATA_SOURCE="$source"
            print_info "Found data source at: $DATA_SOURCE"
            return 0
        fi
    done
    
    print_warn "Could not auto-detect data source. Using default: $DATA_SOURCE"
    print_info "Please update AIRCRAFT_ZST_REMOTE_URL in $INSTALL_PATH/.env if needed"
}

print_summary() {
    local ip_address
    ip_address=$(hostname -I | awk '{print $1}')
    
    echo ""
    echo "========================================"
    echo -e "${GREEN}tar1090-svelte Installation Complete!${NC}"
    echo "========================================"
    echo ""
    echo "Installation directory: $INSTALL_PATH"
    echo "Service user: $SERVICE_USER"
    echo "Web port: $WEB_PORT"
    echo ""
    echo "Access the interface at:"
    echo "  - Local: http://localhost:$WEB_PORT"
    echo "  - Network: http://$ip_address:$WEB_PORT"
    echo ""
    echo "Configuration files:"
    echo "  - App:       $INSTALL_PATH/.env"
    echo "  - History:   /etc/default/tar1090-svelte-history"
    echo ""
    echo "Main Service Commands:"
    echo "  - Start:   sudo systemctl start tar1090-svelte"
    echo "  - Stop:    sudo systemctl stop tar1090-svelte"
    echo "  - Restart: sudo systemctl restart tar1090-svelte"
    echo "  - Status:  sudo systemctl status tar1090-svelte"
    echo "  - Logs:    sudo journalctl -u tar1090-svelte -f"
    echo ""
    echo "History Daemon Commands:"
    echo "  - Start:   sudo systemctl start tar1090-svelte-history"
    echo "  - Stop:    sudo systemctl stop tar1090-svelte-history"
    echo "  - Status:  sudo systemctl status tar1090-svelte-history"
    echo "  - Logs:    sudo journalctl -u tar1090-svelte-history -f"
    echo ""
    echo "Update:"
    echo "  cd $INSTALL_PATH && sudo bash install.sh $WEB_PORT $INSTALL_PATH"
    echo ""
    echo "pTracks (coverage visualization):"
    echo "  http://$ip_address:$WEB_PORT/?pTracks"
    echo ""
    echo "========================================"
}

main() {
    print_info "Starting tar1090-svelte installation..."
    print_info "Install path: $INSTALL_PATH"
    print_info "Web port: $WEB_PORT"
    
    # Check if running as root for system-wide install
    if [ "$EUID" -ne 0 ] && [ -z "$GIT_SOURCE" ]; then
        print_error "Please run as root for system-wide installation"
        print_info "Usage: sudo bash install.sh [port] [install_path]"
        exit 1
    fi
    
    get_os_info
    print_info "Detected OS: $OS $VER"
    
    check_dependencies
    create_user
    clone_repository
    install_dependencies
    detect_data_source
    download_aircraft_db
    configure_environment
    build_application
    create_systemd_service
    setup_history_daemon
    
    # Start services
    print_info "Starting tar1090-svelte service..."
    systemctl start tar1090-svelte.service || true
    
    print_info "Starting history daemon..."
    systemctl start tar1090-svelte-history.service || true
    
    print_summary
}

# Run main function
main
