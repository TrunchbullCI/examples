#!/bin/sh
# Download, verify, and render the ParseBench documents with a pinned toolchain.
#
#   benchmarks/parsebench/tools/prepare.sh [cache-directory]
#
# The renderer runs in a digest-pinned linux/amd64 Python image with the
# hash-locked PyMuPDF and Pillow wheels from tools/requirements.lock, so the
# recorded PNG hashes are reproducible on any Docker host.
set -eu

PORT_DIR=$(cd "$(dirname "$0")/.." && pwd)
CACHE_DIR=${1:-"$PORT_DIR/.cache"}
mkdir -p "$CACHE_DIR"

IMAGE="python:3.12-slim-bookworm@sha256:935c3c5b12357a7e10caa9c1e6ca5692344d97cf229832ef584be2cec9fc03df"

docker run --rm --platform linux/amd64 \
  --user "$(id -u):$(id -g)" \
  -e HOME=/tmp -e PIP_DISABLE_PIP_VERSION_CHECK=1 -e PYTHONHASHSEED=0 \
  -v "$PORT_DIR:/port" -v "$CACHE_DIR:/cache" \
  "$IMAGE" sh -euc '
    python -m pip install --quiet --no-deps --require-hashes \
      --target /tmp/renderer -r /port/tools/requirements.lock
    PYTHONPATH=/tmp/renderer python /port/tools/prepare.py --port /port --cache /cache
  '
