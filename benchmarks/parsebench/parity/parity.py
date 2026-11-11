"""Score parity between the grader container and upstream ParseBench.

Runs inside the grader image with no network (see parity/run.sh). For a
deterministic sample of cases in every category, it builds several reference
model outputs from the ground truth (faithful, degraded, plain markdown with
no layout wrappers, and empty) and scores each one twice:

- Upstream path: AnthropicProvider.run_inference, driven by a stub client that
  returns the reference text, reads the real document (the PDF for the pdf
  package, the rendered PNG for the image package). The normalized results are
  saved the way InferenceRunner does, and EvaluationRunner.run_evaluation
  scores the whole sample per group, as `parse-bench run` does. The dataset is
  the original pinned JSONL, filtered to the sampled documents.
- Grader path: POST /evaluate on the grader server, as BenchmarkAgent calls it.

The grader score must equal the upstream per-example headline metric exactly,
and the mean of the grader's scores must equal upstream's avg_<metric> for the
same sample. Writes a JSON report to --report.
"""

from __future__ import annotations

import argparse
import contextlib
import hashlib
import io
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path
from types import SimpleNamespace

CATEGORIES = ("chart", "layout", "table", "text_content", "text_formatting")
KIND = {
    "chart": "chart",
    "layout": "layout",
    "table": "table",
    "text_content": "text-content",
    "text_formatting": "text-formatting",
}
INFERENCE_GROUP = {"text_content": "text", "text_formatting": "text"}
STYLES = ("reference", "degraded", "plain", "empty")
LAYOUT_LABEL = {
    "Text": "Text",
    "Section": "Section-header",
    "Picture": "Picture",
    "Page-header": "Page-header",
    "Page-footer": "Page-footer",
    "Table": "Table",
}


def div(label: str, bbox: list[float], text: str) -> str:
    coords = ", ".join(str(round(value)) for value in bbox)
    return f'<div data-bbox="[{coords}]" data-label="{label}">\n{text}\n</div>'


def strip_divs(text: str) -> str:
    return re.sub(r"</?div[^>]*>", "", text).strip()


def rules_of(rows: list[dict]) -> list[dict]:
    return [{"type": row["type"], **json.loads(row["rule"])} for row in rows]


def reference_output(category: str, rows: list[dict]) -> str:
    """A faithful parse built from the ground truth of one case."""
    rules = rules_of(rows)
    if category == "table":
        return div("Table", [40, 60, 960, 940], rows[0]["expected_markdown"])
    if category == "chart":
        cells = [
            f"<tr><td>{' '.join(rule['labels'])}</td><td>{rule['value']}</td></tr>"
            for rule in rules
            if rule["type"] == "chart_data_point"
        ]
        return div("Table", [60, 80, 940, 900], "<table>\n" + "\n".join(cells) + "\n</table>")
    if category == "text_content":
        bag = next((rule["bag_of_sentence"] for rule in rules if "bag_of_sentence" in rule), {})
        sentences = list(bag) or [rule["sentence"] for rule in rules if "sentence" in rule]
        return "\n".join(div("Text", [80, 60 + i * 8, 920, 66 + i * 8], f"{s}.") for i, s in enumerate(sentences))
    if category == "text_formatting":
        parts: list[str] = []
        for index, rule in enumerate(rules):
            text = rule.get("text", "")
            kind = rule["type"]
            if kind == "is_title":
                label, body = ("Title" if rule.get("level", 1) == 1 else "Section-header"), text
            elif kind == "is_bold":
                label, body = "Text", f"**{text}**"
            elif kind == "is_italic":
                label, body = "Text", f"*{text}*"
            elif kind == "is_strikeout":
                label, body = "Text", f"~~{text}~~"
            elif kind == "is_sup":
                label, body = "Text", f"x<sup>{text}</sup>"
            elif kind == "is_sub":
                label, body = "Text", f"x<sub>{text}</sub>"
            elif kind == "is_underline":
                label, body = "Text", f"<u>{text}</u>"
            elif kind == "is_mark":
                label, body = "Text", f"<mark>{text}</mark>"
            elif kind == "is_latex":
                label, body = "Formula", rule.get("formula", "")
            elif kind == "is_code_block":
                label, body = "Text", f"```{rule.get('language', '')}\n{rule.get('code', '')}\n```"
            else:
                continue
            parts.append(div(label, [80, 40 + (index % 100) * 9, 920, 46 + (index % 100) * 9], body))
        return "\n".join(parts)
    if category == "layout":
        elements = sorted(
            (rule for rule in rules if rule["type"] == "layout"), key=lambda rule: rule.get("ro_index", 0)
        )
        parts = []
        for rule in elements:
            x, y, w, h = rule["bbox"]
            content = rule.get("content") or {}
            body = content.get("text") or content.get("html") or "[Figure: image]"
            label = LAYOUT_LABEL.get(rule.get("canonical_class", "Text"), "Text")
            parts.append(div(label, [x * 1000, y * 1000, (x + w) * 1000, (y + h) * 1000], body))
        return "\n".join(parts)
    raise ValueError(category)


def degraded_output(text: str) -> str:
    """Drop every third layout element and shift the remaining boxes."""
    blocks = re.findall(r"<div[\s\S]*?</div>", text)
    kept = [block for index, block in enumerate(blocks) if index % 3 != 1]

    def shift(match: re.Match[str]) -> str:
        values = [float(v) for v in match.group(1).split(",")]
        moved = [min(1000.0, value + 25) for value in values]
        return 'data-bbox="[' + ", ".join(str(round(v)) for v in moved) + ']"'

    return "\n".join(re.sub(r'data-bbox="\[([^\]]+)\]"', shift, block) for block in kept)


def outputs_for(category: str, rows: list[dict]) -> dict[str, str]:
    reference = reference_output(category, rows)
    return {
        "reference": reference,
        "degraded": degraded_output(reference),
        "plain": strip_divs(reference),
        "empty": "",
    }


class StubMessages:
    def __init__(self, text: str) -> None:
        self.text = text

    def create(self, **_: object) -> SimpleNamespace:
        usage = SimpleNamespace(
            input_tokens=0, output_tokens=0, cache_read_input_tokens=0, cache_creation_input_tokens=0
        )
        return SimpleNamespace(content=[SimpleNamespace(type="text", text=self.text)], usage=usage)


class StubClient:
    def __init__(self, text: str) -> None:
        self.messages = StubMessages(text)
        self.beta = SimpleNamespace(messages=StubMessages(text))


def upstream_scores(
    variant: str,
    style: str,
    sample: dict[str, list[str]],
    texts: dict[tuple[str, str], str],
    source_files: dict[str, Path],
    work: Path,
    pins: dict,
) -> tuple[dict[tuple[str, str], dict], dict[str, float | None]]:
    from parse_bench.analysis.aggregation_report import _DEFAULT_METRICS
    from parse_bench.evaluation.runner import EvaluationRunner
    from parse_bench.inference.pipelines import get_pipeline
    from parse_bench.inference.providers.parse.anthropic import AnthropicProvider
    from parse_bench.schemas.pipeline_io import InferenceRequest
    from parse_bench.schemas.product import ProductType

    pipeline = get_pipeline(pins["pipelines"][variant])
    root = work / f"{variant}-{style}"
    data_dir = root / "data"
    data_dir.mkdir(parents=True)

    # text_content and text_formatting share one inference result per
    # document upstream (text/<stem>), so each category's reference outputs go
    # in their own pipeline output directory.
    def output_dir_for(category: str) -> Path:
        return root / "output" / category / pipeline.pipeline_name

    for category in CATEGORIES:
        documents = set(sample[category])
        lines = [
            row["_line"]
            for row in rows_by_category[category]
            if row["pdf"] in documents
        ]
        (data_dir / f"{category}.jsonl").write_text("".join(lines))

    os.environ["ANTHROPIC_API_KEY"] = "parity-stub-key-not-used"
    for category in CATEGORIES:
        for document in sample[category]:
            provider = AnthropicProvider(pipeline.provider_name, pipeline.config)
            provider._client = StubClient(texts[(category, document)])
            test_id = f"{INFERENCE_GROUP.get(category, category)}/{Path(document).stem}"
            request = InferenceRequest(
                example_id=test_id,
                source_file_path=str(source_files[document]),
                product_type=ProductType.PARSE,
            )
            raw = provider.run_inference(pipeline, request)
            normalized = provider.normalize(raw)
            path = output_dir_for(category) / f"{test_id}.result.json"
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(normalized.model_dump_json(indent=2))

    per_case: dict[tuple[str, str], dict] = {}
    averages: dict[str, float | None] = {}
    for category in CATEGORIES:
        runner = EvaluationRunner(
            output_dir=output_dir_for(category),
            test_cases_dir=data_dir,
            multi_task=True,
            enable_teds=False,
            skip_rules=False,
            layout_ontology="basic",
            verified_only=False,
        )
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            summary = runner.run_evaluation(product_type="parse", group=category, use_rich=False)
        metric = _DEFAULT_METRICS.get(category, "rule_pass_rate")
        averages[category] = summary.aggregate_metrics.get(f"avg_{metric}")
        by_test_id = {result.test_id: result for result in summary.per_example_results}
        for document in sample[category]:
            test_id = f"{INFERENCE_GROUP.get(category, category)}/{Path(document).stem}"
            result = by_test_id[test_id]
            values = {m.metric_name: m.value for m in result.metrics}
            per_case[(category, document)] = {
                "success": result.success,
                "error": result.error,
                "value": values.get(metric),
            }
    return per_case, averages


def grader_score(base: str, case_id: str, category: str, document: str, text: str, attachments: list[dict]) -> dict:
    body = {
        "protocolVersion": 1,
        "caseId": case_id,
        "output": text,
        "caseData": {"document": document, "kind": KIND[category]},
        "attachments": attachments,
        "toolCalls": [],
        "finishReason": "stop",
        "usage": {"inputTokens": 0, "outputTokens": 0},
    }
    data = json.dumps(body).encode()
    request = urllib.request.Request(f"{base}/evaluate", data=data, headers={"content-type": "application/json"})
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        return {"httpStatus": error.code, "error": error.read().decode()[:500]}


rows_by_category: dict[str, list[dict]] = {}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--rules", type=Path, required=True, help="Directory with the pinned dataset JSONL files")
    parser.add_argument("--port", type=Path, required=True, help="benchmarks/parsebench checkout")
    parser.add_argument("--sources", type=Path, required=True, help="prepare.py cache directory")
    parser.add_argument("--per-category", type=int, default=8)
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--work", type=Path, default=Path("/tmp/parity"))
    args = parser.parse_args()

    global _is_infra_failure, _is_skipped_result
    from parse_bench.evaluation.runner import _is_infra_failure, _is_skipped_result

    pins = json.loads((args.port / "grader" / "pins.json").read_text())
    documents = json.loads((args.port / "grader" / "documents.json").read_text())

    rows_by_case: dict[tuple[str, str], list[dict]] = {}
    for category in CATEGORIES:
        content = (args.rules / f"{category}.jsonl").read_bytes()
        if hashlib.sha256(content).hexdigest() != pins["rules"][category]:
            raise SystemExit(f"{category}.jsonl does not match the pinned dataset file.")
        rows_by_category[category] = []
        for line in content.decode().splitlines(keepends=True):
            if not line.strip():
                continue
            row = json.loads(line)
            row["_line"] = line
            rows_by_category[category].append(row)
            rows_by_case.setdefault((row.get("category", category), row["pdf"]), []).append(row)

    # Deterministic sample: single-page documents ordered by a hash of their
    # path, plus every image-sourced document in the category's first slots.
    sample: dict[str, list[str]] = {}
    for category in CATEGORIES:
        candidates = sorted(
            (doc for (cat, doc) in rows_by_case if cat == category and len(documents[doc]["source"]["pages"]) == 1),
            key=lambda doc: hashlib.sha256(doc.encode()).hexdigest(),
        )
        images = [doc for doc in candidates if not doc.endswith(".pdf")][:1]
        sample[category] = images + [doc for doc in candidates if doc not in images][: args.per_category - len(images)]

    manifests = {
        variant: {
            json.loads(line)["document"]: json.loads(line)
            for line in (args.port / package / "data" / "documents.jsonl").read_text().splitlines()
            if line.strip()
        }
        for variant, package in (("pdf", "parsebench-pdf"), ("image", "parsebench-image"))
    }

    server = subprocess.Popen([sys.executable, "-I", "/opt/parsebench/server.py"])
    base = "http://127.0.0.1:8080"
    for _ in range(240):
        with contextlib.suppress(OSError):
            with urllib.request.urlopen(f"{base}/health", timeout=5) as response:
                if response.status == 200:
                    break
        time.sleep(0.5)
    else:
        raise SystemExit("Grader did not become healthy.")

    report: dict = {
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "upstreamCommit": pins["upstreamCommit"],
        "datasetRevision": pins["datasetRevision"],
        "sample": sample,
        "runs": [],
    }
    mismatches = 0
    for variant in ("pdf", "image"):
        package_root = args.port / ("parsebench-pdf" if variant == "pdf" else "parsebench-image")
        source_files: dict[str, Path] = {}
        for category in CATEGORIES:
            for document in sample[category]:
                if variant == "pdf":
                    cached = args.sources / "files" / hashlib.sha256(document.encode()).hexdigest()
                    target = args.work / "sources" / document
                    target.parent.mkdir(parents=True, exist_ok=True)
                    target.write_bytes(cached.read_bytes())
                    source_files[document] = target
                else:
                    source_files[document] = package_root / manifests["image"][document]["attachments"][0]["path"]

        for style in STYLES:
            texts = {
                (category, document): outputs_for(category, rows_by_case[(category, document)])[style]
                for category in CATEGORIES
                for document in sample[category]
            }
            upstream, averages = upstream_scores(
                variant, style, sample, texts, source_files, args.work, pins
            )
            for category in CATEGORIES:
                scores: list[float] = []
                included: list[float] = []
                for document in sample[category]:
                    record = documents[document]
                    if variant == "pdf":
                        attachments = [
                            {
                                "path": "documents/source",
                                "mediaType": record["source"]["mediaType"],
                                "sha256": record["source"]["sha256"],
                                "sizeBytes": record["source"]["sizeBytes"],
                            }
                        ]
                    else:
                        attachments = [
                            {
                                "path": f"documents/page-{i}.png",
                                "mediaType": "image/png",
                                "sha256": page["sha256"],
                                "sizeBytes": page["sizeBytes"],
                            }
                            for i, page in enumerate(record["image"]["pages"])
                        ]
                    response = grader_score(
                        base, f"{KIND[category]}.parity", category, document, texts[(category, document)], attachments
                    )
                    expected = upstream[(category, document)]
                    got = response.get("score")
                    aggregation = (response.get("details") or {}).get("aggregation")
                    outcome = SimpleNamespace(error=expected["error"])
                    if expected["success"] and expected["value"] is not None:
                        want = expected["value"]
                    elif not expected["success"] and not (
                        _is_skipped_result(outcome) or _is_infra_failure(outcome)
                    ):
                        want = 0.0
                    else:
                        want = None  # excluded from upstream's average; the grader scores 0
                    match = got == (want if want is not None else 0.0)
                    if not match:
                        mismatches += 1
                    if got is not None:
                        scores.append(got)
                        if aggregation in ("scored", "failed"):
                            included.append(got)
                    report["runs"].append(
                        {
                            "variant": variant,
                            "style": style,
                            "category": category,
                            "document": document,
                            "upstream": expected,
                            "grader": {
                                "score": got,
                                "aggregation": aggregation,
                                "error": response.get("error"),
                            },
                            "exactMatch": match,
                        }
                    )
                # Summation order can differ from upstream's by an ulp, so the
                # run-level mean is compared within 1e-12; per-case scores above
                # are compared exactly.
                mean = sum(included) / len(included) if included else None
                upstream_average = averages[category]
                agrees = (mean is None and upstream_average is None) or (
                    mean is not None and upstream_average is not None and abs(mean - upstream_average) <= 1e-12
                )
                report.setdefault("averages", []).append(
                    {
                        "variant": variant,
                        "style": style,
                        "category": category,
                        "upstreamAverage": upstream_average,
                        "graderMean": mean,
                        "agrees": agrees,
                    }
                )
                if not agrees:
                    mismatches += 1

    server.terminate()
    report["requests"] = len(report["runs"])
    report["mismatches"] = mismatches
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, indent=1, sort_keys=True, ensure_ascii=False) + "\n")
    print(f"{report['requests']} grader requests, {mismatches} mismatches")
    return 1 if mismatches else 0


if __name__ == "__main__":
    raise SystemExit(main())
