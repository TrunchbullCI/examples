#!/bin/sh
# Build the grader image and check the document-parser (LlamaParse) path
# against upstream ParseBench.
#
#   benchmarks/parsebench/parity/document-parser.sh [per-category]
#
# Requires tools/prepare.sh to have populated grader/rules. The check runs
# inside the grader image with networking disabled; it needs no documents,
# because LlamaParse results are built from the ground truth.
set -eu

PORT_DIR=$(cd "$(dirname "$0")/.." && pwd)
PER_CATEGORY=${1:-4}
PLATFORM=${PARITY_PLATFORM:-}
TAG=parsebench-grader:parity

"$PORT_DIR/tools/sync-grader.sh" --check
if [ -n "${PARITY_SKIP_BUILD:-}" ]; then
  # Reuse an existing image, but only if it was built from this context.
  for f in server.py build_index.py pins.json documents.json; do
    docker run --rm --network none "$TAG" cat "/opt/parsebench/$f" | cmp -s - "$PORT_DIR/grader/$f" || {
      echo "$TAG is stale ($f differs); rebuild without PARITY_SKIP_BUILD" >&2
      exit 1
    }
  done
else
  docker build ${PLATFORM:+--platform "$PLATFORM"} -t "$TAG" "$PORT_DIR/parsebench-pdf/grader"
fi

docker run --rm --network none ${PLATFORM:+--platform "$PLATFORM"} \
  -v "$PORT_DIR:/port:ro" -v "$PORT_DIR/parity:/report" \
  "$TAG" sh -euc '
    mkdir -p /tmp/rules
    for f in /port/grader/rules/*.jsonl.gz; do
      gzip -dc "$f" > "/tmp/rules/$(basename "$f" .gz)"
    done
    python -I /port/parity/document_parser.py --rules /tmp/rules --port /port \
      --per-category "$0" --report "/report/report-document-parser${1:+-$1}.json"
  ' "$PER_CATEGORY" "${PARITY_REPORT_SUFFIX:-}"
