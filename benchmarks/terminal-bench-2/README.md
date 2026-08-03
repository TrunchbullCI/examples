# TerminalBench 2.0 verifier assets

This directory contains the binary verifier files that cannot be represented
losslessly in Trunchbull's generated text fixture. The operator importer reads
them from this independent examples repository, verifies their SHA-256 hashes,
and embeds them into the immutable compiled TerminalBench release.

Source: `https://github.com/harbor-framework/terminal-bench-2`

Pinned upstream revision: `2fd12b88aafdd04a52c298e3940bcb189f9766d6`

License: Apache-2.0. See `LICENSE.upstream`.

These files are verifier inputs, not answers. Keep their paths aligned with the
upstream task directories and regenerate the parent repository's Harbor fixture
when changing the pinned upstream revision.
