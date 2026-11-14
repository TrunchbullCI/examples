export type ReleaseType = "major" | "premajor" | "minor" | "preminor" | "patch" | "prepatch" | "prerelease" | "release"
export type Operator = "===" | "!==" | "" | "=" | "==" | "!=" | ">" | ">=" | "<" | "<="

export interface Options {
  loose?: boolean
  includePrerelease?: boolean
}

export interface CoerceOptions extends Options {
  rtl?: boolean
}

const notImplemented = (): never => {
  throw new Error("not implemented")
}

export class SemVer {
  raw: string = ""
  loose: boolean = false
  includePrerelease: boolean = false
  options: Options = {}
  major: number = 0
  minor: number = 0
  patch: number = 0
  version: string = ""
  prerelease: (string | number)[] = []
  build: string[] = []
  constructor(version: string | SemVer, optionsOrLoose?: boolean | Options | null) {
    void version
    void optionsOrLoose
    notImplemented()
  }
  format(): string {
    return notImplemented()
  }
  toString(): string {
    return notImplemented()
  }
  compare(other: string | SemVer): 1 | 0 | -1 {
    void other
    return notImplemented()
  }
  compareMain(other: string | SemVer): 1 | 0 | -1 {
    void other
    return notImplemented()
  }
  comparePre(other: string | SemVer): 1 | 0 | -1 {
    void other
    return notImplemented()
  }
  compareBuild(other: string | SemVer): 1 | 0 | -1 {
    void other
    return notImplemented()
  }
  inc(release: ReleaseType, identifier?: string, identifierBase?: string | false): SemVer {
    void release
    void identifier
    void identifierBase
    return notImplemented()
  }
}

export class Comparator {
  static get ANY(): symbol {
    return notImplemented()
  }
  semver: SemVer | symbol = Symbol()
  operator: "" | "<" | ">" | "<=" | ">=" = ""
  value: string = ""
  loose: boolean = false
  options: Options = {}
  constructor(comp: string | Comparator, optionsOrLoose?: boolean | Options | null) {
    void comp
    void optionsOrLoose
    notImplemented()
  }
  toString(): string {
    return notImplemented()
  }
  test(version: string | SemVer | symbol): boolean {
    void version
    return notImplemented()
  }
}

export class Range {
  raw: string = ""
  loose: boolean = false
  includePrerelease: boolean = false
  options: Options = {}
  set: Comparator[][] = []
  constructor(range: string | Range | Comparator, optionsOrLoose?: boolean | Options | null) {
    void range
    void optionsOrLoose
    notImplemented()
  }
  get range(): string {
    return notImplemented()
  }
  format(): string {
    return notImplemented()
  }
  toString(): string {
    return notImplemented()
  }
  test(version: string | SemVer): boolean {
    void version
    return notImplemented()
  }
}

type Version = string | SemVer
type Loose = boolean | Options | null

export function parse(version: unknown, optionsOrLoose?: Loose, throwErrors?: boolean): SemVer | null {
  void [version, optionsOrLoose, throwErrors]
  return notImplemented()
}
export function valid(version: unknown, optionsOrLoose?: Loose): string | null {
  void [version, optionsOrLoose]
  return notImplemented()
}
export function clean(version: string, optionsOrLoose?: Loose): string | null {
  void [version, optionsOrLoose]
  return notImplemented()
}
export function inc(
  version: Version,
  release: ReleaseType,
  optionsOrLoose?: Loose | string,
  identifier?: string | false,
  identifierBase?: string | false
): string | null {
  void [version, release, optionsOrLoose, identifier, identifierBase]
  return notImplemented()
}
export function diff(version1: Version, version2: Version): ReleaseType | null {
  void [version1, version2]
  return notImplemented()
}
export function major(version: Version, optionsOrLoose?: Loose): number {
  void [version, optionsOrLoose]
  return notImplemented()
}
export function minor(version: Version, optionsOrLoose?: Loose): number {
  void [version, optionsOrLoose]
  return notImplemented()
}
export function patch(version: Version, optionsOrLoose?: Loose): number {
  void [version, optionsOrLoose]
  return notImplemented()
}
export function prerelease(version: Version, optionsOrLoose?: Loose): (string | number)[] | null {
  void [version, optionsOrLoose]
  return notImplemented()
}
export function compare(a: Version, b: Version, optionsOrLoose?: Loose): 1 | 0 | -1 {
  void [a, b, optionsOrLoose]
  return notImplemented()
}
export function rcompare(a: Version, b: Version, optionsOrLoose?: Loose): 1 | 0 | -1 {
  void [a, b, optionsOrLoose]
  return notImplemented()
}
export function compareLoose(a: Version, b: Version): 1 | 0 | -1 {
  void [a, b]
  return notImplemented()
}
export function compareBuild(a: Version, b: Version, optionsOrLoose?: Loose): 1 | 0 | -1 {
  void [a, b, optionsOrLoose]
  return notImplemented()
}
export function sort<T extends Version>(list: T[], optionsOrLoose?: Loose): T[] {
  void [list, optionsOrLoose]
  return notImplemented()
}
export function rsort<T extends Version>(list: T[], optionsOrLoose?: Loose): T[] {
  void [list, optionsOrLoose]
  return notImplemented()
}
export function gt(a: Version, b: Version, optionsOrLoose?: Loose): boolean {
  void [a, b, optionsOrLoose]
  return notImplemented()
}
export function gte(a: Version, b: Version, optionsOrLoose?: Loose): boolean {
  void [a, b, optionsOrLoose]
  return notImplemented()
}
export function lt(a: Version, b: Version, optionsOrLoose?: Loose): boolean {
  void [a, b, optionsOrLoose]
  return notImplemented()
}
export function lte(a: Version, b: Version, optionsOrLoose?: Loose): boolean {
  void [a, b, optionsOrLoose]
  return notImplemented()
}
export function eq(a: Version, b: Version, optionsOrLoose?: Loose): boolean {
  void [a, b, optionsOrLoose]
  return notImplemented()
}
export function neq(a: Version, b: Version, optionsOrLoose?: Loose): boolean {
  void [a, b, optionsOrLoose]
  return notImplemented()
}
export function cmp(a: Version, operator: Operator, b: Version, optionsOrLoose?: Loose): boolean {
  void [a, operator, b, optionsOrLoose]
  return notImplemented()
}
export function coerce(version: unknown, options?: CoerceOptions): SemVer | null {
  void [version, options]
  return notImplemented()
}
export function satisfies(version: Version, range: string | Range, optionsOrLoose?: Loose): boolean {
  void [version, range, optionsOrLoose]
  return notImplemented()
}
export function maxSatisfying<T extends Version>(versions: readonly T[], range: string | Range, optionsOrLoose?: Loose): T | null {
  void [versions, range, optionsOrLoose]
  return notImplemented()
}
export function minSatisfying<T extends Version>(versions: readonly T[], range: string | Range, optionsOrLoose?: Loose): T | null {
  void [versions, range, optionsOrLoose]
  return notImplemented()
}
export function minVersion(range: string | Range, optionsOrLoose?: Loose): SemVer | null {
  void [range, optionsOrLoose]
  return notImplemented()
}
export function validRange(range: string | Range | null | undefined, optionsOrLoose?: Loose): string | null {
  void [range, optionsOrLoose]
  return notImplemented()
}
