// Differential fuzz targets for semver. Every input comes from the grader's
// seeded generator; SemVer, Range and Comparator objects are reduced to their
// documented fields before comparison, and each call that may throw is
// recorded as its error's constructor name and message.
const PRERELEASES = ["alpha", "beta", "rc", "0", "1", "2", "10", "alpha.1", "beta.2", "rc.0", "alpha.beta", "x-y", "1a", "pr.3.x", "alpha", "beta.1", "01", ""]
const BUILDS = ["build", "001", "sha.5114f85", "exp.sha", "1", "a-b"]
const OPTIONS = [undefined, null, true, false, {}, { loose: true }, { includePrerelease: true }, { loose: true, includePrerelease: true }]

function attempt(work) {
  try {
    return { value: work() }
  } catch (error) {
    return { error: error instanceof Error ? error.constructor.name + ": " + error.message : String(error) }
  }
}

// Range and comparator errors name the comparator text after semver's
// internal desugaring steps; compare only their kind (the message up to ":").
function attemptKind(work) {
  const outcome = attempt(work)
  return outcome.error === undefined ? outcome : { error: outcome.error.split(":").slice(0, 2).join(":") }
}

function project(version) {
  if (version === null || version === undefined) return version
  if (typeof version !== "object") return { notAVersion: String(version) }
  return {
    version: version.version,
    raw: version.raw,
    major: version.major,
    minor: version.minor,
    patch: version.patch,
    prerelease: [...version.prerelease],
    build: [...version.build],
    loose: version.loose,
    includePrerelease: version.includePrerelease,
  }
}

function number(random) {
  const shape = random.int(0, 39)
  if (shape <= 33) return String(random.int(0, shape <= 27 ? 3 : 12))
  if (shape <= 36) return random.pick(["x", "X", "*"])
  if (shape === 37) return "0" + random.int(0, 9)
  if (shape === 38) return String(random.int(100, 99999))
  return random.pick(["9007199254740991", "9007199254740992", "99999999999999999"])
}

function release(random) {
  return [0, 1, 2].map(() => String(random.int(0, 3)))
}

function version(random, { loose = 0.1, invalid = 0.08 } = {}) {
  if (random.bool(invalid)) {
    return random.pick(["", " ", "1", "1.2", "1.2.3.4", "a.b.c", "1.2.x", "~1.2.3", ">1.2.3", "01.2.3", "1.2.3-", "1.2.3+", "1.2.3-01", "1.2.3-a..b", "v", "=", "latest", "1.2.3 - 2"])
  }
  let text = release(random).join(".")
  if (random.bool(0.35)) text += "-" + random.pick(PRERELEASES.filter(Boolean))
  if (random.bool(0.15)) text += "+" + random.pick(BUILDS)
  if (random.bool(loose)) {
    const kind = random.int(0, 5)
    if (kind === 0) text = "v" + text
    else if (kind === 1) text = "=" + text
    else if (kind === 2) text = "  " + text + "\t"
    else if (kind === 3) text = text.replace(/^(\d+)/, "0$1")
    else if (kind === 4) text = text.replace(/-/, "")
    else text = "= v" + text
  }
  return text
}

function partial(random, dirty) {
  const count = random.pick([1, 2, 2, 3, 3, 3, 3])
  const parts = []
  for (let index = 0; index < count; index += 1) {
    if (dirty) parts.push(number(random))
    else if (parts.length && /[xX*]/.test(parts.at(-1))) parts.push(parts.at(-1))
    else parts.push(random.bool(0.08) ? random.pick(["x", "X", "*"]) : String(random.int(0, random.bool(0.8) ? 3 : 12)))
  }
  let text = parts.join(".")
  const prereleases = dirty ? PRERELEASES : PRERELEASES.filter((item) => item !== "01")
  if (count === 3 && random.bool(0.2)) text += "-" + random.pick(prereleases.filter(Boolean))
  if (random.bool(0.06)) text += "+" + random.pick(BUILDS)
  if (random.bool(0.06)) text = random.pick(["v", "=", "v=", "=v"]) + text
  return text
}

function comparator(random, dirty = true) {
  const operator = random.pick(["", "", "=", ">", ">=", "<", "<=", "~", "~>", "^", "^", "~"])
  const space = random.bool(0.12) ? random.pick([" ", "  ", "\t"]) : ""
  return operator + space + partial(random, dirty)
}

function rangeText(random, maxComparators = 3) {
  if (random.bool(0.05)) {
    return random.pick(["", "*", "x", "X", "latest", ">=*", "1.2.3 junk", "blerg", "||", "1 ||", "^", "~", ">", "<0.0.0-0", ">=0.0.0", "1.2.3 - ", "- 1.2.3", "1.x.2", "*.1", "1.2.3+build - 2.0.0+build", "> *", ">= 2 < 1"])
  }
  const dirty = random.bool(0.2)
  const sets = random.array(1, 3, () => {
    if (random.bool(0.15)) return partial(random, dirty) + random.pick(dirty ? [" - ", "  -  ", " -"] : [" - ", "  -  "]) + partial(random, dirty)
    return random.array(1, maxComparators, () => comparator(random, dirty)).join(random.pick([" ", " ", "  ", "\t"]))
  })
  return sets.join(random.pick(["||", " || ", "  ||  "]))
}

function options(random) {
  return random.pick(OPTIONS)
}

const VERSIONISH = [1.2, 10, null, undefined, {}, ["1.2.3"], { version: "1.2.3" }]

export default {
  targets: {
    parse: {
      count: 300,
      input(random) {
        const value = random.bool(0.04) ? random.pick(VERSIONISH) : random.bool(0.1) ? random.string("0123456789.-+vx= abc", 1, 14) : version(random, { loose: 0.3, invalid: 0.15 })
        return { value, options: options(random) }
      },
      run(api, { value, options }) {
        return {
          parse: attempt(() => project(api.parse(value, options))),
          strict: attempt(() => project(api.parse(value, options, true))),
          valid: attempt(() => api.valid(value, options)),
          clean: typeof value === "string" ? attempt(() => api.clean(value, options)) : null,
          construct: attempt(() => project(new api.SemVer(value, options))),
          parts: [
            attempt(() => api.major(value, options)),
            attempt(() => api.minor(value, options)),
            attempt(() => api.patch(value, options)),
            attempt(() => api.prerelease(value, options)),
          ],
          text: attempt(() => {
            const parsed = new api.SemVer(value, options)
            return [String(parsed), parsed.format(), parsed.toString()]
          }),
        }
      },
    },
    compare: {
      count: 300,
      input(random) {
        const pair = () => (random.bool(0.3) ? release(random).join(".") + (random.bool(0.5) ? "-" + random.pick(PRERELEASES.filter(Boolean)) : "") : version(random, { loose: 0.12, invalid: 0.05 }))
        const a = pair()
        const b = random.bool(0.15) ? a + (random.bool(0.5) ? "+" + random.pick(BUILDS) : "") : pair()
        return {
          a,
          b,
          loose: random.pick([undefined, true, false, { loose: true }, { includePrerelease: true }]),
          operator: random.pick(["===", "!==", "", "=", "==", "!=", ">", ">=", "<", "<=", "=>", "~"]),
          list: random.array(0, 5, () => version(random, { loose: 0, invalid: 0 })),
        }
      },
      run(api, { a, b, loose, operator, list }) {
        return {
          compare: attempt(() => api.compare(a, b, loose)),
          rcompare: attempt(() => api.rcompare(a, b, loose)),
          compareBuild: attempt(() => api.compareBuild(a, b, loose)),
          compareLoose: attempt(() => api.compareLoose(a, b)),
          relations: [api.gt, api.gte, api.lt, api.lte, api.eq, api.neq].map((relation) => attempt(() => relation(a, b, loose))),
          cmp: attempt(() => api.cmp(a, operator, b, loose)),
          methods: attempt(() => {
            const left = new api.SemVer(a, loose)
            return [left.compare(b), left.compareMain(b), left.comparePre(b), left.compareBuild(b)]
          }),
          sort: attempt(() => api.sort([...list])),
          rsort: attempt(() => api.rsort([...list])),
        }
      },
    },
    inc: {
      count: 300,
      input(random) {
        return {
          version: random.bool(0.6) ? version(random, { loose: 0.1, invalid: 0.05 }) : release(random).join(".") + "-" + random.pick(PRERELEASES.filter(Boolean)) + (random.bool(0.2) ? "+" + random.pick(BUILDS) : ""),
          release: random.pick(["major", "premajor", "minor", "preminor", "patch", "prepatch", "prerelease", "prerelease", "release", "fake", ""]),
          options: random.pick([undefined, null, true, { loose: true }, "string"]),
          identifier: random.pick([undefined, undefined, "alpha", "beta", "rc", "alpha.1", "dev", "0", "a/b", "", "1a"]),
          identifierBase: random.pick([undefined, undefined, "0", "1", false, "2"]),
        }
      },
      run(api, input) {
        const call =
          input.options === "string"
            ? () => api.inc(input.version, input.release, input.identifier ?? "beta", input.identifierBase)
            : () => api.inc(input.version, input.release, input.options, input.identifier, input.identifierBase)
        return {
          inc: attempt(call),
          method: attempt(() => {
            const parsed = new api.SemVer(input.version, input.options === "string" ? undefined : input.options)
            const result = parsed.inc(input.release, input.identifier, input.identifierBase)
            return { same: result === parsed, version: project(result) }
          }),
        }
      },
    },
    diff: {
      count: 200,
      input(random) {
        const base = release(random)
        const near = () => {
          const parts = base.map((part) => (random.bool(0.3) ? String(Math.max(0, Number(part) + random.int(-1, 1))) : part))
          return parts.join(".") + (random.bool(0.4) ? "-" + random.pick(PRERELEASES.filter(Boolean)) : "") + (random.bool(0.1) ? "+" + random.pick(BUILDS) : "")
        }
        return { a: random.bool(0.05) ? random.pick(["bad", "1.2", ""]) : near(), b: near() }
      },
      run: (api, { a, b }) => attempt(() => api.diff(a, b)),
    },
    satisfies: {
      count: 400,
      input(random) {
        return { range: rangeText(random), version: version(random, { loose: 0.08, invalid: 0.05 }), options: options(random) }
      },
      run(api, { range, version, options }) {
        return {
          satisfies: attempt(() => api.satisfies(version, range, options)),
          validRange: attempt(() => api.validRange(range, options)),
        }
      },
    },
    select: {
      count: 200,
      input(random) {
        return {
          range: rangeText(random, 2),
          versions: random.array(1, 10, () => (random.bool(0.75) ? release(random).join(".") : version(random, { loose: 0, invalid: 0.05 }))),
          options: options(random),
        }
      },
      run(api, { range, versions, options }) {
        return {
          max: attempt(() => api.maxSatisfying(versions, range, options)),
          min: attempt(() => api.minSatisfying(versions, range, options)),
        }
      },
    },
    minVersion: {
      count: 200,
      input(random) {
        return { range: rangeText(random), loose: random.pick([undefined, true, false, { loose: true }, { includePrerelease: true }]) }
      },
      run: (api, { range, loose }) => attemptKind(() => project(api.minVersion(range, loose))),
    },
    range: {
      count: 250,
      input(random) {
        return {
          range: rangeText(random),
          comparator: random.bool(0.15) ? random.pick(["", " ", "foo bar", ">=", "<1.2.3 >2", "~1.2.3", "x"]) : comparator(random).replace(/^[~^]>?/, ">="),
          versions: random.array(1, 4, () => version(random, { loose: 0.05, invalid: 0.05 })),
          options: options(random),
        }
      },
      run(api, { range, comparator, versions, options }) {
        return {
          range: attemptKind(() => {
            const parsed = new api.Range(range, options)
            return {
              range: parsed.range,
              raw: parsed.raw,
              format: parsed.format(),
              string: String(parsed),
              loose: parsed.loose,
              includePrerelease: parsed.includePrerelease,
              set: parsed.set.map((comparators) => comparators.map((item) => item.value)),
              test: versions.map((item) => parsed.test(item)),
              same: new api.Range(parsed, options) === parsed,
            }
          }),
          comparator: attemptKind(() => {
            const parsed = new api.Comparator(comparator, options)
            return {
              operator: parsed.operator,
              value: parsed.value,
              string: String(parsed),
              any: parsed.semver === api.Comparator.ANY,
              semver: parsed.semver === api.Comparator.ANY ? null : project(parsed.semver),
              test: versions.map((item) => parsed.test(item)),
            }
          }),
        }
      },
    },
    coerce: {
      count: 250,
      input(random) {
        const shape = random.int(0, 9)
        let value
        if (shape === 0) value = random.pick([null, undefined, 42, 1.5, {}, "", ".", "version one"])
        else if (shape <= 3) value = random.string("0123456789.-+/ vabrc", 1, 20)
        else if (shape <= 6) {
          value = random.array(1, 5, () => String(random.int(0, 20))).join(random.pick([".", ".", ".", "/", " "]))
          if (random.bool(0.4)) value = random.pick(["v", "version ", "a", " "]) + value
          if (random.bool(0.4)) value += random.pick(["-rc.5", "-alpha2", "+rev.6", "-rc.5+rev.6", "xyz", "/7", ".", "-1a"])
        } else if (shape <= 8) {
          value = random.pick(["1".repeat(16), "1".repeat(17), "9".repeat(16), "2".repeat(15)]) + random.pick(["", ".2", ".2.3", ".2.3.4"]) + random.pick(["", "-rc.1", "+b"])
          if (random.bool(0.3)) value = "a" + value
        } else value = version(random, { loose: 0.4, invalid: 0.3 })
        return { value, options: random.pick([undefined, {}, { rtl: true }, { includePrerelease: true }, { rtl: true, includePrerelease: true }, { loose: true }]) }
      },
      run: (api, { value, options }) => attempt(() => project(api.coerce(value, options))),
    },
  },
}
