#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${PROJECT_ROOT}"

fmt_bytes() {
    python3 -c "
b = $1
for unit in ['B', 'KB', 'MB', 'GB']:
    if b < 1024.0:
        print(f'{b:.2f} {unit}')
        break
    b /= 1024.0
else:
    print(f'{b:.2f} TB')
"
}

dir_size() {
    if [ -d "$1" ]; then
        du -sb "$1" 2>/dev/null | cut -f1
    else
        echo 0
    fi
}

file_size() {
    if [ -f "$1" ]; then
        stat -c%s "$1" 2>/dev/null || stat -f%z "$1" 2>/dev/null
    else
        echo 0
    fi
}

echo "=========================================================="
echo "          Plasmid Rust Workspace Build Metrics            "
echo "=========================================================="

echo ""
echo "[1] Measuring Build Times..."
# Incremental check
DEV_INC_START=$(date +%s%N)
cargo build --workspace --quiet
DEV_INC_END=$(date +%s%N)
DEV_INC_MS=$(( (DEV_INC_END - DEV_INC_START) / 1000000 ))

REL_INC_START=$(date +%s%N)
cargo build --workspace --release --quiet
REL_INC_END=$(date +%s%N)
REL_INC_MS=$(( (REL_INC_END - REL_INC_START) / 1000000 ))

echo "  - Dev Build (Incremental)    : ${DEV_INC_MS} ms"
echo "  - Release Build (Incremental): ${REL_INC_MS} ms"

echo ""
echo "[2] Final Core Artifacts (Release)"
CORE_SO="target/release/libplasmid_core.so"
CORE_RLIB="target/release/libplasmid_core.rlib"
FORMAT_RLIB="target/release/libplasmid_format.rlib"
SWARM_RLIB="target/release/libplasmid_swarm.rlib"

if [ -f "${CORE_SO}" ]; then
    SO_SIZE=$(file_size "${CORE_SO}")
    SO_FMT=$(fmt_bytes "${SO_SIZE}")
    # Temporary strip calculation
    TMP_STRIP=$(mktemp)
    strip -s -o "${TMP_STRIP}" "${CORE_SO}" 2>/dev/null || cp "${CORE_SO}" "${TMP_STRIP}"
    STRIP_SIZE=$(file_size "${TMP_STRIP}")
    STRIP_FMT=$(fmt_bytes "${STRIP_SIZE}")
    rm -f "${TMP_STRIP}"
    echo "  - libplasmid_core.so         : ${SO_FMT} (${SO_SIZE} bytes) [stripped: ${STRIP_FMT}]"
fi

if [ -f "${CORE_RLIB}" ]; then
    RLIB_SIZE=$(file_size "${CORE_RLIB}")
    echo "  - libplasmid_core.rlib       : $(fmt_bytes "${RLIB_SIZE}") (${RLIB_SIZE} bytes)"
fi

if [ -f "${FORMAT_RLIB}" ]; then
    FR_SIZE=$(file_size "${FORMAT_RLIB}")
    echo "  - libplasmid_format.rlib     : $(fmt_bytes "${FR_SIZE}") (${FR_SIZE} bytes)"
fi

if [ -f "${SWARM_RLIB}" ]; then
    SR_SIZE=$(file_size "${SWARM_RLIB}")
    echo "  - libplasmid_swarm.rlib      : $(fmt_bytes "${SR_SIZE}") (${SR_SIZE} bytes)"
fi

echo ""
echo "[3] Target Directory & By-Product Breakdown"
TOTAL_TARGET=$(dir_size "target")
DEBUG_TOTAL=$(dir_size "target/debug")
DEBUG_DEPS=$(dir_size "target/debug/deps")
DEBUG_INC=$(dir_size "target/debug/incremental")
REL_TOTAL=$(dir_size "target/release")
REL_DEPS=$(dir_size "target/release/deps")

echo "  - Total target/ folder       : $(fmt_bytes "${TOTAL_TARGET}")"
echo "    ├─ target/debug (total)    : $(fmt_bytes "${DEBUG_TOTAL}")"
echo "    │   ├─ deps/               : $(fmt_bytes "${DEBUG_DEPS}")"
echo "    │   └─ incremental/        : $(fmt_bytes "${DEBUG_INC}")"
echo "    └─ target/release (total)  : $(fmt_bytes "${REL_TOTAL}")"
echo "        └─ deps/               : $(fmt_bytes "${REL_DEPS}")"

echo "=========================================================="
