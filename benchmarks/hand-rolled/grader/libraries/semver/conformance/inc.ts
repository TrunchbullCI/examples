import { SemVer, diff, inc, parse } from "./index.js"

const version: SemVer = new SemVer("1.2.3-beta.1+build.5", { loose: true })
const bumped: SemVer = version.inc("prerelease", "beta", "1")
const released: SemVer = new SemVer("1.2.3-rc.1").inc("release")
const fields: string = bumped.version + bumped.raw + bumped.build.join(".") + bumped.prerelease.join(".")
const parsed: SemVer | null = parse("1.2.3", { loose: true })
const next: string | null = inc("1.2.3", "minor")
const nextPre: string | null = inc("1.2.3", "prerelease", "beta")
const nextBase: string | null = inc("1.2.3", "premajor", "rc", false)
const nextOptions: string | null = inc(version, "prepatch", { loose: true }, "rc", "0")
const change: string | null = diff("1.2.3", "2.0.0-pre")
void [released, fields, parsed, next, nextPre, nextBase, nextOptions, change]
