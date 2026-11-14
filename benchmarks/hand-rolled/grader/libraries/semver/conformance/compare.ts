import {
  SemVer,
  clean,
  cmp,
  compare,
  compareBuild,
  compareLoose,
  eq,
  gt,
  gte,
  lt,
  lte,
  major,
  minor,
  neq,
  parse,
  patch,
  prerelease,
  rcompare,
  rsort,
  sort,
  valid,
} from "./index.js"

const version: SemVer = new SemVer("1.2.3-beta.1+build.5", { loose: false, includePrerelease: true })
const copy: SemVer = new SemVer(version, true)
const numbers: number = version.major + version.minor + version.patch
const pre: readonly (string | number)[] = version.prerelease
const build: readonly string[] = version.build
const text: string = version.version + version.raw + version.format() + version.toString()
const order: number =
  version.compare("1.2.3") + version.compareMain(copy) + version.comparePre("1.2.3-alpha") + version.compareBuild(copy)
const parsed: SemVer | null = parse("1.2.3")
const parsedLoose: SemVer | null = parse("=1.2.3", { loose: true })
const parsedOrThrow: SemVer | null = parse("1.2.3", false, true)
const checked: string | null = valid("1.2.3") ?? valid(version, true)
const cleaned: string | null = clean("  =v1.2.3  ", { loose: true })
const parts: number = major("1.2.3") + minor("1.2.3", true) + patch(version, { loose: true })
const ids: readonly (string | number)[] | null = prerelease("1.2.3-alpha.1")
const compared: number =
  compare("1.2.3", version) + rcompare("1.2.3", "1.2.4", true) + compareLoose("=1.2.3", "1.2.3") + compareBuild("1.0.0+1", "1.0.0+2")
const sorted: string[] = sort(["1.2.3", "1.0.0"])
const reversed: string[] = rsort(["1.2.3", "1.0.0"], { loose: true })
const tests: boolean[] = [
  gt("1.2.3", "1.2.2"),
  gte("1.2.3", version),
  lt("1.2.3", "1.2.4", true),
  lte("1.2.3", "1.2.3"),
  eq("1.2.3", "v1.2.3", { loose: true }),
  neq("1.2.3", "1.2.4"),
  cmp("1.2.3", ">=", "1.0.0"),
  cmp(version, "===", copy, { loose: true }),
]
void [numbers, pre, build, text, order, parsed, parsedLoose, parsedOrThrow, checked, cleaned, parts, ids, compared, sorted, reversed, tests]
