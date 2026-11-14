import parser from "./index.js"

const argv = parser(["--foo.bar", "1", "--a.b.c=two", "-x.y", "3"], {
  alias: { foo: ["f"], "a.b": ["ab"] },
  default: { "foo.baz": 2 },
  boolean: ["flag.on"],
  number: ["a.n"],
  string: ["foo.id"],
  configuration: { "dot-notation": true },
})
const positionals: (string | number)[] = argv._
const nested: unknown = argv.foo
const flat = parser("--foo.bar 1", { configuration: { "dot-notation": false } })

void [positionals, nested, flat]
