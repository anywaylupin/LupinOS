import react from "@astrojs/react";
import { defineConfig } from "astro/config";

export default defineConfig({
  output: "static",
  // The public address, so link previews get absolute image URLs. Set SITE_URL in the deploy.
  site: process.env.SITE_URL,
  integrations: [react()],
});
