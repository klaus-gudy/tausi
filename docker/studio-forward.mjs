// Prisma Studio only listens on 127.0.0.1 inside its container, which Docker
// can't publish. This listens on the container's network address on the same
// port and forwards to Studio. Same port on purpose: Studio rejects requests
// whose Origin names a different port than its own.
import net from "node:net"
import os from "node:os"

const port = Number(process.env.STUDIO_PORT || 5555)

const addresses = Object.values(os.networkInterfaces())
  .flat()
  .filter((info) => info && !info.internal && info.family === "IPv4")
  .map((info) => info.address)

for (const address of addresses) {
  net
    .createServer((client) => {
      const studio = net.connect(port, "127.0.0.1")
      const close = () => {
        client.destroy()
        studio.destroy()
      }
      client.on("error", close)
      studio.on("error", close)
      client.pipe(studio).pipe(client)
    })
    .listen(port, address)
}
