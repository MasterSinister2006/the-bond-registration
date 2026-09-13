// These two packages are Emergent's own dev-only tooling (not on the public npm
// registry), loaded optionally at runtime in vite.config.ts with a try/catch that
// degrades to "no plugin" when the package is absent (e.g. outside the Emergent pod,
// on Vercel). Ambient declarations here just satisfy `tsc -b` during the build step,
// since it cannot see real types for a package that may not be installed.
declare module "@emergentbase/overlay/vite" {
  import type { PluginOption } from "vite";
  export function emergentOverlay(): PluginOption;
}

declare module "@emergentbase/visual-edits/vite" {
  import type { PluginOption } from "vite";
  export function visualEdits(): PluginOption;
}
