import { spawn } from "node:child_process"

const MAX_CAPTURE_BYTES = 4_000_000

// Runs one child process with a hard timeout. Extra pipes beyond stdio are
// exposed as `channels` so a harness child can report on fd 3, apart from
// anything the code under test prints.
export function runProcess(command, args, { cwd, env, timeoutMs, channel = false }) {
  return new Promise((resolvePromise) => {
    const stdio = channel ? ["ignore", "pipe", "pipe", "pipe"] : ["ignore", "pipe", "pipe"]
    const child = spawn(command, args, { cwd, env, stdio, detached: process.platform !== "win32" })
    const capture = { stdout: "", stderr: "", channel: "" }
    const append = (key) => (chunk) => {
      if (capture[key].length < MAX_CAPTURE_BYTES) capture[key] += chunk.toString("utf8")
    }
    child.stdout.on("data", append("stdout"))
    child.stderr.on("data", append("stderr"))
    if (channel) child.stdio[3].on("data", append("channel"))
    let timedOut = false
    const kill = () => {
      try {
        process.kill(-child.pid, "SIGKILL")
      } catch {
        child.kill("SIGKILL")
      }
    }
    const timer = setTimeout(() => {
      timedOut = true
      kill()
    }, timeoutMs)
    child.on("error", (error) => {
      capture.stderr += String(error)
    })
    child.on("close", (exitCode, signal) => {
      clearTimeout(timer)
      resolvePromise({ ...capture, exitCode, signal, timedOut })
    })
  })
}

export async function mapLimit(items, limit, run) {
  const results = new Array(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const index = next
      next += 1
      results[index] = await run(items[index], index)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}
