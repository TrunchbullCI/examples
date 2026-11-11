#!/bin/sh
# Copy the canonical grader context into both packages, or check that the
# copies are byte-identical (--check). Package roots cannot share a directory
# and grader contexts cannot reach outside their package, so each package
# carries its own copy; identical bytes give one context digest, one image
# build, and one grader deployment.
set -eu

PORT_DIR=$(cd "$(dirname "$0")/.." && pwd)
for package in parsebench-pdf parsebench-image; do
  if [ "${1:-}" = "--check" ]; then
    diff -r "$PORT_DIR/grader" "$PORT_DIR/$package/grader" > /dev/null || {
      echo "$package/grader differs from grader/; run tools/sync-grader.sh" >&2
      exit 1
    }
  else
    rm -rf "$PORT_DIR/$package/grader"
    mkdir -p "$PORT_DIR/$package"
    cp -R "$PORT_DIR/grader" "$PORT_DIR/$package/grader"
  fi
done
