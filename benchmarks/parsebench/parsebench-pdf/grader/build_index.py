"""Bake the ParseBench rules into per-case shards at image build time.

Upstream's loader (parse_bench.test_cases.loader._load_jsonl_dataset) turns
the five dataset JSONL files into one test case per (category, document).
This script writes the exact source lines of each such group, in their
original order, to its own shard so the server can hand upstream's loader a
one-case dataset per request. It then proves, with upstream's own loader,
that every shard yields the same test case as the full dataset does.

Runs once during `docker build`; it never touches the network.
"""

from __future__ import annotations

import gzip
import hashlib
import json
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path("/opt/parsebench")
CATEGORIES = ("chart", "layout", "table", "text_content", "text_formatting")


def shard_name(document: str) -> str:
    return hashlib.sha256(document.encode("utf-8")).hexdigest()[:24]


def main() -> int:
    pins = json.loads((ROOT / "pins.json").read_text())
    data_dir = ROOT / "data"
    data_dir.mkdir(parents=True, exist_ok=True)

    lines_by_case: dict[tuple[str, str], list[bytes]] = defaultdict(list)
    for category in CATEGORIES:
        content = gzip.decompress((ROOT / "rules" / f"{category}.jsonl.gz").read_bytes())
        digest = hashlib.sha256(content).hexdigest()
        if digest != pins["rules"][category]:
            raise SystemExit(f"{category}.jsonl hash {digest} does not match the pin.")
        (data_dir / f"{category}.jsonl").write_bytes(content)
        for line in content.splitlines(keepends=True):
            if not line.strip():
                continue
            row = json.loads(line)
            lines_by_case[(row.get("category", category), row["pdf"])].append(line)

    if len(lines_by_case) != pins["expectedCases"]:
        raise SystemExit(f"Expected {pins['expectedCases']} cases, found {len(lines_by_case)}.")

    index: dict[str, dict[str, str]] = {category: {} for category in CATEGORIES}
    for (category, document), lines in sorted(lines_by_case.items()):
        name = shard_name(document)
        shard = ROOT / "cases" / category / name
        shard.mkdir(parents=True, exist_ok=True)
        (shard / f"{category}.jsonl").write_bytes(b"".join(lines))
        index[category][document] = name
    (ROOT / "index.json").write_text(json.dumps(index, sort_keys=True, ensure_ascii=False))

    verify_against_upstream_loader(index)
    print(f"Indexed {len(lines_by_case)} ParseBench cases.")
    return 0


def verify_against_upstream_loader(index: dict[str, dict[str, str]]) -> None:
    from parse_bench.test_cases.loader import load_test_cases

    full = load_test_cases(root_dir=ROOT / "data", require_test_json=False, product_type=None)
    expected: dict[tuple[str, str], dict] = {}
    for test_case in full:
        dumped = test_case.model_dump(mode="json")
        expected[(test_case.group, Path(str(test_case.file_path)).name)] = strip_paths(dumped)

    checked = 0
    for category, documents in index.items():
        for document, name in documents.items():
            shard_dir = ROOT / "cases" / category / name
            loaded = load_test_cases(root_dir=shard_dir, require_test_json=False, product_type=None)
            if len(loaded) != 1:
                raise SystemExit(f"Shard {category}/{document} produced {len(loaded)} test cases.")
            reference = expected.get((category, Path(document).name))
            if reference is None or strip_paths(loaded[0].model_dump(mode="json")) != reference:
                raise SystemExit(f"Shard {category}/{document} differs from the full upstream load.")
            checked += 1
    if checked != len(full):
        raise SystemExit(f"Checked {checked} shards but upstream loaded {len(full)} test cases.")


def strip_paths(dumped: dict) -> dict:
    """Drop the absolute document path, the only field that depends on root_dir."""
    return {key: value for key, value in dumped.items() if key != "file_path"}


if __name__ == "__main__":
    sys.exit(main())
