// A small terminal UI on node:readline: questions with defaults and
// validation, yes/no questions, hidden input and coloured status lines. Kept
// dependency-free so setup runs before `npm install`.
import readline from "node:readline"
import { Writable } from "node:stream"

const useColor = process.stdout.isTTY && !process.env.NO_COLOR
const paint = (code) => (text) => (useColor ? `\x1b[${code}m${text}\x1b[0m` : String(text))

export const color = {
  bold: paint(1),
  dim: paint(2),
  red: paint(31),
  green: paint(32),
  yellow: paint(33),
  cyan: paint(36),
}

export const log = {
  line: (text = "") => process.stdout.write(`${text}\n`),
  success: (text) => process.stdout.write(`${color.green("✔")} ${text}\n`),
  warn: (text) => process.stdout.write(`${color.yellow("⚠")} ${text}\n`),
  error: (text) => process.stderr.write(`${color.red("✖")} ${text}\n`),
  info: (text) => process.stdout.write(`${color.cyan("ℹ")} ${text}\n`),
}

export class PromptCancelled extends Error {}

/** Opens a prompt session on stdin. Call close() when done. */
export function createPrompter() {
  let muted = false
  const output = new Writable({
    write(chunk, encoding, callback) {
      if (!muted) process.stdout.write(chunk, encoding)
      callback()
    },
  })
  const rl = readline.createInterface({
    input: process.stdin,
    output,
    terminal: Boolean(process.stdin.isTTY),
  })
  // Reading through the iterator buffers lines typed (or piped) ahead.
  const lines = rl[Symbol.asyncIterator]()
  let cancel
  const cancelled = new Promise((_, reject) => {
    cancel = () => reject(new PromptCancelled())
  })
  cancelled.catch(() => {})
  rl.on("SIGINT", () => cancel())
  rl.on("close", () => cancel())

  async function readLine(question, { hidden = false } = {}) {
    process.stdout.write(question)
    muted = hidden
    try {
      const next = await Promise.race([lines.next(), cancelled])
      if (next.done) throw new PromptCancelled()
      return next.value
    } finally {
      if (hidden) {
        muted = false
        process.stdout.write("\n")
      }
    }
  }

  const label = (message, hint) =>
    `${color.green("?")} ${color.bold(message)}${hint ? ` ${color.dim(hint)}` : ""} `

  return {
    /** Asks until `validate` (returning an error message or undefined) accepts the answer. */
    async text(message, { initial, validate } = {}) {
      for (;;) {
        const answer = (await readLine(label(message, initial !== undefined ? `(${initial})` : ""))).trim()
        const value = answer === "" && initial !== undefined ? String(initial) : answer
        const error = validate?.(value)
        if (!error) return value
        log.error(error)
      }
    },

    async confirm(message, initial = true) {
      for (;;) {
        const answer = (await readLine(label(message, initial ? "(Y/n)" : "(y/N)"))).trim().toLowerCase()
        if (answer === "") return initial
        if (["y", "yes"].includes(answer)) return true
        if (["n", "no"].includes(answer)) return false
        log.error("Answer y or n.")
      }
    },

    /** Hidden input, asked twice. */
    async secret(message, { validate } = {}) {
      for (;;) {
        const value = await readLine(label(message, "(hidden)"), { hidden: true })
        const error = validate?.(value)
        if (error) {
          log.error(error)
          continue
        }
        const again = await readLine(label("Repeat it", "(hidden)"), { hidden: true })
        if (again === value) return value
        log.error("The two entries don't match.")
      }
    },

    close: () => {
      rl.removeAllListeners("close")
      rl.close()
    },
  }
}
