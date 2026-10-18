import assert from "node:assert/strict"
import fs from "node:fs"
import { test } from "node:test"

import {
  buildEnvValues,
  databaseUrl,
  deriveDefaults,
  findDuplicatePorts,
  formatEnvValue,
  generatePassword,
  parseEnv,
  parsePort,
  planChanges,
  readLayoutTitle,
  renderEnv,
  slugify,
  updateLayoutMetadata,
  updatePackageLock,
  updateReadmeHeading,
  validateAnswers,
  validateComposeProjectName,
  validateIdentifier,
  validatePassword,
  validateProjectName,
} from "./config.mjs"

const root = new URL("../../", import.meta.url)
const read = (file) => fs.readFileSync(new URL(file, root), "utf8")

const answers = {
  projectName: "inventory-app",
  displayName: "Inventory App",
  composeProjectName: "inventory-app",
  port: 3002,
  dbPort: 5440,
  studioPort: 5556,
  dbName: "inventory_db",
  dbUser: "inventory_user",
  dbPassword: "p@ss:w/rd#$ 100%",
  enableStudio: false,
}

test("names: slugs, identifiers and display names follow from the project name", () => {
  assert.equal(slugify("My Inventory App!"), "my-inventory-app")
  assert.deepEqual(deriveDefaults("inventory-app"), {
    displayName: "Inventory App",
    composeProjectName: "inventory-app",
    dbName: "inventory_app",
    dbUser: "inventory_app",
  })
  assert.equal(deriveDefaults("3d-shop").dbName, "app_3d_shop")
})

test("validation rejects bad names, ports and passwords", () => {
  assert.equal(validateProjectName("inventory-app"), undefined)
  for (const bad of ["", "Inventory", "-app", "app-", "my app", "a".repeat(51)]) {
    assert.ok(validateProjectName(bad), bad)
  }
  assert.ok(validateComposeProjectName("_app"))
  assert.equal(validateComposeProjectName("my_app-2"), undefined)
  assert.ok(validateIdentifier("inventory-db"))
  assert.ok(validateIdentifier("1db"))
  assert.equal(validateIdentifier("inventory_db"), undefined)

  assert.deepEqual(parsePort("3002"), { port: 3002 })
  for (const bad of ["abc", "80", "70000", "30.5", "-1", ""]) assert.ok(parsePort(bad).error, bad)

  assert.ok(validatePassword("short"))
  assert.ok(validatePassword("has'a-single-quote"))
  assert.equal(validatePassword(generatePassword()), undefined)
})

test("duplicate ports within a project are reported", () => {
  assert.match(findDuplicatePorts({ app: 3000, db: 3000 }), /both app and db/)
  assert.equal(findDuplicatePorts({ app: 3000, db: 5432 }), undefined)
  assert.ok(validateAnswers({ ...answers, dbPort: 3002 }).some((e) => /3002/.test(e)))
  assert.deepEqual(validateAnswers(answers), [])
})

test("generated passwords are long, URL-safe and different each time", () => {
  const a = generatePassword()
  assert.match(a, /^[A-Za-z0-9_-]{32}$/)
  assert.notEqual(a, generatePassword())
})

test("database URLs escape credentials and tell host from container networking", () => {
  const values = buildEnvValues(answers)
  assert.equal(
    values.DATABASE_URL,
    "postgresql://inventory_user:p%40ss%3Aw%2Frd%23%24%20100%25@localhost:5440/inventory_db?schema=app"
  )
  assert.match(values.DOCKER_DATABASE_URL, /@db:5432\/inventory_db\?schema=app$/)
  const url = new URL(values.DATABASE_URL)
  assert.equal(decodeURIComponent(url.password), answers.dbPassword)
  assert.equal(databaseUrl({ user: "u", password: "p", host: "h", port: 1, name: "n" }), "postgresql://u:p@h:1/n")
})

test(".env values survive a write and read, special characters included", () => {
  for (const value of ["plain", "p@ss:w/rd#$ 100%", "a b", "$HOME", "x#y", ""]) {
    assert.equal(parseEnv(`KEY=${formatEnvValue(value)}`).KEY, value, value)
  }
  assert.throws(() => formatEnvValue("it's"))
  assert.deepEqual(parseEnv(`# comment\nA=1 # note\nB="x # y"\nexport C='$D'\n`), { A: "1", B: "x # y", C: "$D" })
})

test("Node reads generated .env files the way setup wrote them", () => {
  const dir = fs.mkdtempSync(`${process.env.TMPDIR ?? "/tmp"}/setup-env-`)
  const file = `${dir}/.env`
  fs.writeFileSync(file, renderEnv(read(".env.example"), buildEnvValues(answers)))
  const env = {}
  // process.loadEnvFile only fills variables that aren't set yet.
  const saved = { ...process.env }
  for (const key of Object.keys(parseEnv(fs.readFileSync(file, "utf8")))) delete process.env[key]
  process.loadEnvFile(file)
  for (const key of ["DB_PASSWORD", "DATABASE_URL", "COMPOSE_PROFILES"]) env[key] = process.env[key]
  process.env = saved
  assert.equal(env.DB_PASSWORD, answers.dbPassword)
  assert.equal(env.DATABASE_URL, buildEnvValues(answers).DATABASE_URL)
  assert.equal(env.COMPOSE_PROFILES, "")
})

test("renderEnv keeps the template's comments and the variables it doesn't own", () => {
  const template = "# Heading\nPORT=3000\nDB_POOL_MAX=10\n"
  const out = renderEnv(template, { PORT: "3002" }, { DB_POOL_MAX: "20", SENTRY_DSN: "https://x" })
  assert.equal(out, "# Heading\nPORT=3002\nDB_POOL_MAX=20\n\n# Other variables, kept from your previous .env\nSENTRY_DSN=https://x\n")
})

test("the app URL follows the port unless it was set to a real address", () => {
  assert.equal(buildEnvValues(answers).NEXT_PUBLIC_APP_URL, "http://localhost:3002")
  assert.equal(
    buildEnvValues(answers, { NEXT_PUBLIC_APP_URL: "http://localhost:3000" }).NEXT_PUBLIC_APP_URL,
    "http://localhost:3002"
  )
  assert.equal(
    buildEnvValues(answers, { NEXT_PUBLIC_APP_URL: "https://app.example.com" }).NEXT_PUBLIC_APP_URL,
    "https://app.example.com"
  )
})

test("metadata edits touch only their own fields", () => {
  const layout = read("app/layout.tsx")
  const updated = updateLayoutMetadata(layout, 'Inventory "App"')
  assert.equal(readLayoutTitle(updated), 'Inventory "App"')
  assert.equal(updated.replace(/\n {2}(title|description):.*/g, ""), layout.replace(/\n {2}(title|description):.*/g, ""))
  // A description someone wrote stays.
  const custom = updated.replace(/description: .*,/, 'description: "Track stock",')
  assert.match(updateLayoutMetadata(custom, "Other"), /description: "Track stock"/)

  const lock = JSON.parse(updatePackageLock(read("package-lock.json"), "inventory-app"))
  assert.equal(lock.name, "inventory-app")
  assert.equal(lock.packages[""].name, "inventory-app")

  assert.equal(updateReadmeHeading("# Web Starter\nbody", "Inventory App"), "# Inventory App\nbody")
  assert.equal(updateReadmeHeading("# My own title\nbody", "Inventory App"), "# My own title\nbody")
  assert.equal(updateReadmeHeading("# Old Name\nbody", "New Name", "Old Name"), "# New Name\nbody")
})

test("planChanges needs the template and keeps extra variables from an earlier .env", () => {
  assert.throws(() => planChanges(answers, {}), /\.env\.example is missing/)
  const files = {
    ".env.example": read(".env.example"),
    ".env": "PORT=3000\nDB_POOL_MAX=25\nSENTRY_DSN=https://x\n",
    "package.json": read("package.json"),
  }
  const changes = planChanges(answers, files)
  assert.deepEqual(changes.map((c) => c.path), [".env", "package.json"])
  const env = parseEnv(changes[0].after)
  assert.equal(env.DB_POOL_MAX, "25")
  assert.equal(env.SENTRY_DSN, "https://x")
  assert.equal(env.PORT, "3002")
  // Unchanged files aren't rewritten.
  const again = planChanges(answers, { ...files, ".env": changes[0].after, "package.json": changes[1].after })
  assert.deepEqual(again, [])
})

test("the template holds placeholders, not credentials", () => {
  const env = parseEnv(read(".env.example"))
  assert.equal(env.DB_PASSWORD, "change-me")
  assert.equal(env.COMPOSE_PROJECT_NAME, "my-app")
})
