// Differential fuzz targets for dotenv. Every input comes from the grader's
// seeded generator. config() runs in a private temporary directory that holds
// a fixed set of .env files; the directory's path is replaced by <cwd> in the
// outputs, so the reference and submission processes agree on it.
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { format } from "node:util"

const BACKTICK = "\u0060"
const KEYS = ["BASIC", "A", "b_2", "KEY.with.dots", "dash-key", "export", "exports", "EMPTY", "Q", "_x", "9LIVES", "DOTENV_QUIET"]
const WORDS = ["basic", "value", "hello world", "a#b", "x # y", "C:\\path\\to", "line\\nnext", "cr\\rhere", "{\"k\": \"v\"}", "it's", "say \"hi\"", "back" + BACKTICK + "tick", "", "  spaced  ", "=equals=", "é ü ✓", "$HOME", "\\\\", "#", "'", "\""]
const QUOTES = ["'", "\"", BACKTICK]
const SPACE = [" ", "  ", "\t", "\u00a0", "\f", "\v", "\u2028", "\ufeff"]

function key(random) {
  if (random.bool(0.8)) return random.pick(KEYS)
  return random.string("ABCxyz019_.-", 1, 6) + (random.bool(0.1) ? random.pick(["$", "!", " ", "@"]) : "")
}

function value(random) {
  const shape = random.int(0, 9)
  const word = random.pick(WORDS)
  if (shape <= 2) return word
  if (shape <= 6) {
    const quote = random.pick(QUOTES)
    let body = random.bool(0.3) ? random.array(1, 3, () => random.pick(WORDS)).join(random.pick(["\n", " ", "\\n", "\r\n"])) : word
    if (random.bool(0.15)) body = body + "\\" + quote + random.pick(WORDS)
    const close = random.bool(0.85) ? quote : ""
    return quote + body + close + (random.bool(0.1) ? random.pick([" junk", quote, " " + quote + "x" + quote]) : "")
  }
  if (shape === 7) return random.string("ab \"'" + BACKTICK + "#=\\n\r:", 0, 10)
  if (shape === 8) return ""
  return random.pick(QUOTES) + random.pick(WORDS)
}

function assignment(random) {
  const lead = random.bool(0.15) ? random.pick(SPACE) : ""
  const exp = random.bool(0.15) ? "export" + random.pick([" ", "  ", "\t", ""]) : ""
  const separator = random.pick(["=", "=", "=", " = ", "= ", " =", ": ", ":", ":\t", ":\n", "=\n", "==", ""])
  const comment = random.bool(0.2) ? random.pick([" # comment", "#c", " #", "\t# x"]) : ""
  const tail = random.bool(0.1) ? random.pick(SPACE) : ""
  return lead + exp + key(random) + separator + value(random) + comment + tail
}

function envText(random) {
  if (random.bool(0.05)) return random.string("AB=:#\"'" + BACKTICK + "\\n \n\r\t\u2028x", 0, 30)
  const lines = random.array(1, 8, () => {
    const kind = random.int(0, 12)
    if (kind === 0) return ""
    if (kind === 1) return "# " + random.pick(WORDS)
    if (kind === 2) return random.string("abc #=", 1, 8)
    return assignment(random)
  })
  const ending = random.pick(["\n", "\n", "\n", "\r\n", "\r", "\u2029"])
  return (random.bool(0.05) ? "\ufeff" : "") + lines.join(ending) + (random.bool(0.5) ? ending : "")
}

function captureConsole(work) {
  const logs = []
  const saved = { log: console.log, error: console.error }
  console.log = (...args) => logs.push(["log", format(...args)])
  console.error = (...args) => logs.push(["error", format(...args)])
  try {
    return { result: work(), logs }
  } finally {
    console.log = saved.log
    console.error = saved.error
  }
}

let directory = null
const FILES = {
  ".env": "BASIC=basic\nDEFAULT_FILE=yes\n",
  "a.env": "# first file\nBASIC=from_a\nexport ONLY_A='only a'\nSHARED=\"a\\nvalue\"\nEMPTY=\n",
  "b.env": "BASIC=from_b\nSHARED=b # trailing comment\nONLY_B=" + BACKTICK + "only b" + BACKTICK + "\n",
  "quiet.env": "DOTENV_QUIET=true\nQUIET_FILE=1\n",
  "loud.env": "DOTENV_QUIET=false\nLOUD_FILE=1\n",
  "latin.env": "ACCENT=café\nPLAIN=plain\n",
  "bom.env": "\ufeffBOM_KEY=bom\nAFTER=after\n",
  "crlf.env": "CR_A=one\r\nCR_B=\"two\"\r\n",
}
const PATHS = [".env", "a.env", "b.env", "quiet.env", "loud.env", "latin.env", "bom.env", "crlf.env", "missing.env", "nested/missing.env", "dir"]

function normalize(value) {
  if (typeof value === "string") return value.split(directory).join("<cwd>")
  if (Array.isArray(value)) return value.map(normalize)
  if (value && typeof value === "object") {
    const copy = {}
    for (const [name, item] of Object.entries(value)) copy[name] = normalize(item)
    return copy
  }
  return value
}

function configInput(random) {
  const pathShape = random.int(0, 9)
  let path
  if (pathShape <= 1) path = undefined
  else if (pathShape <= 5) path = random.pick(PATHS)
  else if (pathShape <= 7) path = random.array(1, 3, () => random.pick(PATHS))
  else if (pathShape === 8) path = { url: random.pick(PATHS) }
  else path = random.pick(["~/hand-rolled-missing.env", "file:///no/such.env", ""])
  const flag = () => random.pick([undefined, true, false, "true", "false", "0", "1", "no", "", "yes"])
  const options = {}
  if (path !== undefined || random.bool(0.3)) options.path = path
  for (const name of ["quiet", "debug", "override", "fast"]) if (random.bool(0.45)) options[name] = flag()
  if (random.bool(0.2)) options.encoding = random.pick(["utf8", "latin1", "ascii", undefined])
  const existing = {}
  for (const name of random.array(0, 3, () => random.pick(["BASIC", "SHARED", "ONLY_A", "DOTENV_QUIET", "EMPTY"]))) {
    existing[name] = random.pick(["existing", "", "false", "true"])
  }
  const env = {}
  if (random.bool(0.25)) {
    const prefix = random.pick(["DOTENV_", "DOTENV_CONFIG_"])
    const name = random.pick(["PATH", "QUIET", "DEBUG", "OVERRIDE", "ENCODING"])
    env[prefix + name] = name === "PATH" ? random.pick(PATHS) : name === "ENCODING" ? random.pick(["utf8", "latin1"]) : random.pick(["true", "false", "0", "yes"])
  }
  return { options, existing, env, nullOptions: random.bool(0.04) }
}

function runConfig(api, input) {
  const saved = {}
  for (const [name, item] of Object.entries(input.env)) {
    saved[name] = process.env[name]
    process.env[name] = item
  }
  try {
    const processEnv = { ...input.existing }
    let options = { ...input.options, processEnv }
    if (input.options.path && typeof input.options.path === "object" && !Array.isArray(input.options.path)) {
      options.path = pathToFileURL(resolve(input.options.path.url))
    }
    if (input.nullOptions) options = null
    const { result, logs } = captureConsole(() => api.config(options))
    return normalize({
      parsed: result.parsed,
      hasError: result.error !== undefined,
      error: result.error ? { code: result.error.code ?? null, message: result.error.message } : null,
      processEnv,
      logs,
    })
  } finally {
    for (const [name, item] of Object.entries(saved)) {
      if (item === undefined) delete process.env[name]
      else process.env[name] = item
    }
  }
}

function plainObject(random) {
  if (random.bool(0.06)) return random.pick([null, "", "KEY=value", 42, undefined, ["a", "b"]])
  const object = {}
  for (const name of random.array(0, 4, () => random.pick(["A", "B", "C", "test", "home", "constructor", "EMPTY"]))) {
    object[name] = random.pick(["one", "two", "", undefined, "false"])
  }
  return object
}

export default {
  setup() {
    directory = realpathSync(mkdtempSync(join(tmpdir(), "hand-rolled-dotenv-")))
    for (const [name, text] of Object.entries(FILES)) writeFileSync(join(directory, name), text)
    mkdirSync(join(directory, "dir"))
    process.chdir(directory)
    process.on("exit", () => rmSync(directory, { recursive: true, force: true }))
  },
  targets: {
    parse: {
      count: 350,
      input(random) {
        return { text: envText(random), buffer: random.bool(0.2), fast: random.bool(0.25) }
      },
      run: (api, input) => api.parse(input.buffer ? Buffer.from(input.text) : input.text, input.fast ? { fast: true } : undefined),
    },
    populate: {
      count: 200,
      input(random) {
        const flag = () => random.pick([undefined, true, false, "true", "false", "0", "off", "yes", 1, 0])
        const options = random.pick([undefined, {}, { override: flag() }, { debug: flag() }, { override: flag(), debug: flag() }])
        return { processEnv: plainObject(random), parsed: plainObject(random), options }
      },
      run(api, input) {
        const processEnv = input.processEnv && typeof input.processEnv === "object" ? structuredClone(input.processEnv) : input.processEnv
        const parsed = input.parsed && typeof input.parsed === "object" ? structuredClone(input.parsed) : input.parsed
        let outcome
        const { logs } = captureConsole(() => {
          try {
            outcome = { populated: api.populate(processEnv, parsed, input.options) }
          } catch (error) {
            outcome = { error: error?.message, code: error?.code }
          }
        })
        return { ...outcome, processEnv, logs }
      },
    },
    config: {
      count: 220,
      input: configInput,
      run: runConfig,
    },
  },
}
