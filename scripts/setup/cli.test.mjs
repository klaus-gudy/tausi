// End-to-end runs of the setup CLI against a copy of the project's
// configuration files in a temporary folder. Docker is left out
// (SETUP_SKIP_DOCKER) so the tests don't depend on it.
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import net from "node:net"
import os from "node:os"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import { parseEnv } from "./config.mjs"

const root = fileURLToPath(new URL("../../", import.meta.url))
const cli = path.join(root, "scripts/setup/cli.mjs")
const COPIED = [".env.example", "package.json", "package-lock.json", "app/layout.tsx", "README.md", "docker-compose.override.yml"]

function makeProject() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "setup-cli-"))
  for (const file of COPIED) {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true })
    fs.copyFileSync(path.join(root, file), path.join(dir, file))
  }
  return dir
}

function setup(dir, args = [], { input, env = {} } = {}) {
  const result = spawnSync(process.execPath, [cli, "--cwd", dir, ...args], {
    encoding: "utf8",
    input,
    env: { ...process.env, SETUP_SKIP_DOCKER: "1", NO_COLOR: "1", ...env },
    timeout: 30_000,
  })
  return { ...result, output: result.stdout + result.stderr }
}

const readEnv = (dir) => parseEnv(fs.readFileSync(path.join(dir, ".env"), "utf8"))

function listen() {
  return new Promise((resolve) => {
    const server = net.createServer().listen(0, "0.0.0.0", () => resolve(server))
  })
}

test("defaults: a fresh project initializes with --yes", () => {
  const dir = makeProject()
  const { status, output } = setup(dir, ["--yes", "--name", "inventory-app"])
  assert.equal(status, 0, output)
  assert.match(output, /Project initialized successfully/)
  const env = readEnv(dir)
  assert.equal(env.COMPOSE_PROJECT_NAME, "inventory-app")
  assert.equal(env.DB_NAME, "inventory_app")
  assert.match(env.DB_PASSWORD, /^[A-Za-z0-9_-]{32}$/)
  assert.ok(!output.includes(env.DB_PASSWORD), "the password is not printed")
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8")).name, "inventory-app")
  assert.match(fs.readFileSync(path.join(dir, "app/layout.tsx"), "utf8"), /title: "Inventory App"/)
  assert.equal(fs.statSync(path.join(dir, ".env")).mode & 0o777, 0o600)
})

test("custom values from flags and SETUP_DB_PASSWORD", async () => {
  const dir = makeProject()
  const { status, output } = setup(
    dir,
    ["--yes", "--name", "billing", "--display-name", "Billing Portal", "--port", "3902", "--db-port", "5940",
      "--studio-port", "5956", "--db-name", "billing_db", "--db-user", "billing_user", "--compose-name", "billing-dev", "--studio"],
    { env: { SETUP_DB_PASSWORD: "My$ecret#Pass 1" } }
  )
  assert.equal(status, 0, output)
  const env = readEnv(dir)
  assert.equal(env.PORT, "3902")
  assert.equal(env.NEXT_PUBLIC_APP_URL, "http://localhost:3902")
  assert.equal(env.DB_PORT, "5940")
  assert.equal(env.DB_PASSWORD, "My$ecret#Pass 1")
  assert.equal(env.DATABASE_URL, "postgresql://billing_user:My%24ecret%23Pass%201@localhost:5940/billing_db?schema=app")
  assert.match(env.DOCKER_DATABASE_URL, /@db:5432\/billing_db/)
  assert.equal(env.COMPOSE_PROJECT_NAME, "billing-dev")
  assert.equal(env.COMPOSE_PROFILES, "tools")
})

test("an occupied application port is refused with a suggestion, and nothing is written", async () => {
  const server = await listen()
  try {
    const dir = makeProject()
    const { status, output } = setup(dir, ["--yes", "--port", String(server.address().port)])
    assert.equal(status, 1)
    assert.match(output, /already in use/)
    assert.match(output, /Pick another port, e\.g\. \d+/)
    assert.equal(fs.existsSync(path.join(dir, ".env")), false)
    assert.equal(fs.readFileSync(path.join(dir, "package.json"), "utf8"), fs.readFileSync(path.join(root, "package.json"), "utf8"))
  } finally {
    server.close()
  }
})

test("an occupied PostgreSQL port is refused", async () => {
  const server = await listen()
  try {
    const dir = makeProject()
    const { status, output } = setup(dir, ["--yes", "--db-port", String(server.address().port)])
    assert.equal(status, 1)
    assert.match(output, /PostgreSQL host port/)
    assert.match(output, /already in use/)
  } finally {
    server.close()
  }
})

test("the same port twice in one project is refused", () => {
  const dir = makeProject()
  const { status, output } = setup(dir, ["--yes", "--port", "3950", "--db-port", "3950"])
  assert.equal(status, 1)
  assert.match(output, /chosen for both/)
})

test("interactive: an occupied port offers the next free one", async () => {
  const server = await listen()
  const { port } = server.address()
  try {
    const dir = makeProject()
    // name, display name, app port (taken) -> accept suggestion, then defaults.
    const input = ["shop", "", String(port), "y", "", "", "", "", "", "", "", "y", ""].join("\n") + "\n"
    const { status, output } = setup(dir, [], { input })
    assert.equal(status, 0, output)
    assert.match(output, new RegExp(`Port ${port} is already in use`))
    assert.match(output, /Use \d+ instead\?/)
    assert.notEqual(readEnv(dir).PORT, String(port))
  } finally {
    server.close()
  }
})

test("re-running setup never silently overwrites .env", () => {
  const dir = makeProject()
  assert.equal(setup(dir, ["--yes"]).status, 0)
  const before = fs.readFileSync(path.join(dir, ".env"), "utf8")

  const again = setup(dir, ["--yes", "--port", "3999"])
  assert.equal(again.status, 1)
  assert.match(again.output, /already configured/)
  assert.equal(fs.readFileSync(path.join(dir, ".env"), "utf8"), before)

  // Interactive: declining (the default) leaves everything as it was.
  const declined = setup(dir, [], { input: "\n" })
  assert.equal(declined.status, 0)
  assert.match(declined.output, /Nothing was changed/)
  assert.equal(fs.readFileSync(path.join(dir, ".env"), "utf8"), before)
})

test("configure keeps the password and extra variables, and backs up .env", () => {
  const dir = makeProject()
  assert.equal(setup(dir, ["--yes"]).status, 0)
  fs.appendFileSync(path.join(dir, ".env"), "SENTRY_DSN=https://example.invalid/1\n")
  const before = readEnv(dir)

  const { status, output } = setup(dir, ["--reconfigure", "--yes", "--port", "3998"])
  assert.equal(status, 0, output)
  const after = readEnv(dir)
  assert.equal(after.PORT, "3998")
  assert.equal(after.DB_PASSWORD, before.DB_PASSWORD)
  assert.equal(after.SENTRY_DSN, "https://example.invalid/1")
  const backups = fs.readdirSync(dir).filter((f) => f.startsWith(".env.backup-"))
  assert.equal(backups.length, 1)
  assert.equal(parseEnv(fs.readFileSync(path.join(dir, backups[0]), "utf8")).PORT, before.PORT)
  assert.ok(!output.includes(before.DB_PASSWORD))
})

test("--dry-run writes nothing", () => {
  const dir = makeProject()
  const { status, output } = setup(dir, ["--yes", "--dry-run", "--name", "dry"])
  assert.equal(status, 0, output)
  assert.match(output, /Dry run/)
  assert.equal(fs.existsSync(path.join(dir, ".env")), false)
})

test("invalid answers are rejected before anything is written", () => {
  const dir = makeProject()
  const { status, output } = setup(dir, ["--yes", "--name", "Bad Name"])
  assert.equal(status, 1)
  assert.match(output, /Project name: Use lowercase/)
  assert.equal(fs.existsSync(path.join(dir, ".env")), false)
})

test("Ctrl+D (end of input) cancels cleanly without writing", () => {
  const dir = makeProject()
  const { status, output } = setup(dir, [], { input: "shop\n" })
  assert.equal(status, 130)
  assert.match(output, /cancelled/)
  assert.equal(fs.existsSync(path.join(dir, ".env")), false)
})
