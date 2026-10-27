import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { powerApps } from "@microsoft/power-apps-vite/plugin"
import { readFile } from "node:fs/promises"
import { projectMasterSchema } from "./src/data/masterSchemaProjection"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), powerApps(), {
    name: "compact-master-schemas",
    enforce: "pre",
    async load(id) {
      const match = /^(.*\.Schema\.json)\?master-(summary|fields)$/.exec(id)
      if (!match) return
      this.addWatchFile(match[1])
      const projection = projectMasterSchema(JSON.parse(await readFile(match[1], "utf8")))
      return JSON.stringify(match[2] === "summary" ? projection.summary : projection.fields)
    },
  }],
});
