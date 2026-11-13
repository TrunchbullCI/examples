"""Score parity for the grader's document-parser (LlamaParse) path.

Runs inside the grader image with no network (see parity/document-parser.sh),
on upstream's published LlamaParse runs from parity/fetch-published.sh:

- raw/<pipeline>/<category>.jsonl holds one record per LlamaParse job:
  raw_output is the job's expanded GET response (items, text, markdown,
  metadata, ...) without `job`, plus the usage counters upstream attaches,
  and output is upstream's own normalized result for that same job.
- results/<pipeline>/<category>.jsonl is the later run the leaderboard is
  scored from (leaderboard/results.yaml).

Three checks:

1. Same job. Every raw record is sent to POST /evaluate as documentParser.result
   in the REST form Trunchbull sends: the usage counters removed and a
   COMPLETED job added. Records fetched without the markdown expansion (the
   agentic and agentic_plus tables) exercise the items-based fallback. Its score is compared with the vendored evaluator
   (`parse-bench evaluation run`, as scripts/leaderboard/rescore.py runs it)
   scoring the record's published output. Every difference is explained by
   comparing the grader's normalized result with the published one.
2. Leaderboard. The vendored evaluator scores the results tier, and each
   dimension's 100 * average is compared with leaderboard.csv.
3. Requests. Malformed documentParser requests must be rejected with HTTP 400;
   absent and null documentParser fields are model trials.

Grader requests run on several server processes, each the image's server.py
on its own port. Writes a JSON report to --report and the two tables as
Markdown to stdout.
"""

from __future__ import annotations

import argparse
import contextlib
import copy
import csv
import json
import queue
import subprocess
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from parity import KIND  # noqa: E402

GRADER = Path("/opt/parsebench")
PIPELINES = {
    "llamaparse_cost_effective": "LlamaParse Cost Effective",
    "llamaparse_agentic": "LlamaParse Agentic",
    "llamaparse_agentic_plus": "LlamaParse Agentic Plus",
}
# scripts/leaderboard/common.py DIMENSIONS: column -> (group, metric).
DIMENSIONS = {
    "Tables": ("table", "grits_trm_composite"),
    "Charts": ("chart", "rule_pass_rate"),
    "Content_Faithfulness": ("text_content", "content_faithfulness"),
    "Semantic_Formatting": ("text_formatting", "semantic_formatting"),
    "Visual_Grounding": ("layout", "layout_element_rule_pass_rate"),
}
GROUPS_FOR_FILE = {"table": ["table"], "chart": ["chart"], "text": ["text_content", "text_formatting"], "layout": ["layout"]}
FILE_FOR_GROUP = {group: name for name, groups in GROUPS_FOR_FILE.items() for group in groups}
# Keys LlamaParseProvider._attach_usage_metadata adds to the saved raw output;
# they are not part of LlamaParse's response.
USAGE_KEYS = {
    "num_pages", "credits_used", "cost_usd", "cost_per_page_usd", "cost_optimized_pages", "input_tokens",
    "output_tokens", "total_tokens", "thinking_tokens", "input_tokens_per_page", "output_tokens_per_page",
    "token_usage", "job_id",
}
EXACT = 1e-9


def rest_payload(raw_output: dict, job_id: str) -> dict:
    payload = {key: value for key, value in raw_output.items() if key not in USAGE_KEYS}
    payload["job"] = {"id": job_id, "project_id": "parity", "status": "COMPLETED"}
    return payload


def evaluate_upstream(tier_dir: Path, rules: Path, group: str, report_dir: Path) -> list[dict]:
    """Per-example results of `parse-bench evaluation run` for one group."""
    command = [
        sys.executable, "-I", "-m", "parse_bench.cli", "evaluation", "run", str(tier_dir), "-t", str(rules),
        "-g", group, "-r", str(report_dir), "--force", "True", "--export_csv", "False",
        "--export_rule_csv", "False", "--export_markdown", "False", "--export_html", "False",
    ]
    process = subprocess.run(command, capture_output=True, text=True)
    report = report_dir / "_evaluation_report.json"
    if process.returncode != 0 or not report.exists():
        raise SystemExit(f"parse-bench evaluation run {tier_dir} {group} failed:\n{(process.stdout + process.stderr)[-2000:]}")
    return json.loads(report.read_text())


def explode(jsonl: Path, out_dir: Path) -> None:
    """One <test_id>.result.json per published record, as the results repo's explode.py."""
    for line in jsonl.open():
        if line.strip():
            test_id = json.loads(line)["request"]["example_id"]
            path = out_dir / f"{test_id}.result.json"
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(line)


def expected_score(result: dict, metric: str) -> tuple[float | None, str]:
    """The score upstream's average counts for one example, as the grader reports it."""
    from parse_bench.evaluation.runner import _is_infra_failure, _is_skipped_result
    from parse_bench.schemas.evaluation import EvaluationResult

    parsed = EvaluationResult.model_validate(result)
    value = {m.metric_name: m.value for m in parsed.metrics}.get(metric)
    if parsed.success:
        return (float(value), "scored") if value is not None else (0.0, "metric_absent")
    if _is_skipped_result(parsed):
        return None, "skipped"
    if _is_infra_failure(parsed):
        return None, "excluded"
    return 0.0, "failed"


def post(port: int, body: bytes) -> tuple[int, dict]:
    request = urllib.request.Request(
        f"http://127.0.0.1:{port}/evaluate", data=body, headers={"content-type": "application/json"}
    )
    try:
        with urllib.request.urlopen(request, timeout=600) as response:
            return response.status, json.load(response)
    except urllib.error.HTTPError as error:
        return error.code, json.loads(error.read().decode() or "{}")


def start_servers(count: int) -> list[subprocess.Popen]:
    servers = []
    for index in range(count):
        code = f"import sys; sys.path.insert(0, {str(GRADER)!r}); import server; server.PORT = {8080 + index}; server.main()"
        servers.append(subprocess.Popen([sys.executable, "-I", "-c", code]))
    for index in range(count):
        for _ in range(600):
            with contextlib.suppress(OSError):
                with urllib.request.urlopen(f"http://127.0.0.1:{8080 + index}/health", timeout=5) as response:
                    if response.status == 200:
                        break
            time.sleep(0.5)
        else:
            raise SystemExit(f"Grader on port {8080 + index} did not become healthy.")
    return servers


def first_difference(a: object, b: object, path: str = "") -> str | None:
    if isinstance(a, dict) and isinstance(b, dict):
        for key in sorted(set(a) | set(b)):
            if key not in a or key not in b:
                return f"{path}.{key} only in {'grader' if key in a else 'published'}"
            found = first_difference(a[key], b[key], f"{path}.{key}")
            if found:
                return found
        return None
    if isinstance(a, list) and isinstance(b, list):
        if len(a) != len(b):
            return f"{path} has {len(a)} entries in the grader result, {len(b)} published"
        for index, (x, y) in enumerate(zip(a, b)):
            found = first_difference(x, y, f"{path}[{index}]")
            if found:
                return found
        return None
    return None if a == b else path


def explain(server_module: object, pipeline: str, test_id: str, record: dict) -> str:
    """Why the grader's normalized result differs from the published one for the same job."""
    from parse_bench.schemas.pipeline_io import InferenceResult

    payload = rest_payload(record["raw_output"], "explain")
    ours = InferenceResult.model_validate_json(
        server_module.parser_result_json({"pipeline": pipeline, "parserResult": payload}, test_id, Path("/x/d.pdf"))
    ).output
    published = InferenceResult.model_validate(record).output
    our_pages = [page.markdown for page in ours.pages]
    published_pages = [page.markdown for page in published.pages]
    if our_pages != published_pages:
        lengths = ", ".join(f"{len(a)} vs {len(b)}" for a, b in zip(our_pages, published_pages))
        return f"page markdown: published output is not the job's markdown expansion (chars per page, grader vs published: {lengths})"
    difference = first_difference(
        [page.model_dump(mode="json") for page in ours.layout_pages],
        [page.model_dump(mode="json") for page in published.layout_pages],
        "layout_pages",
    )
    if difference:
        return f"layout items: published layout pages differ from items normalization at {difference}"
    return "normalized results are equal"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--rules", type=Path, required=True, help="Directory with the pinned dataset JSONL files")
    parser.add_argument("--published", type=Path, required=True, help="parity/fetch-published.sh directory")
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--servers", type=int, default=4)
    parser.add_argument("--work", type=Path, default=Path("/tmp/document-parser-parity"))
    args = parser.parse_args()

    sys.path.insert(0, str(GRADER))
    import server as server_module

    pins = server_module.PINS
    index = server_module.INDEX
    documents = server_module.DOCUMENTS
    document_for = {
        group: {Path(document).stem: document for document in index[group]} for group in index
    }

    # 1. Upstream scores for every published record, both tiers.
    upstream: dict[tuple[str, str, str], dict[str, dict]] = {}
    for tier in ("raw", "results"):
        for pipeline in PIPELINES:
            tier_dir = args.work / tier / pipeline
            for name in GROUPS_FOR_FILE:
                explode(args.published / tier / pipeline / f"{name}.jsonl", tier_dir)
            for group, metric in ((g, m) for g, m in DIMENSIONS.values()):
                report = evaluate_upstream(tier_dir, args.rules, group, args.work / "reports" / tier / pipeline / group)
                per = {r["test_id"]: r for r in report["per_example_results"]}
                upstream[(tier, pipeline, group)] = {
                    "avg": (report.get("aggregate_metrics") or {}).get(f"avg_{metric}"),
                    "per": {test_id: expected_score(r, metric) for test_id, r in per.items()},
                }
                print(f"upstream {tier} {pipeline} {group}: {upstream[(tier, pipeline, group)]['avg']}", flush=True)

    # 2. Grader scores for every raw record.
    servers = start_servers(args.servers)
    ports: queue.Queue[int] = queue.Queue()
    for i in range(args.servers):
        ports.put(8080 + i)

    def grade(body: bytes) -> tuple[int, dict]:
        port = ports.get()
        try:
            return post(port, body)
        finally:
            ports.put(port)

    grader: dict[tuple[str, str], dict[str, dict]] = {}
    records: dict[tuple[str, str], dict[str, int]] = {}
    with ThreadPoolExecutor(max_workers=args.servers) as pool:
        for pipeline in PIPELINES:
            for name, groups in GROUPS_FOR_FILE.items():
                futures = []
                path = args.published / "raw" / pipeline / f"{name}.jsonl"
                for line_number, line in enumerate(path.open()):
                    record = json.loads(line)
                    test_id = record["request"]["example_id"]
                    for group in groups:
                        document = document_for[group].get(test_id.split("/", 1)[1])
                        if document is None:
                            continue
                        source = documents[document]["source"]
                        body = {
                            "protocolVersion": 1,
                            "caseId": f"{KIND[group]}.{test_id}",
                            "output": "",
                            "caseData": {"document": document, "kind": KIND[group]},
                            "attachments": [
                                {
                                    "path": "documents/source",
                                    "mediaType": source["mediaType"],
                                    "sha256": source["sha256"],
                                    "sizeBytes": source["sizeBytes"],
                                }
                            ],
                            "documentParser": {
                                "provider": "llamaparse",
                                "pipeline": pipeline,
                                "result": rest_payload(record["raw_output"], f"{pipeline}-{test_id}"),
                            },
                        }
                        records.setdefault((pipeline, group), {})[test_id] = line_number
                        futures.append((group, test_id, pool.submit(grade, json.dumps(body).encode())))
                for group, test_id, future in futures:
                    status, response = future.result()
                    details = response.get("details") or {}
                    grader.setdefault((pipeline, group), {})[test_id] = {
                        "status": status,
                        "score": response.get("score"),
                        "aggregation": details.get("aggregation"),
                        "system": details.get("system"),
                        "error": response.get("error"),
                    }
                print(f"grader {pipeline} {name}: {len(futures)} requests", flush=True)

    # 3. Request checks.
    base_line = (args.published / "raw" / "llamaparse_agentic" / "layout.jsonl").open().readline()
    base_record = json.loads(base_line)
    base_test_id = base_record["request"]["example_id"]
    base_document = document_for["layout"][base_test_id.split("/", 1)[1]]
    request_checks = check_requests(base_document, documents[base_document], rest_payload(base_record["raw_output"], "checks"))

    for process in servers:
        process.terminate()

    # Same-job table.
    same_job = []
    failures = 0
    raw_lines: dict[tuple[str, str], list[str]] = {}
    for pipeline in PIPELINES:
        for column, (group, metric) in DIMENSIONS.items():
            want = upstream[("raw", pipeline, group)]["per"]
            got = grader[(pipeline, group)]
            rejected = {t: g for t, g in got.items() if g["status"] != 200}
            compared = [t for t in got if t in want and t not in rejected and want[t][0] is not None]
            diffs = []
            for test_id in compared:
                score = got[test_id]["score"]
                expected = want[test_id][0]
                if abs(score - expected) > EXACT or got[test_id]["system"] != {"provider": "llamaparse", "pipeline": pipeline}:
                    key = (pipeline, FILE_FOR_GROUP[group])
                    if key not in raw_lines:
                        raw_lines[key] = (args.published / "raw" / pipeline / f"{FILE_FOR_GROUP[group]}.jsonl").read_text().splitlines()
                    record = json.loads(raw_lines[key][records[(pipeline, group)][test_id]])
                    diffs.append(
                        {
                            "testId": test_id,
                            "grader": score,
                            "upstream": expected,
                            "diff": round(score - expected, 6),
                            "cause": explain(server_module, pipeline, test_id, record),
                        }
                    )
            unexplained = [d for d in diffs if d["cause"] == "normalized results are equal"]
            failures += len(unexplained)
            rejections = {}
            for g in rejected.values():
                rejections[g["error"]] = rejections.get(g["error"], 0) + 1
            same_job.append(
                {
                    "pipeline": pipeline,
                    "group": group,
                    "metric": metric,
                    "records": len(got),
                    "compared": len(compared),
                    "exact": len(compared) - len(diffs),
                    "maxAbsDiff": max((abs(d["diff"]) for d in diffs), default=0.0),
                    "upstreamMean": sum(want[t][0] for t in compared) / len(compared) if compared else None,
                    "graderMean": sum(got[t]["score"] for t in compared) / len(compared) if compared else None,
                    "upstreamAverage": upstream[("raw", pipeline, group)]["avg"],
                    "rejected": rejections,
                    "differences": sorted(diffs, key=lambda d: -abs(d["diff"])),
                }
            )
    raw_lines.clear()

    # Leaderboard table.
    with (args.published / "leaderboard.csv").open() as handle:
        rows = {row["Provider"]: row for row in csv.DictReader(handle)}
    leaderboard = []
    for pipeline, provider in PIPELINES.items():
        for column, (group, metric) in DIMENSIONS.items():
            entry = upstream[("results", pipeline, group)]
            dropped = sum(1 for value, _ in entry["per"].values() if value is None)
            score = None if dropped or entry["avg"] is None else f"{100.0 * float(entry['avg']):.2f}"
            published = rows[provider][column]
            if score != published:
                failures += 1
            leaderboard.append(
                {"pipeline": pipeline, "column": column, "group": group, "graderEvaluator": score, "leaderboardCsv": published, "dropped": dropped}
            )

    failures += sum(1 for check in request_checks if not check["ok"])
    report = {
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "upstreamCommit": pins["upstreamCommit"],
        "datasetRevision": pins["datasetRevision"],
        "publishedResults": "llamaindex/ParseBench-results@e0de8b2eb340e78e6ae692e40d94d06b7fa64aaa",
        "leaderboard": "run-llama/ParseBench@31a9ff1dec96f900869b785d8504d18f5035ebf8 leaderboard.csv",
        "graderRequests": sum(len(v) for v in grader.values()) + len(request_checks),
        "sameJob": same_job,
        "leaderboardCells": leaderboard,
        "requestChecks": request_checks,
        "failures": failures,
    }
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, indent=1, sort_keys=True, ensure_ascii=False) + "\n")
    print(markdown(report))
    return 1 if failures else 0


def check_requests(document: str, record: dict, result: dict) -> list[dict]:
    """Requests the grader must reject with HTTP 400, plus the absent and null field."""
    pdf = [{"path": "documents/source", "mediaType": record["source"]["mediaType"], "sha256": record["source"]["sha256"]}]
    png = [
        {"path": f"documents/page-{i}.png", "mediaType": "image/png", "sha256": page["sha256"]}
        for i, page in enumerate(record["image"]["pages"])
    ]
    valid = {"provider": "llamaparse", "pipeline": "llamaparse_agentic", "result": result}
    bad_item = copy.deepcopy(result)
    bad_item["items"]["pages"][0]["items"] = [{"type": "text", "value": "no md"}]
    other_page = copy.deepcopy(result)
    for page in other_page["markdown"]["pages"]:
        page["page_number"] += 1
    cases = [
        ("not an object", pdf, "llamaparse", None),
        ("other provider", pdf, {**valid, "provider": "reducto"}, None),
        ("unknown pipeline", pdf, {**valid, "pipeline": "llamaparse_fast"}, None),
        ("non-llamaparse pipeline", pdf, {**valid, "pipeline": "anthropic_opus_5_5_parse_with_layout_file"}, None),
        ("missing pipeline", pdf, {"provider": "llamaparse", "result": result}, None),
        ("result not an object", pdf, {**valid, "result": [result]}, None),
        ("result without job", pdf, {**valid, "result": {k: v for k, v in result.items() if k != "job"}}, None),
        ("failed job", pdf, {**valid, "result": {**result, "job": {**result["job"], "status": "FAILED"}}}, None),
        ("malformed markdown expansion", pdf, {**valid, "result": {**result, "markdown": {"pages": "page 1"}}}, "markdown"),
        ("markdown expansion without the page", pdf, {**valid, "result": other_page}, "no page 1"),
        ("schema-invalid item", pdf, {**valid, "result": bad_item}, None),
        ("png variant", png, valid, None),
    ]

    def body(attachments: list[dict], parser: object, include: bool = True) -> bytes:
        request = {
            "protocolVersion": 1,
            "caseId": "layout.document-parser",
            "output": "",
            "caseData": {"document": document, "kind": KIND["layout"]},
            "attachments": attachments,
        }
        if include:
            request["documentParser"] = parser
        return json.dumps(request).encode()

    checks = []
    for name, attachments, parser, mention in cases:
        status, response = post(8080, body(attachments, parser))
        error = response.get("error", "")
        ok = status == 400 and (mention is None or mention in error)
        checks.append({"name": name, "status": status, "error": error[:200], "ok": ok})
    for name, without in (
        ("no markdown expansion scores from items", {k: v for k, v in result.items() if k != "markdown"}),
        ("null markdown expansion scores from items", {**result, "markdown": None}),
    ):
        status, response = post(8080, body(pdf, {**valid, "result": without}))
        ok = status == 200 and response["details"].get("system") == {"provider": "llamaparse", "pipeline": "llamaparse_agentic"}
        checks.append({"name": name, "status": status, "ok": ok})
    absent_status, absent = post(8080, body(pdf, None, include=False))
    checks.append({"name": "absent", "status": absent_status, "ok": absent_status == 200 and "system" not in absent["details"]})
    status, response = post(8080, body(png, None, include=False))
    checks.append({"name": "absent png", "status": status, "ok": status == 200 and "system" not in response["details"]})
    status, response = post(8080, body(pdf, None))
    ok = status == absent_status == 200 and response["score"] == absent["score"] and "system" not in response["details"]
    checks.append({"name": "null is absent", "status": status, "ok": ok})
    return checks


def markdown(report: dict) -> str:
    def pct(value: float | None) -> str:
        return "n/a" if value is None else f"{100 * value:.2f}"

    lines = [
        "Same job: grader /evaluate with documentParser vs the vendored evaluator on the published output of the same LlamaParse job",
        "",
        "| Pipeline | Group | Docs | Exact | Max abs diff | Upstream mean | Grader mean | Rejected (400) |",
        "|---|---|---:|---:|---:|---:|---:|---:|",
    ]
    for row in report["sameJob"]:
        lines.append(
            f"| {row['pipeline'].removeprefix('llamaparse_')} | {row['group']} | {row['compared']} | {row['exact']} | "
            f"{row['maxAbsDiff']:.4f} | {pct(row['upstreamMean'])} | {pct(row['graderMean'])} | {sum(row['rejected'].values())} |"
        )
    lines += ["", "Leaderboard: results tier scored with the grader image's vendored evaluator vs leaderboard.csv", ""]
    lines += ["| Pipeline | " + " | ".join(DIMENSIONS) + " |", "|---|" + "---:|" * len(DIMENSIONS)]
    for pipeline in PIPELINES:
        cells = [c for c in report["leaderboardCells"] if c["pipeline"] == pipeline]
        lines.append(
            f"| {pipeline.removeprefix('llamaparse_')} | "
            + " | ".join(f"{c['graderEvaluator']} / {c['leaderboardCsv']}" for c in cells)
            + " |"
        )
    return "\n".join(lines)


if __name__ == "__main__":
    raise SystemExit(main())
