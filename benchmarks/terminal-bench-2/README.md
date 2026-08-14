# TerminalBench 2.0 verifier assets

This directory is the binary-artifact portion of the canonical TerminalBench
2.0 port. The official release contains one benchmark with 89 selectable task
cases; these files are the verifier inputs for the cases whose tests cannot be
represented losslessly in Trunchbull's generated text fixture.

The operator importer reads the assets from this independent examples
repository, verifies their SHA-256 hashes, and embeds them into the immutable
compiled release. The port does not provision containers or copy runtime
environments into the catalog: sandbox infrastructure is created per trial at
run time and is separate from benchmark provenance.

Source: `https://github.com/harbor-framework/terminal-bench-2`

Pinned upstream revision: `2fd12b88aafdd04a52c298e3940bcb189f9766d6`

License: Apache-2.0. See `LICENSE.upstream`.

These files are verifier inputs, not answers. Keep their paths aligned with the
upstream task directories. The pinned revision and per-file hashes are recorded
in `provenance.json`; regenerate the parent repository's Harbor fixture when
changing that revision.
