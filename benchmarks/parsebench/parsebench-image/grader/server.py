"""Trunchbull grader container for the ParseBench port.

Implements the grader protocol (protocolVersion 1) on port 8080:

- GET /health returns 200 once upstream ParseBench is imported and warmed.
- POST /evaluate scores one trial with upstream ParseBench's own code.

For each request the server reproduces what `parse-bench run` does for one
document at upstream commit c38085d:

1. Builds the normalized InferenceResult with the pipeline's own provider:
   - Without `documentParser` (a model trial), the pipeline is the package's
     Anthropic parse-with-layout pipeline. The provider's raw output is built
     from the model's text exactly as AnthropicProvider.run_inference does
     (parse_layout_blocks over the text, with the page geometry upstream
     records), then AnthropicProvider.normalize() produces the result.
   - With `documentParser` (a LlamaParse trial, PDF only), the pipeline is
     the named llamaparse_* pipeline and the raw output is the parse job's
     expanded GET response as REST JSON, from LlamaParse called by Trunchbull
     with the user's stored LlamaCloud key. It gets the job_logs_url default
     LlamaParseProvider._parse_pdf adds, then LlamaParseProvider.normalize()
     produces the result, adjusted to match the LlamaParse results upstream
     publishes and scores its leaderboard from: page markdown is the job's
     markdown expansion when the result has one, each single-segment layout
     item keeps only its segment's markdown, and the saved raw output has no
     `job`, so layout is scored from the normalized layout pages. The
     `output` text is a rendering for people and is not scored.
2. Writes that result and the case's baked rule shard into a scratch
   directory laid out like upstream's output and dataset directories, under
   the pipeline's name.
3. Runs EvaluationRunner.run_evaluation with the CLI defaults for that case's
   group, and returns the group's headline metric as the score.

Nothing here talks to the network. Rules, geometry, and every dependency are
baked into the image; the attachment bytes are never sent to the grader.
"""

from __future__ import annotations

import contextlib
import io
import json
import os
import sys
import tempfile
import threading
from datetime import datetime
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

ROOT = Path("/opt/parsebench")
PORT = 8080
MAX_REQUEST_BYTES = 8_000_000
MAX_DETAILS_BYTES = 30_000

CASE_KINDS = {
    "chart": "chart",
    "layout": "layout",
    "table": "table",
    "text-content": "text_content",
    "text-formatting": "text_formatting",
}
INFERENCE_GROUP = {"text_content": "text", "text_formatting": "text"}

PINS = json.loads((ROOT / "pins.json").read_text())
INDEX: dict[str, dict[str, str]] = json.loads((ROOT / "index.json").read_text())
DOCUMENTS: dict[str, dict[str, Any]] = json.loads((ROOT / "documents.json").read_text())
LLAMAPARSE_PIPELINES: list[str] = PINS["parserPipelines"]["llamaparse"]

# Upstream imports. They are loaded once at startup so requests stay fast.
from parse_bench.analysis.aggregation_report import _DEFAULT_METRICS  # noqa: E402
from parse_bench.evaluation.runner import (  # noqa: E402
    EvaluationRunner,
    _is_infra_failure,
    _is_skipped_result,
)
from parse_bench.inference.pipelines import get_pipeline  # noqa: E402
from parse_bench.inference.providers.base import ProviderPermanentError  # noqa: E402
from parse_bench.inference.providers.parse._layout_utils import parse_layout_blocks  # noqa: E402
from parse_bench.inference.providers.parse.anthropic import AnthropicProvider  # noqa: E402
from parse_bench.inference.providers.parse.llamaparse import LlamaParseProvider  # noqa: E402
from parse_bench.inference.providers.parse.llamaparse_v2_normalization import _slice_segment_markdown  # noqa: E402
from parse_bench.schemas.pipeline_io import InferenceRequest, RawInferenceResult  # noqa: E402
from parse_bench.schemas.product import ProductType  # noqa: E402

EVALUATION_LOCK = threading.Lock()
READY = threading.Event()


class GradeError(Exception):
    """A request the grader cannot score; reported as HTTP 400."""


def headline_metric(category: str) -> str:
    return _DEFAULT_METRICS.get(category, "rule_pass_rate")


def resolve_case(request: dict[str, Any]) -> dict[str, Any]:
    if request.get("protocolVersion") != 1:
        raise GradeError("Unsupported grader protocol version.")
    case_data = request.get("caseData")
    if not isinstance(case_data, dict):
        raise GradeError("caseData must be an object.")
    document = case_data.get("document")
    category = CASE_KINDS.get(str(case_data.get("kind")))
    if not isinstance(document, str) or category is None:
        raise GradeError("caseData must name a ParseBench document and case kind.")
    shard = INDEX.get(category, {}).get(document)
    record = DOCUMENTS.get(document)
    if shard is None or record is None or category not in record["categories"]:
        raise GradeError(f"Unknown ParseBench case {category}:{document}.")

    attachments = request.get("attachments")
    if not isinstance(attachments, list) or not all(isinstance(a, dict) for a in attachments):
        raise GradeError("attachments must be a list of objects.")
    received = [(a.get("mediaType"), a.get("sha256")) for a in attachments]
    image_pages = [("image/png", page["sha256"]) for page in record["image"]["pages"]]
    source = [(record["source"]["mediaType"], record["source"]["sha256"])]
    if received == image_pages:
        variant, mode = "image", "parse_with_layout"
        geometry = record["image"]["pages"][0]
    elif received == source:
        variant, mode = "pdf", "parse_with_layout_file"
        geometry = record["source"]["pages"][0]
    else:
        raise GradeError("The trial attachments are not the pinned document for this case.")

    output = request.get("output")
    if output is None:
        output = ""
    if not isinstance(output, str):
        raise GradeError("output must be a string.")
    case = {
        "category": category,
        "document": document,
        "shard": ROOT / "cases" / category / shard,
        "variant": variant,
        "mode": mode,
        "width": geometry["width"],
        "height": geometry["height"],
        "pipeline": PINS["pipelines"][variant],
        "output": output,
        "parserResult": None,
    }
    parser = request.get("documentParser")
    if parser is not None:
        case.update(resolve_document_parser(parser, variant))
    return case


def resolve_document_parser(parser: Any, variant: str) -> dict[str, Any]:
    if not isinstance(parser, dict):
        raise GradeError("documentParser must be an object.")
    if parser.get("provider") != "llamaparse":
        raise GradeError('documentParser.provider must be "llamaparse".')
    name = parser.get("pipeline")
    if name not in LLAMAPARSE_PIPELINES or get_pipeline(name).provider_name != "llamaparse":
        raise GradeError(f"documentParser.pipeline must be one of {', '.join(LLAMAPARSE_PIPELINES)}.")
    result = parser.get("result")
    if not isinstance(result, dict):
        raise GradeError("documentParser.result must be an object.")
    # LlamaParseProvider only reads a result after wait_for_completion, which
    # raises for any other status, so upstream never scores an unfinished job.
    job = result.get("job")
    if not isinstance(job, dict) or job.get("status") != "COMPLETED":
        raise GradeError("documentParser.result must be the result of a COMPLETED LlamaParse job.")
    if variant != "pdf":
        raise GradeError("Document parsers are scored only on the PDF variant.")
    markdown = result.get("markdown")
    if markdown is not None and not (
        isinstance(markdown, dict)
        and isinstance(markdown.get("pages"), list)
        and all(
            isinstance(page, dict)
            and isinstance(page.get("page_number"), int)
            and isinstance(page.get("markdown") or "", str)
            for page in markdown["pages"]
        )
    ):
        raise GradeError("documentParser.result.markdown.pages must be objects with a page_number and markdown.")
    return {"pipeline": name, "parserResult": result}


def inference_result_json(case: dict[str, Any], test_id: str, source_path: Path) -> str:
    """Rebuild the normalized result `parse-bench inference` would save.

    Upstream sends each page of a document in its own request. A Trunchbull
    trial sends the whole document once, so the single response is recorded
    as page 0 with the first page's geometry. Only multi-page documents are
    affected (see provenance.json).
    """
    pipeline = get_pipeline(case["pipeline"])
    text = case["output"]
    raw_output = {
        "pages": [
            {
                "page_index": 0,
                "items": parse_layout_blocks(text),
                "raw_content": text,
                "width": case["width"],
                "height": case["height"],
            }
        ],
        "num_pages": 1,
        "model": pipeline.config.get("model"),
        "mode": case["mode"],
        "bbox_scale": 1000,
    }
    now = datetime.now()
    raw_result = RawInferenceResult(
        request=InferenceRequest(
            example_id=test_id,
            source_file_path=str(source_path),
            product_type=ProductType.PARSE,
        ),
        pipeline=pipeline,
        pipeline_name=pipeline.pipeline_name,
        product_type=ProductType.PARSE,
        raw_output=raw_output,
        started_at=now,
        completed_at=now,
        latency_in_ms=0,
    )
    # normalize() reads only its argument; skipping __init__ avoids creating an
    # API client, which needs a key and never runs here.
    provider = AnthropicProvider.__new__(AnthropicProvider)
    return provider.normalize(raw_result).model_dump_json(indent=2)


def parser_result_json(case: dict[str, Any], test_id: str, source_path: Path) -> str:
    """Rebuild the normalized result `parse-bench run <llamaparse pipeline>` would save.

    LlamaParseProvider.run_inference parses the whole PDF in one job and keeps
    the job's expanded GET response, dumped from the SDK model. Trunchbull
    sends the same response as REST JSON; normalize() re-validates either form
    with ParsingGetResponse, so both produce the same result.

    Upstream's published LlamaParse outputs differ from the public
    normalize() in three ways, all applied here. Page markdown is the job's
    markdown expansion when it was fetched (expand=markdown), rather than
    markdown rebuilt from items; without the expansion the items-based
    markdown stays. A layout item with a single layout segment keeps only that
    segment's slice of the item markdown, as _slice_segment_markdown cuts it.
    The raw output carries no `job`, which makes the layout adapter read the
    normalized layout pages instead of re-normalizing the raw items.
    """
    pipeline = get_pipeline(case["pipeline"])
    raw_output = dict(case["parserResult"])
    # The job_logs_url default LlamaParseProvider._parse_pdf adds.
    content_meta = raw_output.get("result_content_metadata")
    if isinstance(content_meta, dict):
        debug_meta = content_meta.get("debug_logs")
        if isinstance(debug_meta, dict) and debug_meta.get("exists"):
            presigned_url = debug_meta.get("presigned_url")
            if isinstance(presigned_url, str) and presigned_url:
                raw_output.setdefault("job_logs_url", presigned_url)
    now = datetime.now()
    raw_result = RawInferenceResult(
        request=InferenceRequest(
            example_id=test_id,
            source_file_path=str(source_path),
            product_type=ProductType.PARSE,
        ),
        pipeline=pipeline,
        pipeline_name=pipeline.pipeline_name,
        product_type=ProductType.PARSE,
        raw_output=raw_output,
        started_at=now,
        completed_at=now,
        latency_in_ms=0,
    )
    # As for AnthropicProvider, __init__ is skipped because it creates an API
    # client. normalize() reads only these two attributes __init__ sets.
    provider = LlamaParseProvider.__new__(LlamaParseProvider)
    provider._sdk_config = {
        key: value for key, value in pipeline.config.items() if key not in LlamaParseProvider._PROVIDER_ONLY_PARAMS
    }
    provider._credit_rate_usd = LlamaParseProvider.CREDIT_RATE_USD
    try:
        normalized = provider.normalize(raw_result)
    except ProviderPermanentError as error:
        raise GradeError(f"documentParser.result is not a LlamaParse parse result: {error}"[:2000]) from error

    output = normalized.output
    markdown_pages = (case["parserResult"].get("markdown") or {}).get("pages")
    if markdown_pages:
        page_markdown = {page["page_number"] - 1: page.get("markdown") or "" for page in markdown_pages}
        missing = [page.page_index + 1 for page in output.pages if page.page_index not in page_markdown]
        if missing:
            raise GradeError(f"documentParser.result.markdown has no page {missing[0]}.")
        output.pages = [page.model_copy(update={"markdown": page_markdown[page.page_index]}) for page in output.pages]
        output.markdown = "\n\n---\n\n".join(page.markdown for page in output.pages)
        output.layout_pages = [
            page.model_copy(update={"md": page_markdown.get(page.page_number - 1, page.md)})
            for page in output.layout_pages
        ]
    output.layout_pages = [page.model_copy(update={"items": segment_items(page.items)}) for page in output.layout_pages]
    normalized.raw_output = {key: value for key, value in normalized.raw_output.items() if key != "job"}
    return normalized.model_dump_json(indent=2)


def segment_items(items: list[Any]) -> list[Any]:
    """Cut the markdown of items LlamaParse split from one block down to each item's segment.

    LlamaParse returns a block that spans several layout regions as adjacent
    items with the block's whole markdown and one region each. Upstream's
    published results keep only the region's slice of that markdown in each
    item; an item whose markdown no neighbour shares keeps all of it.
    """
    sliced = []
    for index, item in enumerate(items):
        shared = any(
            0 <= other < len(items) and items[other].md == item.md for other in (index - 1, index + 1)
        )
        markdown = None
        if item.md and shared and len(item.layout_segments) == 1:
            markdown = _slice_segment_markdown(item.md, item.layout_segments[0])
        sliced.append(item if markdown is None else item.model_copy(update={"md": markdown}))
    return sliced


def evaluate(case: dict[str, Any]) -> dict[str, Any]:
    category = case["category"]
    with tempfile.TemporaryDirectory(prefix="parsebench-") as scratch:
        scratch_dir = Path(scratch)
        data_dir = scratch_dir / "data"
        output_dir = scratch_dir / "output" / case["pipeline"]
        data_dir.mkdir(parents=True)
        shard_file = case["shard"] / f"{category}.jsonl"
        (data_dir / f"{category}.jsonl").write_bytes(shard_file.read_bytes())

        stem = Path(case["document"]).stem
        test_id = f"{INFERENCE_GROUP.get(category, category)}/{stem}"
        result_path = output_dir / f"{test_id}.result.json"
        result_path.parent.mkdir(parents=True)
        build_result = inference_result_json if case["parserResult"] is None else parser_result_json
        result_path.write_text(build_result(case, test_id, data_dir / case["document"]))

        # Same arguments EvaluationCLI.run passes for `parse-bench run`.
        runner = EvaluationRunner(
            output_dir=output_dir,
            test_cases_dir=data_dir,
            multi_task=True,
            enable_teds=False,
            skip_rules=False,
            layout_ontology="basic",
            verified_only=False,
        )
        log = io.StringIO()
        with contextlib.redirect_stdout(log), contextlib.redirect_stderr(log):
            summary = runner.run_evaluation(
                product_type="parse",
                group=category,
                verbose=False,
                use_rich=False,
                max_workers=1,
            )
    system = None if case["parserResult"] is None else {"provider": "llamaparse", "pipeline": case["pipeline"]}
    return score_summary(category, summary, system)


def score_summary(category: str, summary: Any, system: dict[str, str] | None = None) -> dict[str, Any]:
    metric_name = headline_metric(category)
    results = summary.per_example_results
    if len(results) != 1:
        raise RuntimeError(f"Upstream produced {len(results)} results for one case.")
    result = results[0]
    metrics = {metric.metric_name: metric.value for metric in result.metrics}

    # Upstream aggregation (EvaluationRunner._aggregate_metrics): a successful
    # result contributes its metric value; a genuine failure is padded as 0;
    # skipped results and "harness" failures leave the denominator. Upstream
    # classifies some output-dependent, deterministic errors as harness
    # failures (an evaluator "Worker error:", e.g. a parse_with_layout result
    # with no layout wrappers for a layout case). Those score 0 here, marked
    # "excluded", so the trial still completes. Errors that are not tied to
    # the output (task timeouts, executor failures) are reported as grader
    # errors so the platform can retry.
    if result.success and metric_name in metrics:
        score, aggregation = float(metrics[metric_name]), "scored"
    elif result.success:
        score, aggregation = 0.0, "metric_absent"
    elif _is_skipped_result(result):
        score, aggregation = 0.0, "skipped"
    elif _is_infra_failure(result):
        if not (result.error or "").startswith("Worker error:"):
            raise RuntimeError(f"Upstream evaluation harness failure: {result.error}")
        score, aggregation = 0.0, "excluded"
    else:
        score, aggregation = 0.0, "failed"

    if not 0.0 <= score <= 1.0:
        raise RuntimeError(f"Upstream {metric_name} {score} is outside 0..1.")
    details: dict[str, Any] = {
        "upstreamCommit": PINS["upstreamCommit"],
        "datasetRevision": PINS["datasetRevision"],
        "category": category,
        "metric": metric_name,
        "aggregation": aggregation,
        "upstreamSuccess": result.success,
        "upstreamError": (result.error or None) and result.error[:500],
        "metrics": {k: v for k, v in sorted(metrics.items()) if isinstance(v, (int, float))},
    }
    if system is not None:
        details["system"] = system
    if len(json.dumps(details)) > MAX_DETAILS_BYTES:
        details["metrics"] = {metric_name: metrics.get(metric_name)}
    message = f"{metric_name}={score:.6f}" if aggregation == "scored" else f"{metric_name}: {aggregation}"
    return {"score": score, "passed": score >= 1.0, "message": message, "details": details}


class Handler(BaseHTTPRequestHandler):
    server_version = "parsebench-grader/1"

    def log_message(self, format: str, *args: Any) -> None:  # noqa: A002
        sys.stderr.write("%s %s\n" % (self.address_string(), format % args))

    def send_json(self, status: HTTPStatus, body: dict[str, Any]) -> None:
        payload = json.dumps(body).encode("utf-8")
        self.send_response(status)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self) -> None:  # noqa: N802
        if self.path != "/health":
            self.send_json(HTTPStatus.NOT_FOUND, {"error": "not found"})
        elif not READY.is_set():
            self.send_json(HTTPStatus.SERVICE_UNAVAILABLE, {"status": "warming"})
        else:
            self.send_json(HTTPStatus.OK, {"status": "ok", "upstreamCommit": PINS["upstreamCommit"]})

    def do_POST(self) -> None:  # noqa: N802
        if self.path != "/evaluate":
            self.send_json(HTTPStatus.NOT_FOUND, {"error": "not found"})
            return
        length = int(self.headers.get("content-length") or 0)
        if length <= 0 or length > MAX_REQUEST_BYTES:
            self.send_json(HTTPStatus.REQUEST_ENTITY_TOO_LARGE, {"error": "request size out of range"})
            return
        body = self.rfile.read(length)
        status, response = handle_evaluate(body)
        self.send_json(status, response)


def handle_evaluate(body: bytes) -> tuple[HTTPStatus, dict[str, Any]]:
    try:
        case = resolve_case(json.loads(body))
    except (GradeError, json.JSONDecodeError, UnicodeDecodeError) as error:
        return HTTPStatus.BAD_REQUEST, {"error": str(error)}
    try:
        with EVALUATION_LOCK:
            return HTTPStatus.OK, evaluate(case)
    except GradeError as error:
        return HTTPStatus.BAD_REQUEST, {"error": str(error)}
    except Exception as error:  # surfaced to the platform as a grading error
        return HTTPStatus.INTERNAL_SERVER_ERROR, {"error": f"{type(error).__name__}: {error}"[:2000]}


def warm_up() -> None:
    """Score one empty output so every upstream module is imported and hot."""
    document = next(iter(INDEX["text_content"]))
    record = DOCUMENTS[document]
    request = {
        "protocolVersion": 1,
        "caseId": "warm-up",
        "output": "",
        "caseData": {"document": document, "kind": "text-content"},
        "attachments": [{"mediaType": "image/png", "sha256": page["sha256"]} for page in record["image"]["pages"]],
    }
    status, response = handle_evaluate(json.dumps(request).encode())
    if status != HTTPStatus.OK:
        sys.stderr.write(f"Grader warm-up failed: {response}\n")
        os._exit(1)
    READY.set()


def main() -> None:
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    threading.Thread(target=warm_up, daemon=True).start()
    server.serve_forever()


if __name__ == "__main__":
    os.environ.setdefault("PYTHONHASHSEED", "0")
    main()
