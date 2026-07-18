import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "astro/config"

export default defineConfig({
  site: "https://loegaire.github.io",
  base: "/penhub",
  output: "static",
  trailingSlash: "always",
  vite: { plugins: [tailwindcss()] },
})
