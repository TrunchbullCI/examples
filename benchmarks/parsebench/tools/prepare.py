"""Prepare the ParseBench port from the pinned Hugging Face dataset revision.

Run through tools/prepare.sh, which executes this script inside a
digest-pinned Python image with the hash-locked renderer in
tools/requirements.lock. The script is deterministic for a fixed dataset
revision, renderer, and base image:

1. Downloads every source document and rule file at DATASET_REVISION and
   verifies each one against the Hugging Face tree metadata (LFS sha256, or the
   Git blob sha1 for small files). Downloads are cached in --cache.
2. Groups rules into upstream test cases exactly as
   parse_bench.test_cases.loader._load_jsonl_dataset does: one case per
   (category, document). Text documents therefore yield separate
   text_content and text_formatting cases. The count must be 2,553.
3. Copies each referenced source document into parsebench-pdf/documents and
   renders every page into parsebench-image/documents as PNG at 150 DPI, with
   the long edge capped at 2,000 px. Documents over the platform's attachment
   limits are left out of the affected package and listed in the summary.
4. Writes the five rule files, gzip-compressed, to grader/rules/.
5. Writes each package's data/documents.jsonl (the transformer source) and the
   grader's documents.json (page geometry and attachment hashes). Run
   tools/sync-grader.sh afterwards to copy the grader into both packages.

Documents, renders, and rules are dataset files: they are never committed.
In a Trunchbull Repository they are protected objects (R2-backed pointers,
see .trunchbullignore). Rules live only in the grader context, which the
model can never read.
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import io
import json
import os
import re
import shutil
import sys
import unicodedata
import urllib.parse
import urllib.request
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor
from pathlib import Path

DATASET = "llamaindex/ParseBench"
DATASET_REVISION = "2805a1d940f95a203e0ae4b88be9934f7765b3fc"
CATEGORIES = ("chart", "layout", "table", "text_content", "text_formatting")
DOCUMENT_DIRECTORIES = ("chart", "layout", "table", "text")
EXPECTED_CASES = 2553

RENDER_DPI = 150
MAX_LONG_EDGE_PX = 2000
# Platform limits from packages/benchmark-contracts/src/attachments.ts
# (MAX_BENCHMARK_ATTACHMENT_BYTES, MAX_BENCHMARK_CASE_ATTACHMENTS,
# MAX_BENCHMARK_CASE_ATTACHMENT_BYTES). Larger documents cannot be attached.
MAX_ATTACHMENT_BYTES = 10_000_000
MAX_CASE_ATTACHMENTS = 8
MAX_CASE_ATTACHMENT_BYTES = 20_000_000

CASE_KIND = {
    "chart": "chart",
    "layout": "layout",
    "table": "table",
    "text_content": "text-content",
    "text_formatting": "text-formatting",
}
SOURCE_MEDIA_TYPES = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
}


def hub_url(path: str) -> str:
    quoted = urllib.parse.quote(path)
    return f"https://huggingface.co/datasets/{DATASET}/resolve/{DATASET_REVISION}/{quoted}"


def api_pages(url: str) -> list[dict]:
    """Follow the Hugging Face API's Link-header pagination."""
    items: list[dict] = []
    next_url: str | None = url
    while next_url:
        with urllib.request.urlopen(next_url, timeout=120) as response:
            items.extend(json.load(response))
            link = response.headers.get("Link") or ""
        match = re.search(r'<([^>]+)>;\s*rel="next"', link)
        next_url = match.group(1) if match else None
    return items


def tree_entries(cache: Path) -> dict[str, dict]:
    """Return Hugging Face tree metadata for the root and docs/ at the pin."""
    cached = cache / f"tree-{DATASET_REVISION}.json"
    if cached.exists():
        return json.loads(cached.read_text())
    entries: dict[str, dict] = {}
    base = f"https://huggingface.co/api/datasets/{DATASET}/tree/{DATASET_REVISION}"
    listings = [f"{base}?expand=false"]
    listings += [f"{base}/docs/{d}?recursive=true&expand=false" for d in DOCUMENT_DIRECTORIES]
    for listing in listings:
        for entry in api_pages(listing):
            if entry["type"] == "file":
                entries[entry["path"]] = entry
    cached.write_text(json.dumps(entries, sort_keys=True))
    return entries


def verified(entry: dict, content: bytes) -> bool:
    if len(content) != entry["size"]:
        return False
    lfs = entry.get("lfs")
    if lfs:
        return hashlib.sha256(content).hexdigest() == lfs["oid"]
    blob = hashlib.sha1(b"blob %d\0" % len(content) + content).hexdigest()
    return blob == entry["oid"]


def fetch(entry: dict, cache: Path) -> bytes:
    target = cache / "files" / hashlib.sha256(entry["path"].encode()).hexdigest()
    if target.exists():
        content = target.read_bytes()
        if verified(entry, content):
            return content
    with urllib.request.urlopen(hub_url(entry["path"]), timeout=300) as response:
        content = response.read()
    if not verified(entry, content):
        raise SystemExit(f"Hash mismatch for {entry['path']} at {DATASET_REVISION}.")
    target.parent.mkdir(parents=True, exist_ok=True)
    partial = target.with_suffix(".partial")
    partial.write_bytes(content)
    partial.replace(target)
    return content


def sha256(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def slug(document: str) -> str:
    """Stable ASCII file stem; the hash suffix keeps distinct paths distinct."""
    stem = Path(document).stem
    ascii_stem = unicodedata.normalize("NFKD", stem).encode("ascii", "ignore").decode()
    cleaned = re.sub(r"[^a-z0-9]+", "-", ascii_stem.lower()).strip("-")[:72] or "document"
    return f"{cleaned}-{sha256(document.encode())[:8]}"


def group_cases(rule_files: dict[str, bytes]) -> dict[tuple[str, str], dict]:
    """Mirror upstream's (category, pdf) grouping of JSONL rows."""
    groups: dict[tuple[str, str], dict] = {}
    for category in CATEGORIES:
        for line in rule_files[category].decode("utf-8").splitlines():
            if not line.strip():
                continue
            row = json.loads(line)
            key = (row.get("category", category), row["pdf"])
            group = groups.setdefault(key, {"rules": 0, "tags": []})
            group["rules"] += 1
            for tag in row.get("tags") or []:
                if tag not in group["tags"]:
                    group["tags"].append(tag)
    return groups


def render_pngs(content: bytes, media_type: str) -> list[tuple[bytes, int, int]]:
    """Render every page to PNG at RENDER_DPI, long edge capped at MAX_LONG_EDGE_PX."""
    import fitz  # PyMuPDF, pinned in tools/requirements.lock
    from PIL import Image

    if media_type == "application/pdf":
        rendered: list[tuple[bytes, int, int]] = []
        document = fitz.open(stream=content, filetype="pdf")
        for page in document:
            long_edge_pt = max(page.rect.width, page.rect.height)
            zoom = min(RENDER_DPI / 72, MAX_LONG_EDGE_PX / long_edge_pt)
            pixmap = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=False, colorspace=fitz.csRGB)
            while max(pixmap.width, pixmap.height) > MAX_LONG_EDGE_PX:
                zoom *= 0.999
                pixmap = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=False, colorspace=fitz.csRGB)
            rendered.append((pixmap.tobytes("png"), pixmap.width, pixmap.height))
        document.close()
        return rendered
    image = Image.open(io.BytesIO(content))
    image.load()
    image = image.convert("RGB")
    if max(image.size) > MAX_LONG_EDGE_PX:
        scale = MAX_LONG_EDGE_PX / max(image.size)
        size = (max(1, round(image.width * scale)), max(1, round(image.height * scale)))
        image = image.resize(size, Image.Resampling.LANCZOS)
    output = io.BytesIO()
    image.save(output, format="PNG", optimize=False, compress_level=9)
    return [(output.getvalue(), image.width, image.height)]


def source_pages(content: bytes, media_type: str) -> list[dict]:
    """Page geometry upstream records for parse_with_layout_file inference.

    PDFs: split_pdf_to_pages() records int(rect.width), int(rect.height) in
    PDF points for each page. Images: the provider records image.width and
    image.height.
    """
    import fitz
    from PIL import Image

    if media_type == "application/pdf":
        document = fitz.open(stream=content, filetype="pdf")
        pages = [{"width": int(page.rect.width), "height": int(page.rect.height)} for page in document]
        document.close()
        return pages
    image = Image.open(io.BytesIO(content))
    return [{"width": image.width, "height": image.height}]


def render_document(job: tuple[str, dict, Path]) -> tuple[bytes, list[dict], list[tuple[bytes, int, int]]]:
    document, entry, cache = job
    content = fetch(entry, cache)
    media_type = SOURCE_MEDIA_TYPES[Path(document).suffix.lower()]
    return content, source_pages(content, media_type), render_pngs(content, media_type)


def write_jsonl(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("".join(json.dumps(row, sort_keys=True, ensure_ascii=False) + "\n" for row in rows))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=Path, required=True)
    parser.add_argument("--cache", type=Path, required=True)
    args = parser.parse_args()
    port: Path = args.port
    cache: Path = args.cache
    cache.mkdir(parents=True, exist_ok=True)

    entries = tree_entries(cache)
    rule_files = {c: fetch(entries[f"{c}.jsonl"], cache) for c in CATEGORIES}
    # Rules are dataset content: written here for the grader context, stored
    # as protected (R2-backed) objects in a Repository, never committed.
    rules_dir = port / "grader" / "rules"
    rules_dir.mkdir(parents=True, exist_ok=True)
    for category, content in rule_files.items():
        (rules_dir / f"{category}.jsonl.gz").write_bytes(gzip.compress(content, compresslevel=9, mtime=0))

    groups = group_cases(rule_files)
    if len(groups) != EXPECTED_CASES:
        raise SystemExit(f"Expected {EXPECTED_CASES} upstream cases, found {len(groups)}.")

    documents = sorted({document for _, document in groups})
    with ThreadPoolExecutor(max_workers=8) as pool:
        list(pool.map(lambda document: fetch(entries[document], cache), documents))
    pdf_root = port / "parsebench-pdf"
    image_root = port / "parsebench-image"
    for root in (pdf_root, image_root):
        shutil.rmtree(root / "documents", ignore_errors=True)

    grader_documents: dict[str, dict] = {}
    pdf_rows: list[dict] = []
    image_rows: list[dict] = []
    excluded: list[dict] = []
    excluded_images: list[dict] = []
    multi_page: list[dict] = []
    # Rendering is per document and deterministic, so it runs in parallel;
    # results are consumed in document order.
    jobs = [(document, entries[document], cache) for document in documents]
    with ProcessPoolExecutor(max_workers=os.cpu_count() or 1) as pool:
        for document, (content, pages, rendered) in zip(
            documents, pool.map(render_document, jobs, chunksize=4), strict=True
        ):
            suffix = Path(document).suffix.lower()
            media_type = SOURCE_MEDIA_TYPES[suffix]
            stem = slug(document)
            directory = document.split("/")[1]
            if len(rendered) != len(pages):
                raise SystemExit(f"{document}: rendered {len(rendered)} of {len(pages)} pages.")
            categories = sorted(category for category, doc in groups if doc == document)
            source_path = f"documents/{directory}/{stem}{suffix}"
            image_paths = (
                [f"documents/{directory}/{stem}.png"]
                if len(rendered) == 1
                else [f"documents/{directory}/{stem}-p{index + 1}.png" for index in range(len(rendered))]
            )

            record = {
                "source": {
                    "mediaType": media_type,
                    "sha256": sha256(content),
                    "sizeBytes": len(content),
                    "pages": pages,
                },
                "image": {
                    "pages": [
                        {"sha256": sha256(png), "sizeBytes": len(png), "width": width, "height": height}
                        for png, width, height in rendered
                    ],
                },
                "categories": categories,
            }
            grader_documents[document] = record
            if len(pages) > 1:
                multi_page.append({"document": document, "pages": len(pages), "categories": categories})

            image_bytes = sum(len(png) for png, _, _ in rendered)
            if (
                len(rendered) > MAX_CASE_ATTACHMENTS
                or image_bytes > MAX_CASE_ATTACHMENT_BYTES
                or any(len(png) > MAX_ATTACHMENT_BYTES for png, _, _ in rendered)
            ):
                excluded_images.append(
                    {"document": document, "pages": len(rendered), "sizeBytes": image_bytes, "categories": categories}
                )
            else:
                for path, (png, _, _) in zip(image_paths, rendered, strict=True):
                    (image_root / path).parent.mkdir(parents=True, exist_ok=True)
                    (image_root / path).write_bytes(png)
                image_rows.append(
                    {
                        "document": document,
                        "case": stem,
                        "categories": categories,
                        "attachments": [{"path": path, "mediaType": "image/png"} for path in image_paths],
                        "sha256": [page["sha256"] for page in record["image"]["pages"]],
                        "sourceSha256": record["source"]["sha256"],
                    }
                )

            if len(content) > MAX_ATTACHMENT_BYTES:
                excluded.append(
                    {
                        "document": document,
                        "sizeBytes": len(content),
                        "categories": categories,
                        "reason": "exceeds the 10,000,000-byte attachment limit",
                    }
                )
                continue
            (pdf_root / source_path).parent.mkdir(parents=True, exist_ok=True)
            (pdf_root / source_path).write_bytes(content)
            pdf_rows.append(
                {
                    "document": document,
                    "case": stem,
                    "categories": categories,
                    "attachments": [{"path": source_path, "mediaType": media_type}],
                    "sha256": [record["source"]["sha256"]],
                }
            )

    write_jsonl(pdf_root / "data" / "documents.jsonl", pdf_rows)
    write_jsonl(image_root / "data" / "documents.jsonl", image_rows)
    (port / "grader" / "documents.json").write_text(
        json.dumps(grader_documents, indent=1, sort_keys=True, ensure_ascii=False) + "\n"
    )

    summary = {
        "datasetRevision": DATASET_REVISION,
        "upstreamCases": len(groups),
        "documents": len(documents),
        "ruleFiles": {c: sha256(rule_files[c]) for c in CATEGORIES},
        "packages": {
            "parsebench-pdf": {
                "documents": len(pdf_rows),
                "cases": sum(len(r["categories"]) for r in pdf_rows),
                "excludedDocuments": excluded,
            },
            "parsebench-image": {
                "documents": len(image_rows),
                "cases": sum(len(r["categories"]) for r in image_rows),
                "excludedDocuments": excluded_images,
            },
        },
        "multiPageDocuments": multi_page,
        "documentsManifestSha256": {
            "parsebench-pdf/data/documents.jsonl": sha256((pdf_root / "data" / "documents.jsonl").read_bytes()),
            "parsebench-image/data/documents.jsonl": sha256((image_root / "data" / "documents.jsonl").read_bytes()),
            "grader/documents.json": sha256((port / "grader" / "documents.json").read_bytes()),
        },
    }
    (port / "tools" / "prepare-summary.json").write_text(json.dumps(summary, indent=2, sort_keys=True) + "\n")
    json.dump({**summary["packages"], "multiPageDocuments": multi_page}, sys.stdout, indent=2)
    print()
    return 0


if __name__ == "__main__":
    os.umask(0o022)
    raise SystemExit(main())
