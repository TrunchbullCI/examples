"""Write provenance.json from the pins, the prepare summary, and file hashes.

Run after tools/prepare.sh and tools/sync-grader.sh:

    python3 -I benchmarks/parsebench/tools/write_provenance.py

Every committed file under grader/ and each package's generated manifest is
hashed, so a reviewer can confirm the port is byte-for-byte what is recorded.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

PORT = Path(__file__).resolve().parent.parent


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def tree_digest(root: Path) -> tuple[str, int]:
    """sha256 over sorted (relative path, file sha256) lines."""
    lines = sorted(
        f"{path.relative_to(root).as_posix()}\t{sha256(path)}"
        for path in root.rglob("*")
        if path.is_file() and "__pycache__" not in path.parts
    )
    return hashlib.sha256("\n".join(lines).encode()).hexdigest(), len(lines)


def main() -> None:
    pins = json.loads((PORT / "grader" / "pins.json").read_text())
    summary = json.loads((PORT / "tools" / "prepare-summary.json").read_text())
    upstream_digest, upstream_files = tree_digest(PORT / "grader" / "upstream")
    grader_digest, grader_files = tree_digest(PORT / "grader")

    provenance = {
        "port": {
            "repository": "https://github.com/TrunchbullCI/examples",
            "path": "benchmarks/parsebench",
            "statement": (
                "Unofficial Trunchbull port of ParseBench. Not maintained by or affiliated with "
                "LlamaIndex, and not a replacement for the upstream project."
            ),
        },
        "upstream": {
            "code": {
                "url": pins["upstreamRepository"],
                "commit": pins["upstreamCommit"],
                "version": pins["upstreamVersion"],
                "license": "Apache-2.0",
                "vendoredPath": "grader/upstream",
                "vendoredFiles": upstream_files,
                "vendoredTreeSha256": upstream_digest,
                "modified": False,
            },
            "dataset": {
                "url": f"https://huggingface.co/datasets/{pins['dataset']}",
                "revision": pins["datasetRevision"],
                "declaredLicense": "Apache-2.0",
                "storage": (
                    "Dataset files (documents, renders, rule files) are never committed: tools/prepare.sh "
                    "regenerates them; in a Trunchbull Repository they are protected objects in R2 with "
                    "pointers in Git (.trunchbullignore)."
                ),
                "ruleFiles": {
                    name: {"path": f"grader/rules/{name}.jsonl.gz", "uncompressedSha256": digest,
                           "sha256": sha256(PORT / "grader" / "rules" / f"{name}.jsonl.gz")}
                    for name, digest in pins["rules"].items()
                },
            },
            "paper": "https://arxiv.org/abs/2604.08538",
            "attribution": (
                "Boyang Zhang, Sebastián G. Acosta, Preston Carlson, Sacha Bron, Pierre-Loïc Doulcet, "
                "Daniel B. Ospina, and Simon Suo. ParseBench: A Document Parsing Benchmark for AI Agents. "
                "arXiv:2604.08538, 2026. Copyright LlamaIndex."
            ),
        },
        "licensing": {
            "code": "Apache-2.0 (LICENSE.upstream)",
            "rules": "Apache-2.0 as declared by the dataset card; generated into grader/rules (protected), never committed",
            "documents": (
                "Third-party documents collected by the dataset authors from public online channels; "
                "no per-document license is recorded. Redistribution is not established, so documents "
                "and renders are not committed here and are protected files in a Trunchbull Repository."
            ),
            "publicMirror": False,
        },
        "cases": {
            "upstream": summary["upstreamCases"],
            "documents": summary["documents"],
            "rule": "one case per (category, document), as parse_bench.test_cases.loader._load_jsonl_dataset",
        },
        "packages": {
            name: {
                **details,
                "config": f"{name}/benchmark.config.ts",
                "manifest": {
                    "path": f"{name}/data/documents.jsonl",
                    "sha256": summary["documentsManifestSha256"][f"{name}/data/documents.jsonl"],
                },
            }
            for name, details in summary["packages"].items()
        },
        "multiPageDocuments": summary.get("multiPageDocuments", []),
        "rendering": {
            "tool": "tools/prepare.sh",
            "image": "python:3.12-slim-bookworm@sha256:935c3c5b12357a7e10caa9c1e6ca5692344d97cf229832ef584be2cec9fc03df",
            "platform": "linux/amd64",
            "renderer": "PyMuPDF 1.28.2, Pillow 11.1.0 (tools/requirements.lock, hashes from upstream uv.lock)",
            "pdf": "150 DPI, long edge capped at 2,000 px, RGB, no alpha",
            "images": "converted to RGB PNG, long edge capped at 2,000 px with Lanczos",
            "hashes": "grader/documents.json records each source sha256 and every page PNG sha256",
        },
        "grader": {
            "context": "grader",
            "copies": ["parsebench-pdf/grader", "parsebench-image/grader"],
            "treeSha256": grader_digest,
            "files": grader_files,
            "documentsJsonSha256": sha256(PORT / "grader" / "documents.json"),
            "pipelines": pins["pipelines"],
            "documentParsers": {
                "llamaparse": {
                    "pipelines": pins["parserPipelines"]["llamaparse"],
                    "packages": ["parsebench-pdf"],
                    "result": (
                        "GET /api/v2/parse/{job_id}?expand=items&expand=text&expand=markdown&expand=metadata"
                        "&expand=debug_logs for a COMPLETED job, from LlamaParse called by Trunchbull with the "
                        "user's stored LlamaCloud key"
                    ),
                    "normalize": (
                        "upstream LlamaParseProvider.normalize at the pinned commit, with each page's markdown "
                        "from the job's markdown expansion and the raw output saved without job, as in "
                        "upstream's published LlamaParse results"
                    ),
                }
            },
        },
    }
    (PORT / "provenance.json").write_text(json.dumps(provenance, indent=2, ensure_ascii=False) + "\n")


if __name__ == "__main__":
    main()
