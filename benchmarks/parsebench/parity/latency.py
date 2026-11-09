"""Measure grader latency on the heaviest cases of each category.

Runs inside the grader image (see parity/latency.sh), normally with the
container limited to the declared instance type (standard-2: 1 vCPU, 6 GiB).
Picks the cases with the most rules (or the largest expected table) and posts
the faithful reference output from parity.py, timing each POST /evaluate
against the platform's 60 s grader request timeout.
"""

from __future__ import annotations

import argparse
import contextlib
import json
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import parity  # noqa: E402

GRADER_TIMEOUT_SECONDS = 60


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--rules", type=Path, required=True)
    parser.add_argument("--port", type=Path, required=True)
    parser.add_argument("--per-category", type=int, default=4)
    parser.add_argument("--report", type=Path, required=True)
    args = parser.parse_args()

    documents = json.loads((args.port / "grader" / "documents.json").read_text())
    rows: dict[tuple[str, str], list[dict]] = {}
    for category in parity.CATEGORIES:
        for line in (args.rules / f"{category}.jsonl").read_text().splitlines():
            if line.strip():
                row = json.loads(line)
                rows.setdefault((category, row["pdf"]), []).append(row)

    def weight(key: tuple[str, str]) -> int:
        category, _ = key
        if category == "table":
            return len(rows[key][0].get("expected_markdown") or "")
        return len(rows[key])

    picks = []
    for category in parity.CATEGORIES:
        keys = sorted((key for key in rows if key[0] == category), key=weight, reverse=True)
        picks += keys[: args.per_category]

    server = subprocess.Popen([sys.executable, "-I", "/opt/parsebench/server.py"])
    base = "http://127.0.0.1:8080"
    started = time.monotonic()
    for _ in range(600):
        with contextlib.suppress(OSError):
            with urllib.request.urlopen(f"{base}/health", timeout=5) as response:
                if response.status == 200:
                    break
        time.sleep(0.5)
    ready_seconds = time.monotonic() - started

    results = []
    for category, document in picks:
        record = documents[document]
        attachments = [
            {"mediaType": "image/png", "sha256": page["sha256"]} for page in record["image"]["pages"]
        ]
        text = parity.reference_output(category, rows[(category, document)])
        began = time.monotonic()
        response = parity.grader_score(base, "latency", category, document, text, attachments)
        elapsed = time.monotonic() - began
        results.append(
            {
                "category": category,
                "document": document,
                "rules": len(rows[(category, document)]),
                "outputChars": len(text),
                "seconds": round(elapsed, 3),
                "score": response.get("score"),
                "error": response.get("error"),
            }
        )
        print(f"{category:16} {elapsed:7.2f}s  {document}", flush=True)
    server.terminate()
    report = {
        "readySeconds": round(ready_seconds, 2),
        "graderTimeoutSeconds": GRADER_TIMEOUT_SECONDS,
        "maxSeconds": max(r["seconds"] for r in results),
        "overTimeout": [r for r in results if r["seconds"] >= GRADER_TIMEOUT_SECONDS],
        "results": results,
    }
    args.report.write_text(json.dumps(report, indent=1, ensure_ascii=False) + "\n")
    print(f"max {report['maxSeconds']}s, ready after {report['readySeconds']}s")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
