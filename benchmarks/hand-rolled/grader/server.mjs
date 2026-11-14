// Hand-Rolled grader (Trunchbull grader protocol v1, port 8080).
//
// GET /health    200 once TypeScript and the harness are loaded.
// POST /evaluate grades one answer: hard gates (imports, strict typecheck,
//                load), then the library's hidden upstream tests and a
//                differential fuzz run against the real library.
//
// The grader makes no network calls. Upstream tests, fuzz targets and the
// real libraries are baked into the image; the model never reaches them.
import { createServer } from "node:http"
import { grade, GradeError } from "./harness/grade.mjs"

const PORT = 8080
const MAX_REQUEST_BYTES = 8_000_000
const CONCURRENCY = 2

let active = 0
const waiting = []
async function limited(task) {
  if (active >= CONCURRENCY) await new Promise((resolve) => waiting.push(resolve))
  active += 1
  try {
    return await task()
  } finally {
    active -= 1
    waiting.shift()?.()
  }
}

function send(response, status, body) {
  const text = JSON.stringify(body)
  response.writeHead(status, { "content-type": "application/json", "content-length": Buffer.byteLength(text) })
  response.end(text)
}

async function readBody(request) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > MAX_REQUEST_BYTES) throw new GradeError("The request is too large.")
    chunks.push(chunk)
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"))
}

createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/health") return send(response, 200, { ok: true })
  if (request.method !== "POST" || request.url !== "/evaluate") return send(response, 404, { error: "Not found." })
  let body
  try {
    body = await readBody(request)
    if (body?.protocolVersion !== 1) throw new GradeError("Unsupported grader protocol version.")
    if (typeof body.output !== "string") throw new GradeError("output must be a string.")
  } catch (error) {
    return send(response, 400, { error: error instanceof Error ? error.message : "Invalid request." })
  }
  try {
    send(response, 200, await limited(() => grade(body)))
  } catch (error) {
    const status = error instanceof GradeError ? 400 : 500
    send(response, status, { error: error instanceof Error ? error.message : "Grading failed." })
  }
}).listen(PORT, "0.0.0.0")
