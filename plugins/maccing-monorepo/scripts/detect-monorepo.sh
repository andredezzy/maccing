#!/bin/bash
# Detects monorepo tool and discovers packages
# Usage: detect-monorepo.sh [start_dir]
# Output: JSON with tool, root, filter_syntax, packages

set -e

START_DIR="${1:-$(pwd)}"
CURRENT="$START_DIR"

# Find monorepo root by searching upward
find_root() {
    while [ "$CURRENT" != "/" ]; do
        # Priority 1: Turborepo
        if [ -f "$CURRENT/turbo.json" ]; then
            echo "turborepo:$CURRENT"
            return 0
        fi
        # Priority 2: Nx
        if [ -f "$CURRENT/nx.json" ]; then
            echo "nx:$CURRENT"
            return 0
        fi
        # Priority 3: pnpm
        if [ -f "$CURRENT/pnpm-workspace.yaml" ]; then
            echo "pnpm:$CURRENT"
            return 0
        fi
        # Priority 4/5: npm/yarn (check package.json for workspaces)
        if [ -f "$CURRENT/package.json" ]; then
            if grep -q '"workspaces"' "$CURRENT/package.json" 2>/dev/null; then
                # Detect yarn vs npm
                if [ -f "$CURRENT/yarn.lock" ]; then
                    echo "yarn:$CURRENT"
                else
                    echo "npm:$CURRENT"
                fi
                return 0
            fi
        fi
        CURRENT=$(dirname "$CURRENT")
    done
    echo "none:"
    return 1
}

# Get filter syntax for each tool
get_filter_syntax() {
    local tool="$1"
    case "$tool" in
        turborepo) echo "turbo run <task> --filter=<package>" ;;
        nx) echo "nx <target> <project>" ;;
        pnpm) echo "pnpm --filter <package> <script>" ;;
        npm) echo "npm run <script> -w <package>" ;;
        yarn) echo "yarn workspace <package> <script>" ;;
        *) echo "" ;;
    esac
}

# Discover packages based on tool
discover_packages() {
    local tool="$1"
    local root="$2"
    local packages="[]"

    case "$tool" in
        turborepo|pnpm|npm|yarn)
            # Find all package.json files in workspace directories
            packages=$(find "$root" -name "package.json" -not -path "*/node_modules/*" -not -path "$root/package.json" 2>/dev/null | while read -r pkg; do
                local dir=$(dirname "$pkg")
                local rel_path="${dir#$root/}"
                local name=$(jq -r '.name // empty' "$pkg" 2>/dev/null)
                local description=$(jq -r '.description // empty' "$pkg" 2>/dev/null)
                local scripts=$(jq -r '.scripts | keys | join(",")' "$pkg" 2>/dev/null || echo "")
                # Extract internal dependencies (workspace packages)
                local deps=$(jq -r '(.dependencies // {}) + (.devDependencies // {}) | keys | .[]' "$pkg" 2>/dev/null | grep -E '^@' | tr '\n' ',' | sed 's/,$//' || echo "")
                if [ -n "$name" ]; then
                    echo "{\"name\":\"$name\",\"path\":\"$rel_path\",\"description\":\"$description\",\"scripts\":\"$scripts\",\"dependencies\":\"$deps\"}"
                fi
            done | jq -s '.' 2>/dev/null || echo "[]")
            ;;
        nx)
            # Find all project.json files
            packages=$(find "$root" -name "project.json" -not -path "*/node_modules/*" 2>/dev/null | while read -r proj; do
                local dir=$(dirname "$proj")
                local rel_path="${dir#$root/}"
                local name=$(jq -r '.name // empty' "$proj" 2>/dev/null)
                local targets=$(jq -r '.targets | keys | join(",")' "$proj" 2>/dev/null || echo "")
                # Check for package.json in same dir for description
                local description=""
                if [ -f "$dir/package.json" ]; then
                    description=$(jq -r '.description // empty' "$dir/package.json" 2>/dev/null)
                fi
                if [ -n "$name" ]; then
                    echo "{\"name\":\"$name\",\"path\":\"$rel_path\",\"description\":\"$description\",\"scripts\":\"$targets\",\"dependencies\":\"\"}"
                fi
            done | jq -s '.' 2>/dev/null || echo "[]")
            ;;
    esac

    echo "$packages"
}

# Main
RESULT=$(find_root) || true
TOOL="${RESULT%%:*}"
ROOT="${RESULT#*:}"

if [ "$TOOL" = "none" ]; then
    echo '{"tool":null,"root":null,"filter_syntax":null,"packages":[]}'
    exit 0
fi

FILTER_SYNTAX=$(get_filter_syntax "$TOOL")
PACKAGES=$(discover_packages "$TOOL" "$ROOT")

jq -n \
    --arg tool "$TOOL" \
    --arg root "$ROOT" \
    --arg filter_syntax "$FILTER_SYNTAX" \
    --argjson packages "$PACKAGES" \
    '{tool: $tool, root: $root, filter_syntax: $filter_syntax, packages: $packages}'
