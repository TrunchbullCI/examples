import parser from "./index.js"

const argv = parser(["--foo", "bar", "-v", "-v", "--list", "1", "2", "--", "rest"], {
  alias: { foo: ["f"], verbose: "v" },
  array: ["list"],
  boolean: ["dry-run"],
  coerce: { foo: (value: string) => value.toUpperCase() },
  count: ["verbose"],
  default: { port: 8080 },
  narg: { pair: 2 },
  normalize: ["path"],
  number: ["port"],
  string: ["name"],
  configuration: { "dot-notation": true, "populate--": true, "negation-prefix": "no-", "camel-case-expansion": true },
})
const positionals: (string | number)[] = argv._
const rest: (string | number)[] | undefined = argv["--"]
const foo: unknown = argv.foo
const fromString = parser("--name=yargs --no-color")
const typedArrays = parser(["--n", "1"], { array: [{ key: "n", number: true }, { key: "flags", boolean: true }] })

const detailed = parser.detailed(["--x", "1"], { narg: { x: 2 } })
const error: Error | null = detailed.error
const aliases: { [key: string]: string[] } = detailed.aliases
const newAliases: { [key: string]: boolean } = detailed.newAliases
const dotNotation: boolean = detailed.configuration["dot-notation"]
const detailedArgv = detailed.argv._

const camel: string = parser.camelCase("foo-bar")
const kebab: string = parser.decamelize("fooBar")
const snake: string = parser.decamelize("fooBar", "_")
const numeric: boolean = parser.looksLikeNumber("0x10")

void [positionals, rest, foo, fromString, typedArrays, error, aliases, newAliases, dotNotation, detailedArgv, camel, kebab, snake, numeric]
