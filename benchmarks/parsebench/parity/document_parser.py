"""Score parity for the grader's document-parser (LlamaParse) path.

Runs inside the grader image with no network (see parity/document-parser.sh).
For a deterministic sample of PDF cases in every category it builds LlamaParse
parse results from the ground truth: the JSON body of
GET /api/v2/parse/{job_id}?expand=items&expand=text&expand=metadata&expand=debug_logs,
which Trunchbull sends to the grader. Each result is scored twice:

- Upstream path: LlamaParseProvider.run_inference for the llamaparse_*
  pipeline, with a stub LlamaCloud client whose parsing.get returns the SDK
  model validated from that JSON. run_inference dumps it the way upstream
  does, normalize() builds the InferenceResult, and EvaluationRunner scores
  the sample per group, as `parse-bench run` does.
- Grader path: POST /evaluate with the JSON in documentParser.result.

The grader score must equal the upstream per-example headline metric exactly,
and the mean of the grader's scores must equal upstream's avg_<metric>. The
check also confirms that the REST JSON and the SDK dump validate to the same
ParsingGetResponse, that responses carry details.system only on this path,
and that malformed documentParser requests are rejected with HTTP 400.
Writes a JSON report to --report.
"""

from __future__ import annotations

import argparse
import contextlib
import copy
import hashlib
import io
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parent))
from parity import CATEGORIES, INFERENCE_GROUP, KIND, outputs_for, strip_divs  # noqa: E402

EXPAND = ["items", "text", "metadata", "debug_logs"]
# Each style runs under one pipeline, so all three are exercised and each
# category's sample is one pipeline output directory, as `parse-bench run`.
STYLES = {
    "reference": "llamaparse_agentic",
    "degraded": "llamaparse_cost_effective",
    "plain": "llamaparse_agentic_plus",
    "empty": "llamaparse_agentic",
}
# Anthropic layout labels in the reference outputs, as LlamaParse V3 labels.
LLAMAPARSE_LABEL = {
    "Text": "text",
    "Title": "title",
    "Section-header": "section-header",
    "Picture": "picture",
    "Page-header": "page-header",
    "Page-footer": "page-footer",
    "Table": "table",
    "Formula": "formula",
}


def parse_result(job_id: str, style: str, text: str, width: float, height: float) -> dict:
    """A COMPLETED one-page LlamaParse result for a reference output."""
    from parse_bench.inference.providers.parse._layout_utils import parse_layout_blocks

    plain = strip_divs(text)
    items: list[dict] = []
    if style == "plain" and plain:
        items.append({"type": "text", "md": plain, "value": plain})
    for block in parse_layout_blocks(text) if style != "plain" else []:
        x1, y1, x2, y2 = block["bbox"]
        label = LLAMAPARSE_LABEL.get(block["label"], "text")
        body = block["text"]
        if label in ("title", "section-header"):
            md = ("# " if label == "title" else "## ") + body
            item = {"type": "heading", "level": 1 if label == "title" else 2, "md": md, "value": body}
        elif label == "table":
            md = body
            item = {"type": "table", "md": md, "html": body if body.startswith("<table") else "", "csv": "", "rows": []}
        else:
            md = body
            item = {"type": "text", "md": md, "value": body}
        item["bbox"] = [
            {
                "x": round(x1 * width / 1000, 2),
                "y": round(y1 * height / 1000, 2),
                "w": round((x2 - x1) * width / 1000, 2),
                "h": round((y2 - y1) * height / 1000, 2),
                "confidence": 0.9,
                "label": label,
                "start_index": 0,
                "end_index": len(md),
            }
        ]
        items.append(item)
    return {
        "job": {"id": job_id, "project_id": "parity", "status": "COMPLETED"},
        "items": {
            "pages": [
                {"page_number": 1, "page_width": width, "page_height": height, "success": True, "items": items}
            ]
        },
        "text": {"pages": [{"page_number": 1, "text": plain}]},
        "metadata": {"pages": [{"page_number": 1, "cost_optimized": False, "original_orientation_angle": 0}]},
        "result_content_metadata": {
            "debug_logs": {"size_bytes": 0, "exists": True, "presigned_url": "https://logs.invalid/debug.json"}
        },
    }


class StubParsing:
    def __init__(self, result: dict) -> None:
        self.result = result

    def create(self, **_: object) -> SimpleNamespace:
        return SimpleNamespace(id=self.result["job"]["id"])

    def wait_for_completion(self, job_id: str, **_: object) -> None:
        return None

    def get(self, job_id: str, expand: list[str]) -> object:
        from llama_cloud.types.parsing_get_response import ParsingGetResponse

        if expand != EXPAND:
            raise AssertionError(f"Unexpected expand {expand}")
        return ParsingGetResponse.model_validate(self.result)


def upstream_scores(
    style: str,
    sample: dict[str, list[str]],
    results: dict[tuple[str, str], dict],
    rows_by_category: dict[str, list[dict]],
    work: Path,
) -> tuple[dict[tuple[str, str], dict], dict[str, float | None]]:
    from parse_bench.analysis.aggregation_report import _DEFAULT_METRICS
    from parse_bench.evaluation.runner import EvaluationRunner
    from parse_bench.inference.pipelines import get_pipeline
    from parse_bench.inference.providers.parse.llamaparse import LlamaParseProvider
    from parse_bench.schemas.pipeline_io import InferenceRequest
    from parse_bench.schemas.product import ProductType

    root = work / style
    data_dir = root / "data"
    data_dir.mkdir(parents=True)
    for category in CATEGORIES:
        documents = set(sample[category])
        lines = [row["_line"] for row in rows_by_category[category] if row["pdf"] in documents]
        (data_dir / f"{category}.jsonl").write_text("".join(lines))

    # text_content and text_formatting share one inference result per
    # document upstream (text/<stem>), so each category gets its own
    # pipeline output directory.
    pipeline = get_pipeline(STYLES[style])

    def output_dir_for(category: str) -> Path:
        return root / "output" / category / pipeline.pipeline_name

    os.environ["LLAMA_CLOUD_API_KEY"] = "parity-stub-key-not-used"
    for category in CATEGORIES:
        for document in sample[category]:
            result = results[(category, document)]
            provider = LlamaParseProvider(pipeline.provider_name, pipeline.config)
            provider._new_client = lambda result=result: SimpleNamespace(parsing=StubParsing(result))
            source = work / "sources" / document
            source.parent.mkdir(parents=True, exist_ok=True)
            source.touch()
            test_id = f"{INFERENCE_GROUP.get(category, category)}/{Path(document).stem}"
            request = InferenceRequest(example_id=test_id, source_file_path=str(source), product_type=ProductType.PARSE)
            normalized = provider.normalize(provider.run_inference(pipeline, request))
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
            result = by_test_id[f"{INFERENCE_GROUP.get(category, category)}/{Path(document).stem}"]
            value = {m.metric_name: m.value for m in result.metrics}.get(metric)
            per_case[(category, document)] = {"success": result.success, "error": result.error, "value": value}
    return per_case, averages


def post(base: str, body: dict) -> tuple[int, dict]:
    request = urllib.request.Request(
        f"{base}/evaluate", data=json.dumps(body).encode(), headers={"content-type": "application/json"}
    )
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            return response.status, json.load(response)
    except urllib.error.HTTPError as error:
        return error.code, json.loads(error.read().decode() or "{}")


def evaluate_body(category: str, document: str, output: str, attachments: list[dict], parser: dict | None) -> dict:
    body = {
        "protocolVersion": 1,
        "caseId": f"{KIND[category]}.document-parser",
        "output": output,
        "caseData": {"document": document, "kind": KIND[category]},
        "attachments": attachments,
        "toolCalls": [],
        "finishReason": "stop",
        "usage": {"inputTokens": 0, "outputTokens": 0},
    }
    if parser is not None:
        body["documentParser"] = parser
    return body


def malformed_checks(base: str, category: str, document: str, record: dict, result: dict) -> list[dict]:
    """Requests the grader must reject with HTTP 400, plus the absent and null field."""
    pdf = [{"path": "documents/source", "mediaType": record["source"]["mediaType"], "sha256": record["source"]["sha256"]}]
    png = [
        {"path": f"documents/page-{i}.png", "mediaType": "image/png", "sha256": page["sha256"]}
        for i, page in enumerate(record["image"]["pages"])
    ]
    valid = {"provider": "llamaparse", "pipeline": "llamaparse_agentic", "result": result}
    no_job = {k: v for k, v in result.items() if k != "job"}
    failed = {**result, "job": {**result["job"], "status": "FAILED"}}
    bad_item = copy.deepcopy(result)
    bad_item["items"]["pages"][0]["items"] = [{"type": "text", "value": "no md"}]
    cases = [
        ("not an object", pdf, "llamaparse"),
        ("other provider", pdf, {**valid, "provider": "reducto"}),
        ("unknown pipeline", pdf, {**valid, "pipeline": "llamaparse_fast"}),
        ("non-llamaparse pipeline", pdf, {**valid, "pipeline": "anthropic_opus_5_5_parse_with_layout_file"}),
        ("missing pipeline", pdf, {"provider": "llamaparse", "result": result}),
        ("result not an object", pdf, {**valid, "result": [result]}),
        ("result without job", pdf, {**valid, "result": no_job}),
        ("failed job", pdf, {**valid, "result": failed}),
        ("schema-invalid item", pdf, {**valid, "result": bad_item}),
        ("png variant", png, valid),
    ]
    checks = []
    for name, attachments, parser in cases:
        status, response = post(base, evaluate_body(category, document, "", attachments, parser))
        checks.append({"name": name, "status": status, "error": response.get("error", "")[:200], "ok": status == 400})
    for name, attachments in (("absent", pdf), ("absent png", png)):
        status, response = post(base, evaluate_body(category, document, "", attachments, None))
        ok = status == 200 and "system" not in response.get("details", {})
        checks.append({"name": name, "status": status, "ok": ok})
    body = evaluate_body(category, document, "", pdf, None)
    body["documentParser"] = None
    status, response = post(base, body)
    absent_status, absent = post(base, evaluate_body(category, document, "", pdf, None))
    ok = status == absent_status == 200 and response["score"] == absent["score"] and "system" not in response["details"]
    checks.append({"name": "null is absent", "status": status, "ok": ok})
    return checks


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--rules", type=Path, required=True, help="Directory with the pinned dataset JSONL files")
    parser.add_argument("--port", type=Path, required=True, help="benchmarks/parsebench checkout")
    parser.add_argument("--per-category", type=int, default=4)
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--work", type=Path, default=Path("/tmp/document-parser-parity"))
    parser.add_argument("--server", type=Path, default=Path("/opt/parsebench/server.py"))
    args = parser.parse_args()

    global _is_infra_failure, _is_skipped_result
    from llama_cloud.types.parsing_get_response import ParsingGetResponse
    from parse_bench.evaluation.runner import _is_infra_failure, _is_skipped_result

    pins = json.loads((args.port / "grader" / "pins.json").read_text())
    documents = json.loads((args.port / "grader" / "documents.json").read_text())
    excluded = {
        entry["document"]
        for entry in json.loads((args.port / "provenance.json").read_text())["packages"]["parsebench-pdf"][
            "excludedDocuments"
        ]
    }

    rows_by_category: dict[str, list[dict]] = {}
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

    # Deterministic sample: single-page PDFs of the PDF package, ordered by a
    # hash of their path.
    sample: dict[str, list[str]] = {}
    for category in CATEGORIES:
        candidates = sorted(
            (
                doc
                for (cat, doc) in rows_by_case
                if cat == category
                and doc.endswith(".pdf")
                and doc not in excluded
                and len(documents[doc]["source"]["pages"]) == 1
            ),
            key=lambda doc: hashlib.sha256(doc.encode()).hexdigest(),
        )
        sample[category] = candidates[: args.per_category]

    server = subprocess.Popen([sys.executable, "-I", str(args.server)])
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
        "averages": [],
    }
    mismatches = 0
    first_result: dict | None = None
    for style, pipeline_name in STYLES.items():
        results: dict[tuple[str, str], dict] = {}
        texts: dict[tuple[str, str], str] = {}
        for category in CATEGORIES:
            for document in sample[category]:
                page = documents[document]["source"]["pages"][0]
                text = outputs_for(category, rows_by_case[(category, document)])[style]
                job_id = hashlib.sha256(f"{style}:{category}:{document}".encode()).hexdigest()[:32]
                result = parse_result(job_id, style, text, page["width"], page["height"])
                results[(category, document)] = result
                texts[(category, document)] = strip_divs(text)
                if first_result is None and style == "reference":
                    first_result = result
                model = ParsingGetResponse.model_validate(result)
                if ParsingGetResponse.model_validate(model.model_dump(mode="json", by_alias=True)) != model:
                    mismatches += 1
                    report["runs"].append({"style": style, "document": document, "sdkRoundTrip": False})

        upstream, averages = upstream_scores(style, sample, results, rows_by_category, args.work)
        for category in CATEGORIES:
            included: list[float] = []
            for document in sample[category]:
                record = documents[document]
                result = results[(category, document)]
                attachments = [
                    {
                        "path": "documents/source",
                        "mediaType": record["source"]["mediaType"],
                        "sha256": record["source"]["sha256"],
                        "sizeBytes": record["source"]["sizeBytes"],
                    }
                ]
                parser_field = {"provider": "llamaparse", "pipeline": pipeline_name, "result": result}
                status, response = post(
                    base, evaluate_body(category, document, texts[(category, document)], attachments, parser_field)
                )
                expected = upstream[(category, document)]
                outcome = SimpleNamespace(error=expected["error"])
                if expected["success"] and expected["value"] is not None:
                    want = expected["value"]
                elif not expected["success"] and not (_is_skipped_result(outcome) or _is_infra_failure(outcome)):
                    want = 0.0
                else:
                    want = None  # excluded from upstream's average; the grader scores 0
                got = response.get("score")
                details = response.get("details") or {}
                aggregation = details.get("aggregation")
                system_ok = details.get("system") == {"provider": "llamaparse", "pipeline": pipeline_name}
                match = status == 200 and got == (want if want is not None else 0.0) and system_ok
                if not match:
                    mismatches += 1
                if got is not None and aggregation in ("scored", "failed"):
                    included.append(got)
                report["runs"].append(
                    {
                        "style": style,
                        "category": category,
                        "document": document,
                        "pipeline": pipeline_name,
                        "upstream": expected,
                        "grader": {"status": status, "score": got, "aggregation": aggregation, "error": response.get("error")},
                        "exactMatch": match,
                    }
                )
            # Summation order can differ by an ulp, so the mean is compared
            # within 1e-12; per-case scores above are compared exactly.
            mean = sum(included) / len(included) if included else None
            upstream_average = averages[category]
            agrees = (mean is None and upstream_average is None) or (
                mean is not None and upstream_average is not None and abs(mean - upstream_average) <= 1e-12
            )
            report["averages"].append(
                {"style": style, "category": category, "upstreamAverage": upstream_average, "graderMean": mean, "agrees": agrees}
            )
            if not agrees:
                mismatches += 1

    category = "layout"
    document = sample[category][0]
    report["requestChecks"] = malformed_checks(base, category, document, documents[document], first_result)
    mismatches += sum(1 for check in report["requestChecks"] if not check["ok"])

    server.terminate()
    report["requests"] = len(report["runs"]) + len(report["requestChecks"])
    report["mismatches"] = mismatches
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, indent=1, sort_keys=True, ensure_ascii=False) + "\n")
    print(f"{report['requests']} grader requests, {mismatches} mismatches")
    return 1 if mismatches else 0


if __name__ == "__main__":
    raise SystemExit(main())
