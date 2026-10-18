#!/usr/bin/env node
// Project initializer: `npm run setup` (first time) and `npm run configure`
// (change an existing configuration). Asks for the project's name, ports and
// database settings, checks them, then writes .env and the known metadata
// fields in one go. `--help` lists the flags for non-interactive use.
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

import {
  DEFAULT_PORTS,
  TEMPLATE_NAME,
  deriveDefaults,
  findDuplicatePorts,
  generatePassword,
  isTemplateTitle,
  parseEnv,
  parsePort,
  planChanges,
  readLayoutTitle,
  slugify,
  validateAnswers,
  validateComposeProjectName,
  validateDisplayName,
  validateIdentifier,
  validatePassword,
  validateProjectName,
} from "./config.mjs"
import { checkPort, firstAvailablePort, readDockerPorts, suggestPort } from "./ports.mjs"
import { PromptCancelled, color, createPrompter, log } from "./prompt.mjs"

const FILES = [
  ".env.example",
  ".env",
  ".gitignore",
  "package.json",
  "package-lock.json",
  "app/layout.tsx",
  "README.md",
  ".claude/launch.json",
  "docker-compose.override.yml",
]

const HELP = `Usage: npm run setup [-- options]     first-time setup
       npm run configure [-- options] change an existing configuration

Options (each one skips its question):
  --name <name>            project name (package.json, defaults for the rest)
  --display-name <text>    application display name (page title, README)
  --port <port>            host port for the Next.js app
  --db-port <port>         host port for PostgreSQL
  --studio-port <port>     host port for Prisma Studio
  --db-name <name>         database name
  --db-user <name>         database username
  --compose-name <name>    Docker Compose project name
  --studio / --no-studio   start Prisma Studio with every \`docker compose up\`
  --start / --no-start     start the Docker services afterwards
  -y, --yes                accept defaults for everything not given; never asks
  --dry-run                show what would change without writing anything
  --cwd <dir>              project folder (default: current folder)
  -h, --help               show this help

A custom database password can be passed as SETUP_DB_PASSWORD in the
environment; otherwise one is generated.`

class SetupError extends Error {}

function parseArgs(argv) {
  const valueFlags = {
    "--name": "name",
    "--display-name": "displayName",
    "--port": "port",
    "--db-port": "dbPort",
    "--studio-port": "studioPort",
    "--db-name": "dbName",
    "--db-user": "dbUser",
    "--compose-name": "composeName",
    "--cwd": "cwd",
  }
  const args = {}
  for (let i = 0; i < argv.length; i++) {
    const [flag, inline] = argv[i].split(/=(.*)/s)
    if (flag in valueFlags) {
      const value = inline ?? argv[++i]
      if (value === undefined) throw new SetupError(`${flag} needs a value.`)
      args[valueFlags[flag]] = value
    } else if (flag === "-y" || flag === "--yes") args.yes = true
    else if (flag === "--reconfigure") args.reconfigure = true
    else if (flag === "--dry-run") args.dryRun = true
    else if (flag === "--studio" || flag === "--no-studio") args.studio = flag === "--studio"
    else if (flag === "--start" || flag === "--no-start") args.start = flag === "--start"
    else if (flag === "-h" || flag === "--help") args.help = true
    else throw new SetupError(`Unknown option ${argv[i]}. Run with --help for the list.`)
  }
  return args
}

function readFiles(cwd) {
  return Object.fromEntries(
    FILES.map((file) => {
      try {
        return [file, fs.readFileSync(path.join(cwd, file), "utf8")]
      } catch {
        return [file, undefined]
      }
    })
  )
}

function detectDocker(cwd) {
  if (process.env.SETUP_SKIP_DOCKER) return { compose: false, daemon: false }
  const ok = (args) => spawnSync("docker", args, { cwd, stdio: "ignore", timeout: 15_000 }).status === 0
  const compose = ok(["compose", "version"])
  return { compose, daemon: compose && ok(["info"]) }
}

function volumeExists(name) {
  return spawnSync("docker", ["volume", "inspect", name], { stdio: "ignore", timeout: 10_000 }).status === 0
}

/** Docker Compose's default project name: the folder name, normalized. */
function folderProjectName(cwd) {
  return path.basename(cwd).toLowerCase().replace(/[^a-z0-9_-]/g, "")
}

/** Writes every change or none: temp files first, then renames. Returns an undo function. */
function writeAll(cwd, changes) {
  const staged = changes.map(({ path: file, after }) => {
    const target = path.join(cwd, file)
    const temp = `${target}.setup-tmp`
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(temp, after, { mode: file === ".env" ? 0o600 : 0o644 })
    return { target, temp }
  })
  for (const { target, temp } of staged) fs.renameSync(temp, target)
  return () => {
    for (const { path: file, before } of changes) {
      const target = path.join(cwd, file)
      if (before === undefined) fs.rmSync(target, { force: true })
      else fs.writeFileSync(target, before)
    }
  }
}

function timestamp() {
  return new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15)
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    log.line(HELP)
    return 0
  }
  const cwd = path.resolve(args.cwd ?? process.cwd())
  const files = readFiles(cwd)
  if (!files["package.json"] || !files[".env.example"]) {
    throw new SetupError(`${cwd} doesn't look like the project folder: package.json or .env.example is missing.`)
  }

  const interactive = !args.yes
  const prompter = interactive ? createPrompter() : undefined
  try {
    return await run({ args, cwd, files, interactive, p: prompter })
  } finally {
    prompter?.close()
  }
}

async function run({ args, cwd, files, interactive, p }) {
  const configured = files[".env"] !== undefined
  log.line()
  log.line(color.bold(configured && args.reconfigure ? "Project configuration" : "Welcome to Project Initializer"))
  log.line()

  if (configured && !args.reconfigure) {
    log.info("This project is already configured (.env exists).")
    if (!interactive) throw new SetupError("Nothing was changed. To change the configuration, run: npm run configure")
    if (!(await p.confirm("Reconfigure it now? Your current .env is backed up first.", false))) {
      log.line("Nothing was changed.")
      return 0
    }
  } else if (!configured && args.reconfigure) {
    log.info("There's no .env yet, so this is a first-time setup.")
  }
  const reconfiguring = configured

  const env = configured ? parseEnv(files[".env"]) : {}
  const pkg = JSON.parse(files["package.json"])
  const layoutTitle = files["app/layout.tsx"] ? readLayoutTitle(files["app/layout.tsx"]) : undefined
  const docker = detectDocker(cwd)
  const dockerPorts = docker.daemon ? readDockerPorts() : null
  const ownProject = env.COMPOSE_PROJECT_NAME || folderProjectName(cwd)
  if (!docker.compose) log.warn("Docker Compose wasn't found: ports are checked on this machine only.")
  else if (!docker.daemon) log.warn("Docker isn't running: ports used by containers can't be checked.")

  /** Uses the flag, accepts the default (--yes) or asks. */
  async function answer(flag, message, initial, validate) {
    if (flag !== undefined) {
      const error = validate(flag)
      if (error) throw new SetupError(`${message}: ${error}`)
      log.line(`${color.green("?")} ${color.bold(message)} ${flag}`)
      return flag
    }
    if (!interactive) {
      const error = validate(String(initial))
      if (error) throw new SetupError(`${message}: ${error}`)
      return String(initial)
    }
    return p.text(message, { initial, validate })
  }

  async function confirm(flag, message, initial) {
    if (flag !== undefined) return flag
    if (!interactive) return initial
    return p.confirm(message, initial)
  }

  const chosen = {}
  const portOptions = { ownProject, dockerPorts }
  async function askPort(key, flag, message, label, previous) {
    const exclude = Object.values(chosen)
    const preferred = parsePort(previous ?? "").port ?? DEFAULT_PORTS[key]
    const initial = (await firstAvailablePort(preferred, { ...portOptions, exclude })) ?? preferred
    if (flag === undefined && initial !== preferred) log.info(`${message}: ${preferred} is taken, so ${initial} is suggested.`)
    let value = flag
    for (;;) {
      const text = await answer(value, message, initial, (v) => {
        const { port, error } = parsePort(v)
        return error ?? findDuplicatePorts({ ...chosen, [label]: port })
      })
      const port = parsePort(text).port
      const result = await checkPort(port, portOptions)
      if (result.ok) {
        if (result.note) log.info(result.note)
        chosen[label] = port
        return port
      }
      log.error(result.reason)
      const suggestion = await suggestPort(port, { ...portOptions, exclude })
      if (!interactive) {
        throw new SetupError(suggestion ? `Pick another port, e.g. ${suggestion}.` : "Pick another port.")
      }
      if (suggestion && (await p.confirm(`Use ${suggestion} instead?`, true))) {
        chosen[label] = suggestion
        return suggestion
      }
      value = undefined
    }
  }

  // --- Questions --------------------------------------------------------
  const nameFallback =
    pkg.name && pkg.name !== TEMPLATE_NAME && !validateProjectName(pkg.name)
      ? pkg.name
      : slugify(path.basename(cwd)) || "my-app"
  const projectName = await answer(args.name, "Project name", nameFallback, validateProjectName)
  const derived = deriveDefaults(projectName)
  const displayName = await answer(
    args.displayName,
    "Application display name",
    reconfiguring && !isTemplateTitle(layoutTitle) ? layoutTitle : derived.displayName,
    validateDisplayName
  )

  const port = await askPort("port", args.port, "Next.js application port", "the app", env.PORT)
  const dbPort = await askPort("dbPort", args.dbPort, "PostgreSQL host port", "PostgreSQL", env.DB_PORT)

  const volume = `${ownProject}_db-data`
  const hasVolume = docker.daemon && volumeExists(volume)
  if (reconfiguring && hasVolume) {
    log.warn(
      `The database volume ${volume} already exists. Postgres reads the database name, username and password only when the volume is created, so keep them unless you also start a fresh database.`
    )
  }
  const dbName = await answer(args.dbName, "Database name", env.DB_NAME || derived.dbName, (v) =>
    validateIdentifier(v, "database name")
  )
  const dbUser = await answer(args.dbUser, "Database username", env.DB_USER || derived.dbUser, (v) =>
    validateIdentifier(v, "database username")
  )

  let dbPassword
  let keepPassword = false
  if (process.env.SETUP_DB_PASSWORD) {
    const error = validatePassword(process.env.SETUP_DB_PASSWORD)
    if (error) throw new SetupError(`SETUP_DB_PASSWORD: ${error}`)
    dbPassword = process.env.SETUP_DB_PASSWORD
    log.info("Using the database password from SETUP_DB_PASSWORD.")
  } else if (env.DB_PASSWORD && env.DB_PASSWORD !== "change-me" && (await confirm(undefined, "Keep the current database password?", true))) {
    dbPassword = env.DB_PASSWORD
    keepPassword = true
  } else if (await confirm(undefined, "Generate a secure database password?", true)) {
    dbPassword = generatePassword()
  } else {
    dbPassword = await p.secret("Database password", { validate: validatePassword })
  }

  const composeProjectName = await answer(
    args.composeName,
    "Docker Compose project name",
    env.COMPOSE_PROJECT_NAME || derived.composeProjectName,
    validateComposeProjectName
  )
  if (reconfiguring && hasVolume && composeProjectName !== ownProject) {
    log.warn(
      `A new Compose project name means a new, empty database volume (${composeProjectName}_db-data). The old volume ${volume} is kept; remove it yourself with \`docker volume rm ${volume}\` once you don't need it.`
    )
  }

  // Optional services defined in the Compose files.
  let studioPort = parsePort(env.STUDIO_PORT ?? "").port ?? DEFAULT_PORTS.studioPort
  let enableStudio = false
  if (/^ {2}studio:/m.test(files["docker-compose.override.yml"] ?? "")) {
    studioPort = await askPort("studioPort", args.studioPort, "Prisma Studio host port", "Prisma Studio", env.STUDIO_PORT)
    enableStudio = await confirm(
      args.studio,
      "Start Prisma Studio with every `docker compose up`?",
      (env.COMPOSE_PROFILES ?? "").split(",").includes("tools")
    )
  }

  const start = docker.daemon ? await confirm(args.start, "Start Docker services after setup?", interactive) : false

  const answers = {
    projectName,
    displayName,
    composeProjectName,
    port,
    dbPort,
    studioPort,
    dbName,
    dbUser,
    dbPassword,
    keepPassword,
    enableStudio,
  }

  // --- Plan and confirm --------------------------------------------------
  log.line()
  log.line(color.bold("Checking project configuration..."))
  const errors = validateAnswers(answers)
  if (errors.length) throw new SetupError(errors.join("\n"))
  log.success(`Project name validated (${projectName})`)

  // Ports again, right before writing: time has passed since the questions.
  const portChecks = [
    ["Application port", port],
    ["PostgreSQL port", dbPort],
    ["Prisma Studio port", studioPort],
  ]
  for (const [label, value] of portChecks) {
    const result = await checkPort(value, { ownProject, dockerPorts: docker.daemon ? readDockerPorts() : null })
    if (!result.ok) throw new SetupError(`${result.reason} Nothing was written; run setup again to pick another.`)
    log.success(`${label} ${value} available`)
  }

  const changes = planChanges(answers, files)
  if (files[".gitignore"] !== undefined && !gitIgnores(cwd, ".env")) {
    changes.push({
      path: ".gitignore",
      before: files[".gitignore"],
      after: `${files[".gitignore"].replace(/\n?$/, "\n")}\n# Local configuration written by npm run setup\n.env\n.env.backup-*\n`,
    })
  }

  if (reconfiguring) printEnvDiff(env, parseEnv(changes.find((c) => c.path === ".env")?.after ?? files[".env"]))

  if (args.dryRun) {
    log.line()
    log.info(`Dry run: these files would change: ${changes.map((c) => c.path).join(", ") || "none"}`)
    return 0
  }
  if (!changes.length) {
    log.success("Everything already matches; nothing to write.")
    return 0
  }
  if (interactive && !(await p.confirm(`Write ${changes.map((c) => c.path).join(", ")}?`, true))) {
    log.line("Nothing was written.")
    return 0
  }

  // --- Write ---------------------------------------------------------------
  let backup
  if (reconfiguring && changes.some((c) => c.path === ".env")) {
    backup = `.env.backup-${timestamp()}`
    fs.copyFileSync(path.join(cwd, ".env"), path.join(cwd, backup))
    fs.chmodSync(path.join(cwd, backup), 0o600)
  }
  const undo = writeAll(cwd, changes)
  log.success(`Environment configuration generated (.env${backup ? `, previous one saved as ${backup}` : ""})`)

  if (docker.compose) {
    const check = spawnSync("docker", ["compose", "config", "--quiet"], { cwd, encoding: "utf8", timeout: 30_000 })
    if (check.status !== 0) {
      undo()
      throw new SetupError(`docker compose config failed, so every file was restored:\n${check.stderr.trim()}`)
    }
    log.success("Docker configuration validated")
  } else {
    log.warn("Docker Compose not found: skipped validating the Compose files")
  }

  const metadata = changes.map((c) => c.path).filter((file) => file !== ".env")
  if (metadata.length) log.success(`Project metadata updated (${metadata.join(", ")})`)
  log.info("The database password is in .env and isn't shown here.")

  // --- Start and next steps ------------------------------------------------
  let started = false
  if (start) {
    log.line()
    log.line(color.bold("Starting Docker services (Postgres, migrations, app)..."))
    const up = spawnSync("docker", ["compose", "up", "--build", "-V", "--detach", "--wait", "--wait-timeout", "300"], {
      cwd,
      stdio: "inherit",
    })
    started = up.status === 0
    if (started) log.success("Docker services are up and healthy")
    else log.error("docker compose up failed; see the output above. Your configuration is saved.")
  }

  const url = parseEnv(changes.find((c) => c.path === ".env")?.after ?? files[".env"]).NEXT_PUBLIC_APP_URL
  log.line()
  log.line(color.bold(color.green(reconfiguring ? "Configuration updated!" : "Project initialized successfully!")))
  log.line()
  log.line(color.bold("Next steps:"))
  const steps = started
    ? [
        `Open ${url} and sign up; the first account owns the first organization.`,
        `Follow the logs: ${color.cyan("docker compose logs -f web")}`,
        `Stop with ${color.cyan("docker compose down")} (your data is kept).`,
      ]
    : [
        `Start Postgres, run Prisma migrations and start the app (each waits for the one before):\n     ${color.cyan("docker compose up --build -V")}`,
        `Check that migrations are applied: ${color.cyan("npm run db:status")}`,
        `Open ${url} and sign up; the first account owns the first organization.`,
      ]
  if (!reconfiguring) steps.push(`Commit the renamed project files: ${color.cyan(`git add -A && git commit -m "chore: initialize ${projectName}"`)}`)
  steps.forEach((step, i) => log.line(`  ${i + 1}. ${step}`))
  log.line(color.dim(`  Prisma Studio: docker compose up studio, then http://localhost:${studioPort}`))
  return started || !start ? 0 : 1
}

function gitIgnores(cwd, file) {
  const result = spawnSync("git", ["check-ignore", "-q", file], { cwd, stdio: "ignore" })
  // 0: ignored, 1: not ignored, anything else: not a git repo or no git.
  return result.status !== 1
}

function printEnvDiff(before, after) {
  const secret = (key) => /PASSWORD|DATABASE_URL/.test(key)
  const lines = Object.keys(after)
    .filter((key) => before[key] !== after[key])
    .map((key) =>
      secret(key)
        ? `  ${key}: ${color.dim("(changed, not shown)")}`
        : `  ${key}: ${before[key] || color.dim(key in before ? "(empty)" : "(unset)")} → ${after[key] || color.dim("(empty)")}`
    )
  if (lines.length) {
    log.line(color.bold("Changes to .env:"))
    lines.forEach((line) => log.line(line))
  }
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    if (error instanceof PromptCancelled) {
      log.line()
      log.error("Setup cancelled. Nothing was written.")
      process.exit(130)
    }
    if (error instanceof SetupError) {
      log.error(error.message)
      process.exit(1)
    }
    log.error(error.stack ?? String(error))
    process.exit(1)
  })
