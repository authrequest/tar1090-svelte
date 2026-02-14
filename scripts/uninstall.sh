#!/bin/bash
# tar1090-svelte Uninstallation Script
# Removes tar1090-svelte installation completely

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

INSTALL_DIR="${1:-/opt/tar1090-svelte}"
SERVICE_NAME="tar1090-svelte"
SERVICE_USER="tar1090"

print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_info "tar1090-svelte Uninstaller"
print_info "==========================="
echo ""

# Confirm uninstallation
read -p "This will remove tar1090-svelte from $INSTALL_DIR. Are you sure? [y/N] " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_info "Uninstallation cancelled."
    exit 0
fi

# Stop and disable service
if command -v systemctl &>/dev/null; then
    if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
        print_info "Stopping $SERVICE_NAME service..."
        systemctl stop "$SERVICE_NAME" 2>/dev/null || true
    fi
    
    if systemctl is-enabled --quiet "$SERVICE_NAME" 2>/dev/null; then
        print_info "Disabling $SERVICE_NAME service..."
        systemctl disable "$SERVICE_NAME" 2>/dev/null || true
    fi
    
    # Remove service file
    if [ -f "/etc/systemd/system/$SERVICE_NAME.service" ]; then
        print_info "Removing systemd service file..."
        rm -f "/etc/systemd/system/$SERVICE_NAME.service"
        systemctl daemon-reload
    fi
fi

# Stop and disable history daemon
if command -v systemctl &>/dev/null; then
    if systemctl is-active --quiet "tar1090-svelte-history" 2>/dev/null; then
        print_info "Stopping tar1090-svelte-history service..."
        systemctl stop tar1090-svelte-history 2>/dev/null || true
    fi
    
    if systemctl is-enabled --quiet "tar1090-svelte-history" 2>/dev/null; then
        print_info "Disabling tar1090-svelte-history service..."
        systemctl disable tar1090-svelte-history 2>/dev/null || true
    fi
    
    # Remove service files
    rm -f /etc/systemd/system/tar1090-svelte-history.service
fi

# Remove history binary and config
rm -f /usr/local/bin/tar1090-svelte-history
rm -f /etc/default/tar1090-svelte-history

# Remove history data
if [ -d /var/lib/tar1090-svelte ]; then
    print_info "Removing history data..."
    rm -rf /var/lib/tar1090-svelte
fi

# Remove installation directory
if [ -d "$INSTALL_DIR" ]; then
    print_info "Removing installation directory: $INSTALL_DIR"
    rm -rf "$INSTALL_DIR"
else
    print_warn "Installation directory not found: $INSTALL_DIR"
fi

# Ask about removing user
if id "$SERVICE_USER" &>/dev/null; then
    read -p "Remove system user '$SERVICE_USER'? [y/N] " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_info "Removing user: $SERVICE_USER"
        if command -v userdel &>/dev/null; then
            userdel "$SERVICE_USER" 2>/dev/null || true
        elif command -v deluser &>/dev/null; then
            deluser "$SERVICE_USER" 2>/dev/null || true
        fi
    fi
fi

echo ""
print_info "Uninstallation complete!"
print_info "tar1090-svelte has been removed from your system."
