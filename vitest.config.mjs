import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// The `@zos/*` modules are provided by the watch firmware, not by npm: they exist
// only inside a Zepp OS build, so nothing under node_modules can resolve them.
// Pointing them at the doubles in test/doubles/zos lets the unit tests import
// page/index.js and drive the real screen flow - taps, drags, menus, storage -
// on a plain Node runtime.
function zos(name) {
  return fileURLToPath(new URL("./test/doubles/zos/" + name + ".js", import.meta.url));
}

export default defineConfig({
  // The solver tests are deliberately heavy - they search real state spaces -
  // and the default five seconds is tight for them when the whole suite is
  // running in parallel on a busy machine.
  test: { testTimeout: 30000 },
  resolve: {
    alias: {
      "@zos/ui": zos("ui"),
      "@zos/settings": zos("settings"),
      "@zos/interaction": zos("interaction"),
      "@zos/display": zos("display"),
      "@zos/storage": zos("storage"),
      "@zos/device": zos("device"),
      "@zos/fs": zos("fs"),
    },
  },
});
