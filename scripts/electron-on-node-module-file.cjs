/**
 * electron-builder omits per-package "examples" folders under node_modules by default.
 * The three package ships FBXLoader and OrbitControls under three/examples/jsm, so we
 * force-include that tree; otherwise the packaged app cannot run the 3D viewer.
 */
const path = require("path");

/** @param {string} filePath */
module.exports = function onNodeModuleFile(filePath) {
  const n = filePath.split(path.sep).join("/");
  return n.includes("node_modules/three/examples");
};
