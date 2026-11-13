# ParseBench grader for Trunchbull (grader protocol v1, port 8080).
#
# Upstream ParseBench is vendored unmodified in upstream/ at commit
# c38085d2ccd7f717900037e361806d22c51bc33b and installed from its own uv.lock
# (core dependencies plus the `anthropic` and `llamaparse` extras, whose
# provider modules hold the normalize() steps the grader reuses for model
# trials and for LlamaParse document-parser trials). The base images are pinned by
# digest. The network is used only while building; the running grader makes
# no network calls.
FROM ghcr.io/astral-sh/uv:0.9.7@sha256:ba4857bf2a068e9bc0e64eed8563b065908a4cd6bfb66b531a9c424c8e25e142 AS uv

FROM python:3.12-slim-bookworm@sha256:935c3c5b12357a7e10caa9c1e6ca5692344d97cf229832ef584be2cec9fc03df

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONHASHSEED=0 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never \
    UV_PROJECT_ENVIRONMENT=/opt/venv \
    HF_HUB_OFFLINE=1 \
    PATH=/opt/venv/bin:$PATH

COPY --from=uv /uv /usr/local/bin/uv

WORKDIR /opt/upstream
COPY upstream/ /opt/upstream/
RUN uv sync --frozen --no-dev --no-editable --extra anthropic --extra llamaparse \
 && rm -rf /root/.cache

WORKDIR /opt/parsebench
COPY pins.json documents.json build_index.py server.py /opt/parsebench/
COPY rules/ /opt/parsebench/rules/
RUN python -I build_index.py \
 && rm -rf /opt/parsebench/rules /opt/parsebench/data

RUN useradd --system --uid 10001 --home-dir /nonexistent grader
USER grader
EXPOSE 8080
CMD ["python", "-I", "/opt/parsebench/server.py"]
