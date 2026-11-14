import semver from "semver"
import type { Comparator as ComparatorType, Range as RangeType, SemVer as SemVerType } from "semver"

export const {
  SemVer,
  Comparator,
  Range,
  parse,
  valid,
  clean,
  inc,
  diff,
  major,
  minor,
  patch,
  prerelease,
  compare,
  rcompare,
  compareLoose,
  compareBuild,
  sort,
  rsort,
  gt,
  lt,
  eq,
  neq,
  gte,
  lte,
  cmp,
  coerce,
  satisfies,
  maxSatisfying,
  minSatisfying,
  minVersion,
  validRange,
} = semver

export type SemVer = SemVerType
export type Comparator = ComparatorType
export type Range = RangeType
