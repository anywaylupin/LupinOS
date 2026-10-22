import react from "@astrojs/react";
import { defineConfig } from "astro/config";

export default defineConfig({
  output: "static",
  // The public address, so link previews get absolute image URLs. Set SITE_URL in the deploy.
  site: process.env.SITE_URL,
  integrations: [react()],
  vite: {
    // Bundle every dependency up front. Otherwise the dev server finds one the first time a lazily
    // loaded app imports it, re-bundles mid-session, and the page ends up with two copies of React
    // ("Outdated Optimize Dep", hooks reading null).
    optimizeDeps: {
      include: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime", "zustand", "zustand/middleware", "@cruxgarden/plasma-ui"],
    },
  },
});
