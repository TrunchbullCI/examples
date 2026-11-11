#!/bin/sh
# Time the grader on the heaviest cases with the declared instance limits
# (standard-2: 1 vCPU, 6 GiB). Run parity/run.sh first to build the image.
#
#   benchmarks/parsebench/parity/latency.sh [per-category]
set -eu

PORT_DIR=$(cd "$(dirname "$0")/.." && pwd)
docker run --rm --network none --cpus 1 --memory 6g ${PARITY_PLATFORM:+--platform "$PARITY_PLATFORM"} \
  -v "$PORT_DIR:/port:ro" -v "$PORT_DIR/parity:/report" \
  parsebench-grader:parity sh -euc '
    mkdir -p /tmp/rules
    for f in /port/grader/rules/*.jsonl.gz; do
      gzip -dc "$f" > "/tmp/rules/$(basename "$f" .gz)"
    done
    python -I /port/parity/latency.py --rules /tmp/rules --port /port \
      --per-category "$0" --report /report/latency.json
  ' "${1:-4}"
