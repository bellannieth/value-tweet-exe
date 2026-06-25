import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// React plugin enables the automatic JSX runtime (so components don't need to
// import React) plus Fast Refresh during `npm run dev`.
export default defineConfig({
  plugins: [react()],
});
