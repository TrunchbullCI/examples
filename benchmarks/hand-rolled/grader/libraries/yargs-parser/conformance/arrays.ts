import parser from "./index.js"

const argv = parser(["--list", "1", "2", "--pair", "a", "b", "-x", "1", "-x", "2"], {
  array: ["list"],
  narg: { pair: 2 },
  alias: { list: ["l"] },
  default: { list: [] },
  boolean: ["flag"],
  number: ["x"],
  string: ["name"],
  configuration: { "duplicate-arguments-array": true, "flatten-duplicate-arrays": true, "greedy-arrays": true, "nargs-eats-options": false },
})
const positionals: (string | number)[] = argv._
const list: unknown = argv.list
const typed = parser("--n 1 2", { array: [{ key: "n", number: true }] })

const detailed = parser.detailed(["--pair", "a"], { narg: { pair: 2 } })
const error: Error | null = detailed.error
const detailedArgv = detailed.argv._

void [positionals, list, typed, error, detailedArgv]
