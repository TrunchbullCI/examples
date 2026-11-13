#!/bin/sh
# Download upstream's published LlamaParse runs and leaderboard for
# parity/document-parser.sh, and verify every file against its pinned sha256.
#
#   benchmarks/parsebench/parity/fetch-published.sh [directory]
#
# raw/<pipeline>/*.jsonl and results/<pipeline>/*.jsonl come from the
# llamaindex/ParseBench-results dataset at RESULTS_REVISION (the LFS objects
# are identical at 0b3c833, the revision leaderboard/results.yaml scores).
# leaderboard.csv comes from run-llama/ParseBench at LEADERBOARD_COMMIT.
set -eu

PORT_DIR=$(cd "$(dirname "$0")/.." && pwd)
DIR=${1:-"$PORT_DIR/.cache/published"}
RESULTS_REVISION=e0de8b2eb340e78e6ae692e40d94d06b7fa64aaa
LEADERBOARD_COMMIT=31a9ff1dec96f900869b785d8504d18f5035ebf8

sha256() {
  if command -v sha256sum > /dev/null; then sha256sum "$1"; else shasum -a 256 "$1"; fi | cut -d' ' -f1
}

fetch() {
  url=$1 path=$2 want=$3
  target="$DIR/$path"
  if [ -f "$target" ] && [ "$(sha256 "$target")" = "$want" ]; then
    return
  fi
  mkdir -p "$(dirname "$target")"
  curl -sSfL -o "$target.partial" "$url"
  got=$(sha256 "$target.partial")
  if [ "$got" != "$want" ]; then
    echo "$path: sha256 $got, expected $want" >&2
    exit 1
  fi
  mv "$target.partial" "$target"
}

while read -r want path; do
  fetch "https://huggingface.co/datasets/llamaindex/ParseBench-results/resolve/$RESULTS_REVISION/$path" "$path" "$want"
done <<'EOF'
7fbcb08f8e1661948ace5eb9fafda8af445ba1da87e74bd9e2560847c4e69487 raw/llamaparse_cost_effective/chart.jsonl
632c32475bb278110c332f286220a19a62e6f41267fcf09a7b26572d52b361b4 raw/llamaparse_cost_effective/layout.jsonl
b0e689230e1e43d7ca100c7a2d0b2e6ba21d210732aee336d3c891d375ea46fe raw/llamaparse_cost_effective/table.jsonl
bcffe3c8d01cd60f321902e4b79490cd2a6973dfe2b82ad55a9a8a9ed9130268 raw/llamaparse_cost_effective/text.jsonl
ca84d217bece1ed157a602e4df9e7b96212a59e2c4ce5ecb1392576566fbaf13 raw/llamaparse_agentic/chart.jsonl
d463d286efbb3a2094963a2e443192836b81adb62d733604256c5fecc084add6 raw/llamaparse_agentic/layout.jsonl
b42aabd8cb4894e4ceeb8a2bfd560e9f3c0c50b9f82910e4602cf4bccc7453d6 raw/llamaparse_agentic/table.jsonl
00483b3e6681e5c933ef6ed398bcb55e1760434c0f38e821d9d636147d6511cd raw/llamaparse_agentic/text.jsonl
d02d37330cb8c61f4d1c9185359ff346fac73ba8f59d7d023c54a3581c025aef raw/llamaparse_agentic_plus/chart.jsonl
6ec731d3678d932e8fa2eb5dc5eb1bfc5c753fbfae313e04c835c22975f31f18 raw/llamaparse_agentic_plus/layout.jsonl
e6082e350a9d91d198dfe77e21692764a3a0eaca5a9ef0980bf05cb9b294b4d3 raw/llamaparse_agentic_plus/table.jsonl
c8836a6676d4f05958dd6ca5482ea0c060db876607dec56b655d7a6590815c03 raw/llamaparse_agentic_plus/text.jsonl
2d6b0983c720898ce17c17e8f1d96595803dce993f72f7161dd3229742033960 results/llamaparse_cost_effective/chart.jsonl
7b414225bc3b4d54a73026487db2fe029a000e619ce777992736000455de641a results/llamaparse_cost_effective/layout.jsonl
84ef59c5e112019671ff75fca8d5079ba237c39ebd3edb3d5e21e9425a30d13f results/llamaparse_cost_effective/table.jsonl
f715a15f9bb1a5a1699c6cab4b27a9c9cac796a87e5a0efe48eb3f609bd37c1a results/llamaparse_cost_effective/text.jsonl
05ce5fa9041bdf69ad6eaabc5d203080b30f1c75656912844ce7c8e8c78050f2 results/llamaparse_agentic/chart.jsonl
d1f330106d421c660109914597745e560f20b121dbd11b9e28f602c9649af408 results/llamaparse_agentic/layout.jsonl
a2ad65e267a55859106b379f6267cec9e92df157b56930a17094615b16c61e22 results/llamaparse_agentic/table.jsonl
ea858431a8766ca6cee076b069f7f2199e74cc7bc0faca717d08a76a46229288 results/llamaparse_agentic/text.jsonl
da33f54b9e59448d65e1dfe8fce31a265d4c84aa954a62a46c4348042901928b results/llamaparse_agentic_plus/chart.jsonl
7f3eb20a4213057844977cf4daef563ab84b1f3e1c78f244ece4a01d76e80e53 results/llamaparse_agentic_plus/layout.jsonl
cd963355dda73c01e0375c8826a350146fb577d4b04d7ff32a96cfbcac5167df results/llamaparse_agentic_plus/table.jsonl
687939b66d69d81cc0472206240203c31b44bee549eb8ad25fa468f57238caf5 results/llamaparse_agentic_plus/text.jsonl
EOF
fetch "https://raw.githubusercontent.com/run-llama/ParseBench/$LEADERBOARD_COMMIT/leaderboard.csv" leaderboard.csv \
  eee60d457d95de563be949a55e41fd95ac4264eaa34664b229047e95fdea04de
echo "$DIR"
