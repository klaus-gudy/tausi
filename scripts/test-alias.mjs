import { existsSync } from "node:fs"
import { registerHooks } from "node:module"
import { fileURLToPath, pathToFileURL } from "node:url"

// Lets tests load app modules the way Next's bundler does: "@/lib/..." is the
// tsconfig path alias, TypeScript files (the generated Prisma client among
// them) import each other without the ".ts" ending Node needs, and Next's own
// subpaths such as "next/headers" have no package exports.
const root = fileURLToPath(new URL("..", import.meta.url))

function withEnding(path) {
  return [".ts", ".tsx", "/index.ts"].map((ending) => path + ending).find(existsSync)
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      const path = root + specifier.slice(2)
      const file = existsSync(path) && /\.\w+$/.test(path) ? path : withEnding(path)
      return nextResolve(file ? pathToFileURL(file).href : specifier, context)
    }
    if (specifier.startsWith(".") && !/\.\w+$/.test(specifier) && context.parentURL?.endsWith(".ts")) {
      const file = withEnding(fileURLToPath(new URL(specifier, context.parentURL)))
      if (file) return nextResolve(pathToFileURL(file).href, context)
    }
    if (specifier.startsWith("next/") && !/\.\w+$/.test(specifier) && !context.parentURL?.includes("/node_modules/")) {
      return nextResolve(`${specifier}.js`, context)
    }
    return nextResolve(specifier, context)
  },
})
