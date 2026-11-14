import {
  Comparator,
  Range,
  SemVer,
  clean,
  cmp,
  coerce,
  compare,
  compareBuild,
  compareLoose,
  diff,
  eq,
  gt,
  gte,
  inc,
  lt,
  lte,
  major,
  maxSatisfying,
  minSatisfying,
  minVersion,
  minor,
  neq,
  parse,
  patch,
  prerelease,
  rcompare,
  rsort,
  satisfies,
  sort,
  valid,
  validRange,
} from "./index.js"

const version: SemVer = new SemVer("1.2.3-beta.1+build.5", { loose: false, includePrerelease: true })
const copy: SemVer = new SemVer(version, true)
const numbers: number = version.major + version.minor + version.patch
const pre: readonly (string | number)[] = version.prerelease
const build: readonly string[] = version.build
const text: string = version.version + version.raw + version.format() + version.toString()
const flags: boolean = version.loose || copy.loose
const order: number =
  version.compare("1.2.3") + version.compareMain(copy) + version.comparePre("1.2.3-alpha") + version.compareBuild(copy)
const bumped: SemVer = new SemVer("1.2.3").inc("prerelease", "beta", "1")
const released: SemVer = new SemVer("1.2.3-rc.1").inc("release")

const parsed: SemVer | null = parse("1.2.3")
const parsedLoose: SemVer | null = parse("=1.2.3", { loose: true })
const parsedOrThrow: SemVer | null = parse("1.2.3", false, true)
const checked: string | null = valid("1.2.3") ?? valid(version, true)
const cleaned: string | null = clean("  =v1.2.3  ", { loose: true })
const next: string | null = inc("1.2.3", "minor")
const nextPre: string | null = inc("1.2.3", "prerelease", "beta")
const nextOptions: string | null = inc(version, "prepatch", { loose: true }, "rc", false)
const change: string | null = diff("1.2.3", "2.0.0-pre")
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
const coerced: SemVer | null = coerce("v2")
const coercedFull: SemVer | null = coerce("1.2.3.4-rc.1", { rtl: true, includePrerelease: true })
const coercedNumber: SemVer | null = coerce(42)

const range: Range = new Range(">=1.2.3 <2.0.0 || 3.x", { includePrerelease: true })
const sameRange: Range = new Range(range, false)
const rangeText: string = range.range + range.raw + range.format() + range.toString()
const comparators: readonly (readonly Comparator[])[] = range.set
const inRange: boolean = range.test("1.5.0") || sameRange.test(version)
const comparator: Comparator = new Comparator(">= 1.2.3", { loose: true })
const comparatorText: string = comparator.value + comparator.operator + comparator.toString()
const matches: boolean = comparator.test("1.2.4")

const ok: boolean = satisfies("1.2.3", "^1.0.0", { includePrerelease: true }) && satisfies(version, range)
const highest: string | null = maxSatisfying(["1.2.3", "1.2.4"], "~1.2.0")
const lowest: string | null = minSatisfying(["1.2.3", "1.2.4"], range, true)
const minimum: SemVer | null = minVersion(">=1.2.3 || 2.x")
const canonical: string | null = validRange("~1.2", { loose: true })

void [numbers, pre, build, text, flags, order, bumped, released, parsed, parsedLoose, parsedOrThrow, checked, cleaned]
void [next, nextPre, nextOptions, change, parts, ids, compared, sorted, reversed, tests, coerced, coercedFull, coercedNumber]
void [rangeText, comparators, inRange, comparatorText, matches, ok, highest, lowest, minimum, canonical]
