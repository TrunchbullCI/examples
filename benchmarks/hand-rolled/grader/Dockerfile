# Hand-Rolled grader for Trunchbull (grader protocol v1, port 8080).
#
# The base image is pinned by digest and every npm dependency by lockfile.
# The network is used only while building; the running grader makes no
# network calls. The build fails unless the vendored upstream files match
# their recorded hashes and the real libraries reproduce expected.json
# exactly under this image's Node.js.
FROM node:24.22.3-bookworm-slim@sha256:dc26ae92c9fb15cf6b1d63e20f0944b2efe0f115b20e00be48fb23fceb061c54

ENV NODE_ENV=production \
    TZ=UTC \
    LANG=C.UTF-8 \
    NO_COLOR=1 \
    npm_config_update_notifier=false

WORKDIR /opt/hand-rolled
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY libraries/ libraries/
RUN for library in libraries/*/; do \
      (cd "$library" && npm ci --ignore-scripts --no-audit --no-fund --include=dev) || exit 1; \
    done \
 && npm cache clean --force
COPY harness/ harness/
COPY tools/ tools/
COPY server.mjs ./
RUN node tools/vendor.mjs --check \
 && node tools/expectations.mjs --check \
 && rm -rf libraries/*/.work

RUN useradd --system --uid 10001 --home-dir /nonexistent grader \
 && for library in libraries/*/; do mkdir -p "$library.work" && chown grader "$library.work"; done
USER grader
EXPOSE 8080
CMD ["node", "/opt/hand-rolled/server.mjs"]
