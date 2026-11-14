#!/usr/bin/env bash
# Reproducible NCBI ClinVar (GRCh38) -> Zstd Hierarchical .plasmid Compiler Pipeline
# Enforces RFC-0001 (Zstd Codec + SHA-256 Merkle Tree) & RFC-0003 (Public Domain Governance)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
CACHE_DIR="${TMPDIR:-/tmp}"

CLINVAR_URL="https://ftp.ncbi.nlm.nih.gov/pub/clinvar/vcf_GRCh38/clinvar.vcf.gz"
CLINVAR_MD5_URL="https://ftp.ncbi.nlm.nih.gov/pub/clinvar/vcf_GRCh38/clinvar.vcf.gz.md5"

INPUT_VCF="${CLINVAR_VCF:-${CACHE_DIR}/clinvar.vcf.gz}"
OUTPUT_PLASMID="${1:-${REPO_ROOT}/apps/web/public/demo.plasmid}"
MAX_VARIANTS="${MAX_VARIANTS:-18000}"
MIN_STARS="${MIN_STARS:-2}"

if [[ ! -f "${INPUT_VCF}" ]]; then
  mkdir -p "$(dirname "${INPUT_VCF}")"
  echo "[clinvar-pack] Downloading official NCBI ClinVar GRCh38 VCF..."
  curl -fL --retry 3 "${CLINVAR_URL}" -o "${INPUT_VCF}"
  curl -fsSL "${CLINVAR_MD5_URL}" -o "${INPUT_VCF}.md5"
  EXPECTED_MD5="$(awk '{print $1}' "${INPUT_VCF}.md5")"
  ACTUAL_MD5="$(md5sum "${INPUT_VCF}" | awk '{print $1}')"
  if [[ "${EXPECTED_MD5}" != "${ACTUAL_MD5}" ]]; then
    echo "[clinvar-pack] ERROR: MD5 mismatch (expected ${EXPECTED_MD5}, got ${ACTUAL_MD5})" >&2
    exit 1
  fi
  echo "[clinvar-pack] Verified NCBI MD5 checksum: ${ACTUAL_MD5}"
fi

cd "${REPO_ROOT}"
echo "[clinvar-pack] Building Zstd hierarchical .plasmid pack from ${INPUT_VCF}..."
cargo run --release -p plasmid-cli -- clinvar-pack \
  --input "${INPUT_VCF}" \
  --output "${OUTPUT_PLASMID}" \
  --reference GRCh38 \
  --max-variants "${MAX_VARIANTS}" \
  --min-stars "${MIN_STARS}" \
  --entries-per-leaf 32

cargo run --release -p plasmid-cli -- verify "${OUTPUT_PLASMID}"
cargo run --release -p plasmid-cli -- inspect "${OUTPUT_PLASMID}"
