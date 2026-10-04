#!/usr/bin/env bash
#
# build-zip.sh — Automatically packages Hide The Annoying for Chrome Web Store
#

set -euo pipefail

# Ensure script runs from the repository root
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXT_DIR="${REPO_ROOT}/extension"
DIST_DIR="${REPO_ROOT}/dist"

echo "🔍 Validating extension files..."

# Check manifest
if [[ ! -f "${EXT_DIR}/manifest.json" ]]; then
  echo "❌ Error: manifest.json not found in ${EXT_DIR}"
  exit 1
fi

# Extract version from manifest.json
VERSION=$(node -e "console.log(require('${EXT_DIR}/manifest.json').version || '1.0.0')")
echo "📌 Detected version: v${VERSION}"

# Validate JavaScript syntax
echo "🧪 Running JavaScript syntax checks..."
node -c "${EXT_DIR}/background.js" \
        "${EXT_DIR}/content.js" \
        "${EXT_DIR}/lib/providers.js" \
        "${EXT_DIR}/lib/storage.js" \
        "${EXT_DIR}/popup/popup.js" \
        "${EXT_DIR}/options/options.js"
echo "✅ All JavaScript files passed syntax check."

# Prepare output directories
mkdir -p "${DIST_DIR}"

OUTPUT_ZIP="${REPO_ROOT}/hide-the-annoying.zip"
VERSIONED_ZIP="${DIST_DIR}/hide-the-annoying-v${VERSION}.zip"

# Clean any existing zips
rm -f "${OUTPUT_ZIP}" "${VERSIONED_ZIP}"

# Clean OS metadata
find "${EXT_DIR}" -name ".DS_Store" -type f -delete 2>/dev/null || true

echo "📦 Packaging extension..."

# Package directly from inside the extension directory so manifest.json is at root
(
  cd "${EXT_DIR}"
  zip -q -r "${OUTPUT_ZIP}" \
    manifest.json \
    background.js \
    content.js \
    content.css \
    icons \
    lib \
    popup \
    options \
    README.md \
    PRIVACY.md \
    -x "*.DS_Store" "*__MACOSX*" "*.git*"
)

# Duplicate to versioned release in dist/
cp "${OUTPUT_ZIP}" "${VERSIONED_ZIP}"

# Inspect and verify
ZIP_SIZE=$(du -h "${OUTPUT_ZIP}" | cut -f1 | tr -d ' ')
FILE_COUNT=$(unzip -l "${OUTPUT_ZIP}" | awk 'NR>3 && !/---/ && !/^$/ {count++} END {print count}')

echo ""
echo "=========================================================="
echo "🎉 Package Created Successfully!"
echo "=========================================================="
echo "  • Version:        v${VERSION}"
echo "  • Root Archive:   ${OUTPUT_ZIP} (${ZIP_SIZE})"
echo "  • Versioned:      ${VERSIONED_ZIP}"
echo "  • Total Files:    ${FILE_COUNT} files"
echo "=========================================================="
echo "✅ Ready for Chrome Web Store upload!"
