"""Write each package's trunchbull.data.json from the generated dataset files.

Run after tools/prepare.sh and tools/sync-grader.sh:

    python3 -I benchmarks/parsebench/tools/write_data_manifests.py

Dataset files (documents/, grader/rules/) are never committed. The manifest
is committed instead: it pins every file's path, sha256 and size. Trunchbull's
official-Repository tooling verifies the regenerated files against it, commits
protected-object pointers in their place, and uploads the bytes to R2.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

PORT = Path(__file__).resolve().parent.parent
PACKAGES = ("parsebench-pdf", "parsebench-image")
DATA_DIRECTORIES = ("documents", "grader/rules")


def main() -> None:
    pins = json.loads((PORT / "grader" / "pins.json").read_text())
    for package in PACKAGES:
        root = PORT / package
        files = []
        for directory in DATA_DIRECTORIES:
            for path in sorted((root / directory).rglob("*")):
                if not path.is_file():
                    continue
                content = path.read_bytes()
                files.append(
                    {
                        "path": path.relative_to(root).as_posix(),
                        "sha256": hashlib.sha256(content).hexdigest(),
                        "sizeBytes": len(content),
                    }
                )
        if not files:
            raise SystemExit(f"{package} has no generated data; run tools/prepare.sh first.")
        manifest = {
            "schemaVersion": 1,
            "generator": "../tools/prepare.sh",
            "source": {
                "kind": "huggingface-dataset",
                "url": f"https://huggingface.co/datasets/{pins['dataset']}",
                "revision": pins["datasetRevision"],
            },
            "files": sorted(files, key=lambda file: file["path"]),
        }
        (root / "trunchbull.data.json").write_text(json.dumps(manifest, indent=1) + "\n")
        print(package, len(files), "files", sum(file["sizeBytes"] for file in files), "bytes")


if __name__ == "__main__":
    main()
