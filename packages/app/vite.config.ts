import { sentryVitePlugin } from "@sentry/vite-plugin"
import { defineConfig, type Plugin } from "vite"
import path from "node:path"
import desktopPlugin from "./vite"

const sentry =
  process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT
    ? sentryVitePlugin({
        authToken: process.env.SENTRY_AUTH_TOKEN,
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
        telemetry: false,
        release: {
          name: process.env.SENTRY_RELEASE ?? process.env.VITE_SENTRY_RELEASE,
        },
        sourcemaps: {
          assets: "./dist/**",
          filesToDeleteAfterUpload: "./dist/**/*.map",
        },
      })
    : false

const penhub =
  process.env.PENHUB_GUI === "1"
    ? ({
        name: "penhub-root",
        configureServer(server) {
          server.middlewares.use((request, response, next) => {
            const url = new URL(request.url ?? "/", "http://localhost")
            if (url.pathname !== "/") {
              next()
              return
            }
            request.url = `/penhub.html${url.search}`
            next()
          })
        },
      } satisfies Plugin)
    : false

export default defineConfig({
  plugins: [desktopPlugin, penhub, sentry] as any,
  server: {
    host: "0.0.0.0",
    allowedHosts: true,
    port: 3000,
  },
  build: {
    target: "esnext",
    sourcemap: true,
    rollupOptions: {
      input: {
        app: path.resolve(import.meta.dirname, "index.html"),
        penhub: path.resolve(import.meta.dirname, "penhub.html"),
      },
    },
  },
})
