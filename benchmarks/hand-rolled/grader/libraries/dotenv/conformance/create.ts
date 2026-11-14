import { config, configDotenv, parse, populate } from "./index.js"

const parsed: Record<string, string> = parse("BASIC=basic")
const fromBuffer: Record<string, string> = parse(Buffer.from("A=1\nB=2"), { fast: true })
const target: Record<string, string | undefined> = {}
const result: { parsed?: Record<string, string>; error?: Error } = config({
  path: ".env",
  encoding: "utf8",
  quiet: true,
  debug: false,
  override: true,
  fast: false,
  processEnv: target,
})
const many = config({ path: ["a.env", "b.env"], quiet: true })
const fromUrl = config({ path: new URL("file:///tmp/.env") })
const defaults = configDotenv()
const nothing = config()
const failure: string | undefined = many.error?.message
const populated: Record<string, string | undefined> = populate(target, { A: "1", B: undefined }, { override: true, debug: false })
const plain: Record<string, string | undefined> = populate({}, parsed)
void [fromBuffer, result, fromUrl, defaults, nothing, failure, populated, plain]
