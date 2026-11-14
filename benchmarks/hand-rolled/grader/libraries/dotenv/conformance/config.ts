import { config, populate } from "./index.js"

const target: Record<string, string | undefined> = {}
const result: { parsed?: Record<string, string>; error?: Error } = config({
  path: ".env",
  encoding: "latin1",
  quiet: true,
  debug: false,
  override: true,
  processEnv: target,
})
const many = config({ path: ["a.env", "b.env"] })
const fromUrl = config({ path: new URL("file:///tmp/.env"), fast: true })
const nothing = config()
const failure: string | undefined = many.error?.message
const populated: Record<string, string | undefined> = populate(target, { A: "1", B: undefined }, { override: true, debug: true })
const plain: Record<string, string | undefined> = populate({}, { A: "1" })
void [result, fromUrl, nothing, failure, populated, plain]
