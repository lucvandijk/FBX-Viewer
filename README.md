# FBX Browser

A small **Electron** desktop app for browsing folders of **FBX** files, previewing them in a **3D viewport**, and collecting models you care about for use elsewhere (for example in a game engine).

## What you can do

- **Open a folder** — Pick any directory on disk. The app builds a tree on the left and lists every `.fbx` under that root (recursively) as thumbnails in the middle column.
- **Preview models** — Click a thumbnail to load the file in the **3D view** on the right. Orbit with the mouse (rotate, zoom, pan) like a typical 3D viewer.
- **Pin favorites** — Use the star on a thumbnail to **pin** models you want to keep handy. Pinned items are stored in the app (local storage) and shown in a **Pinned** section at the top of the thumbnail list.
- **Export pinned models** — **Export pinned to ZIP…** saves all currently pinned `.fbx` files into a single ZIP you can unpack in your game project. If two files share the same name, the archive renames duplicates (e.g. `Model (2).fbx`).
- **Inspect the mesh** — Toggle **Model stats** to see bounding box size (W×D×H), triangle and vertex counts.
- **Adjust the view** — **Focus / recenter** fits the model in view, **Wireframe** toggles wireframe shading, and **Scene lights** / intensity / warmth control how the model is lit.
- **Animations** — If the FBX includes animation, basic **Play** / **Pause** controls appear when applicable.

## Run from source

1. Install [Node.js](https://nodejs.org/) (LTS is fine).
2. In this folder:

   ```bash
   npm install
   npm start
   ```

## Build a distributable

After `npm install`, use [electron-builder](https://www.electron.build/) scripts from `package.json`:

| Command | Output |
|--------|--------|
| `npm run pack` | Unpacked app under `release/` (quick test) |
| `npm run dist` | Package for **your current OS** |
| `npm run dist:win` | Windows installer + portable (x64) |
| `npm run dist:mac` | macOS DMG + zip (build on macOS) |
| `npm run dist:linux` | Linux AppImage + deb (build on Linux) |

Installers and binaries are written to the `release/` directory.

## Notes

- The viewer loads **Three.js** from the web (unpkg) for the 3D scene; run the app **online** the first time if you need those scripts to download, or ensure your network allows that URL.
- Pinned paths are **absolute file paths**. If you move or rename files on disk, pins may break until you re-open the folder and pin again.
