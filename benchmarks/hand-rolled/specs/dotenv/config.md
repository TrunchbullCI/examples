Implement the loading half of dotenv: `config(options)` reads one or more
`.env` files and copies their variables into `process.env` (or another
object), and `populate(processEnv, parsed, options)` does the copying.

```ts
export interface DotenvConfigOptions {
  path?: string | string[] | URL
  encoding?: string
  quiet?: boolean
  debug?: boolean
  override?: boolean
  fast?: boolean
  processEnv?: Record<string, string | undefined>
}

export interface DotenvConfigOutput {
  parsed?: Record<string, string>
  error?: Error & { code?: string }
}

export function config(options?: DotenvConfigOptions | null): DotenvConfigOutput
export function populate(
  processEnv: Record<string, string | undefined>,
  parsed: Record<string, string | undefined>,
  options?: { debug?: boolean; override?: boolean }
): Record<string, string | undefined>
```

You need a parser for the files, but only a simple one: the files used with
this feature contain `KEY=value` lines (optionally prefixed by `export `,
with spaces around `=` allowed), blank lines, `#` comment lines and
trailing `# comments`. Values may be wrapped in single quotes, double
quotes or backticks, which are removed and protect `#`. In double-quoted
values `\n` becomes a newline. Unquoted values are trimmed. A file may start
with a byte-order mark, and lines may end with `\r\n`. Files that use more
of the format only need their simple lines read correctly. Export it as
`parse` if you like; the tests replace `parse` on the module object and do
not rely on it.

## `populate(processEnv, parsed, options)`

- Copies each own enumerable key of `parsed` into `processEnv` and returns
  an object with the keys and values it actually set (an `undefined` value
  is copied as an own property too).
- A key that `processEnv` already has as an own property, even with an empty
  value, is overwritten only when `override` is set.
- With `debug`, each such existing key logs through `console.log`:
  `┆ "KEY" is already defined and WAS overwritten` or
  `┆ "KEY" is already defined and was NOT overwritten`.
- If `processEnv` or `parsed` is `null` or not an object, it throws an
  `Error` with message
  `OBJECT_REQUIRED: Please check the processEnv argument being passed to populate`
  and `code` `"OBJECT_REQUIRED"`.

## `config(options)`

- **Options and defaults.** `options` may be omitted or `null`. Options whose
  value is `undefined` count as not given. A missing option falls back to the
  environment variable `DOTENV_<NAME>`, or the legacy
  `DOTENV_CONFIG_<NAME>` when the first is unset, for `ENCODING`,
  `PATH`, `QUIET`, `DEBUG`, `OVERRIDE` and `FAST`, read from
  `process.env` when `config` is called.
- **Flags.** `quiet`, `debug`, `override` and `fast` (in `populate`
  too) may also be strings: `"false"`, `"0"`, `"no"`, `"off"` and `""`
  (any case) are false and every other string is true. Other values count by
  truthiness. Environment defaults are read the same way; `PATH` and
  `ENCODING` are used as given. `fast` only selects a parser variant and
  does not change results.
- **Files.** `path` is a file path, an array of paths, or a file `URL`; the
  default is `path.resolve(process.cwd(), ".env")`. A string path starting
  with `~` is expanded with `path.join(os.homedir(), rest)`. Each file is
  read with `fs.readFileSync(path, { encoding })` (`encoding` defaults to
  `"utf8"`). Call `fs.readFileSync`, `os.homedir` and `path.relative`
  when `config` runs: tests replace them.
- **Merging.** The files' variables are merged in order with `populate`
  semantics into one `parsed` object, so the first file wins unless
  `override` is set. A file that cannot be read or parsed is skipped and its
  error is kept; the last such error is returned. Then `parsed` is
  populated into `processEnv` (default `process.env`, used whenever the
  option is not `null` or `undefined`) with the same `override` and
  `debug` options.
- **Return value.** `{ parsed }`, or `{ parsed, error }` when an error was
  kept. The `error` key is absent, not `undefined`, on success.
- **Logging.** `quiet` is the explicit option if one was given, otherwise
  `DOTENV_QUIET`/`DOTENV_CONFIG_QUIET` read from the target
  `processEnv` after it was populated, so a `.env` file can silence its own
  load. When `debug` is on or `quiet` is off, `config` writes one line to
  `console.error`: `◇ injected env (N) from P`, where `N` is the number
  of keys `populate` actually set and `P` is the comma-joined list of each
  path relative to `process.cwd()` (a `URL` is converted with
  `fileURLToPath` first). If computing one of those relative paths throws,
  that error becomes the returned error.
- **Debug output** goes to `console.log` with the prefix `┆ `:
  `┆ no encoding is specified (UTF-8 is used by default)` when no encoding
  was given, `┆ failed to load <path> <error message>` for each file or
  path that failed, plus `populate`'s messages.

```ts
const env: Record<string, string | undefined> = { BASIC: "existing" }
config({ path: [".env.local", ".env"], processEnv: env })
// .env.local wins over .env; BASIC keeps "existing";
// logs "◇ injected env (N) from .env.local,.env" to console.error
config({ path: ".env", override: true, quiet: true }) // overwrites, logs nothing
config({ path: "missing.env", quiet: true })
// { parsed: {}, error: <the ENOENT error from fs.readFileSync> }
populate({}, { A: "1" }) // { A: "1" }
```
