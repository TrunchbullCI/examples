import parser from "./index.js"

const argv = parser(["--dry-run", "--no-color", "-abc", "--verbose=false"], {
  alias: { verbose: ["V"] },
  boolean: ["dry-run", "color", "verbose"],
  default: { color: true },
  number: ["level"],
  string: ["name"],
  configuration: { "boolean-negation": true, "negation-prefix": "no-", "camel-case-expansion": true },
})
const positionals: (string | number)[] = argv._
const dryRun: unknown = argv.dryRun
const fromString = parser("--no-cache -v", { boolean: ["v"] })

void [positionals, dryRun, fromString]
