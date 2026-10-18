import assert from "node:assert/strict"
import net from "node:net"
import { test } from "node:test"

import { checkPort, firstAvailablePort, isHostPortFree, readDockerPorts, suggestPort } from "./ports.mjs"

function listen(host = "0.0.0.0") {
  return new Promise((resolve) => {
    const server = net.createServer().listen(0, host, () => resolve(server))
  })
}

test("a port something listens on is reported as taken, with a free suggestion", async () => {
  const server = await listen()
  const { port } = server.address()
  try {
    assert.equal(await isHostPortFree(port), false)
    const result = await checkPort(port)
    assert.equal(result.ok, false)
    assert.match(result.reason, /already in use/)
    const suggestion = await suggestPort(port)
    assert.ok(suggestion > port)
    assert.equal(await isHostPortFree(suggestion), true)
  } finally {
    server.close()
  }
})

test("a listener on 127.0.0.1 only is still detected", async () => {
  const server = await listen("127.0.0.1")
  try {
    assert.equal(await isHostPortFree(server.address().port), false)
  } finally {
    server.close()
  }
})

test("ports published by other projects' containers are taken; the project's own are fine", async () => {
  const dockerPorts = new Map([
    [5440, [{ container: "other-db-1", project: "other", running: true }]],
    [5441, [{ container: "old-db-1", project: "old", running: false }]],
    [5442, [{ container: "mine-db-1", project: "mine", running: true }]],
  ])
  const busy = async () => false
  const free = async () => true
  assert.match((await checkPort(5440, { dockerPorts, ownProject: "mine", isFree: free })).reason, /used by other-db-1 \(project other\)/)
  assert.match((await checkPort(5441, { dockerPorts, ownProject: "mine", isFree: free })).reason, /stopped container old-db-1/)
  const own = await checkPort(5442, { dockerPorts, ownProject: "mine", isFree: busy })
  assert.equal(own.ok, true)
  assert.match(own.note, /own containers/)
  assert.equal((await checkPort(5442, { dockerPorts, ownProject: "else", isFree: busy })).ok, false)
})

test("suggestions skip ports already chosen for the same project", async () => {
  const isFree = async () => true
  assert.equal(await firstAvailablePort(3000, { exclude: [3000, 3001], isFree }), 3002)
  assert.equal(await firstAvailablePort(3000, { isFree }), 3000)
})

test("readDockerPorts parses docker inspect output and survives a missing Docker", () => {
  const fake = (_, args) =>
    args[0] === "ps"
      ? "abc\n"
      : '"/proj-db-1"\t"proj"\ttrue\t{"5432/tcp":[{"HostIp":"","HostPort":"5440"}]}\n' +
        '"/loose"\tnull\tfalse\t{}\n'
  const ports = readDockerPorts(fake)
  assert.deepEqual(ports.get(5440), [{ container: "proj-db-1", project: "proj", running: true }])
  assert.equal(
    readDockerPorts(() => {
      throw new Error("docker: command not found")
    }),
    null
  )
})
