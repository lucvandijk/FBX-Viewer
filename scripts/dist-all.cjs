/**
 * Picks flags electron-builder can run on this host.
 * - macOS: -mwl (all three, where supported).
 * - Linux:  -wl  (AppImage/deb and Windows; Windows target may need Wine).
 * - Windows: --win only. Linux AppImage on Windows needs symlinks (admin/Developer
 *   Mode) and often fails; build Linux on Linux or CI with `dist:linux`.
 */
const path = require("path");
const { execSync } = require("child_process");

const root = path.join(__dirname, "..");
const p = process.platform;
const isMac = p === "darwin";
const isWin = p === "win32";
const isLinux = p === "linux";

let flags;
if (isMac) {
  flags = "-mwl";
  console.log("Building for macOS, Windows, and Linux (-mwl)…");
} else if (isWin) {
  flags = "--win";
  console.log(
    "Building for Windows only. On this OS, use `dist:linux` on Linux or a Linux CI job " +
      "for AppImage/deb. mac: `dist:mac` on a Mac. " +
      "https://www.electron.build/multi-platform-build"
  );
} else if (isLinux) {
  flags = "-wl";
  console.log(
    "Building for Windows and Linux (-wl). A Windows .exe on Linux may require Wine. " +
      "For Linux-only: `yarn dist:linux`."
  );
} else {
  flags = "-wl";
  console.log("Building for Windows and Linux (-wl)…");
}

const localBin = path.join(root, "node_modules", ".bin");
const { PATH, Path } = process.env;
const pathKey = isWin ? "Path" : "PATH";
const pathVar = process.env[pathKey] || PATH || Path || "";
const env = {
  ...process.env,
  [pathKey]: `${localBin}${path.delimiter}${pathVar}`
};
if (isWin) {
  // Avoid failed signtool when no Windows code-signing cert is set up locally.
  env.CSC_IDENTITY_AUTO_DISCOVERY = "false";
}

execSync(`electron-builder ${flags}`, { stdio: "inherit", cwd: root, env, shell: true });
