#!/bin/sh
# GUI-launched Herdr servers need not inherit the login shell's Node PATH.
node_path=$(command -v node 2>/dev/null) || node_path=
if [ -z "$node_path" ]; then
    for candidate in "$HOME/.local/bin/node" /opt/homebrew/bin/node /usr/local/bin/node; do
        if [ -x "$candidate" ]; then
            node_path=$candidate
            break
        fi
    done
fi
if [ -z "$node_path" ]; then
    echo 'ultra-herdr: Node.js not found; install Node.js 24 or newer.' >&2
    exit 127
fi
PATH="${node_path%/*}:$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:${PATH:-/usr/bin:/bin:/usr/sbin:/sbin}"
export PATH
exec "$node_path" "$@"
