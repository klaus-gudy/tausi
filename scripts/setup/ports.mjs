// Host port checks for the project initializer. A port counts as taken when
// something on this machine listens on it, or a Docker container (running or
// stopped) publishes it. A free result doesn't reserve the port: something can
// still take it before Docker starts.
import { execFileSync } from "node:child_process"
import net from "node:net"

import { MAX_PORT } from "./config.mjs"

// Binding on each address catches listeners bound to only one of them, which
// macOS lets a wildcard bind sit beside.
const BIND_HOSTS = ["0.0.0.0", "127.0.0.1", "::"]

function canBind(port, host) {
  return new Promise((resolve) => {
    const server = net.createServer()
    server.unref()
    server.once("error", (error) => {
      // No IPv6 on this machine: nothing can be listening there either.
      resolve(error.code === "EADDRNOTAVAIL" || error.code === "EAFNOSUPPORT")
    })
    server.listen({ port, host, exclusive: true }, () => server.close(() => resolve(true)))
  })
}

function acceptsConnections(port, host = "127.0.0.1", timeout = 300) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host })
    const done = (result) => {
      socket.destroy()
      resolve(result)
    }
    socket.setTimeout(timeout, () => done(false))
    socket.once("connect", () => done(true))
    socket.once("error", () => done(false))
  })
}

/** True when nothing on this machine listens on the port. */
export async function isHostPortFree(port) {
  for (const host of BIND_HOSTS) {
    if (!(await canBind(port, host))) return false
  }
  return !(await acceptsConnections(port))
}

/**
 * Host ports published by Docker containers, including stopped ones, whose
 * ports come back when they start. Returns a Map of port -> owners, or null
 * when Docker isn't available.
 */
export function readDockerPorts(run = execFileSync) {
  const exec = (args) =>
    run("docker", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 10_000 })
  try {
    const ids = exec(["ps", "-aq"]).split("\n").filter(Boolean)
    const ports = new Map()
    if (!ids.length) return ports
    const format =
      '{{json .Name}}\t{{json (index .Config.Labels "com.docker.compose.project")}}\t{{.State.Running}}\t{{json .HostConfig.PortBindings}}'
    for (const line of exec(["inspect", "--format", format, ...ids]).split("\n").filter(Boolean)) {
      const [name, project, running, bindings] = line.split("\t")
      const owner = {
        container: JSON.parse(name).replace(/^\//, ""),
        project: JSON.parse(project) || undefined,
        running: running === "true",
      }
      for (const hostBindings of Object.values(JSON.parse(bindings) ?? {})) {
        for (const { HostPort } of hostBindings ?? []) {
          const port = Number(HostPort)
          if (!port) continue
          if (!ports.has(port)) ports.set(port, [])
          ports.get(port).push(owner)
        }
      }
    }
    return ports
  } catch {
    return null
  }
}

/**
 * Checks one port.
 * @param options.ownProject Compose project being configured: its own
 *   containers may hold the port, since they're what will use it.
 * @param options.dockerPorts result of readDockerPorts()
 * @param options.isFree host check, replaceable in tests
 * @returns {{ ok: true, note?: string } | { ok: false, reason: string }}
 */
export async function checkPort(port, { ownProject, dockerPorts, isFree = isHostPortFree } = {}) {
  const owners = dockerPorts?.get(port) ?? []
  const others = owners.filter((owner) => !ownProject || owner.project !== ownProject)
  const own = owners.length > others.length
  if (others.length) {
    const owner = others.find((o) => o.running) ?? others[0]
    const project = owner.project ? ` (project ${owner.project})` : ""
    const state = owner.running ? "is used by" : "is reserved by the stopped container"
    return { ok: false, reason: `Port ${port} ${state} ${owner.container}${project}.` }
  }
  if (await isFree(port)) return { ok: true }
  if (own) return { ok: true, note: `Port ${port} is held by this project's own containers.` }
  return { ok: false, reason: `Port ${port} is already in use on this machine.` }
}

/** The first port after `start` that passes checkPort and isn't in `exclude`. */
export async function suggestPort(start, { exclude = [], ...options } = {}) {
  for (let port = start + 1; port <= Math.min(start + 500, MAX_PORT); port++) {
    if (exclude.includes(port)) continue
    if ((await checkPort(port, options)).ok) return port
  }
  return undefined
}

/** `start` itself when it's available, otherwise the next available port. */
export async function firstAvailablePort(start, options = {}) {
  const { exclude = [] } = options
  if (!exclude.includes(start) && (await checkPort(start, options)).ok) return start
  return suggestPort(start, options)
}
