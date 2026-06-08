# Shift Tracker — Electron Tray App

A system tray app that pops up your shift time tracker on click.

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Run in dev mode
npm start
```

The app icon will appear in your system tray/menu bar. Click it to toggle the popup open/closed. Click anywhere outside the popup to dismiss it. Right-click the tray icon for a menu with Quit.

## Build a distributable

```bash
npm run build
```

Outputs to the `dist/` folder:

- **macOS** → `.dmg`
- **Windows** → `.exe` installer (NSIS)
- **Linux** → `.AppImage`

## Replacing the tray icon

The default icon is a placeholder. To use a custom icon:

1. Open the assets folder
2. Replace the `trayIcon.png` (16x16 or 32x32, transparent background) inside it with your choice
   On macOS, use a black/white PNG and keep `setTemplateImage(true)` so it adapts to light/dark menu bars automatically.

## Replacing the app icon

The default app icon is a placeholder. To use a custom icon:

1. Create or export your icon image at 256x256px or larger (PNG works well as a source)
2. Convert it to a `.ico` file containing multiple sizes (16, 32, 48, 256px)
   - A free tool like [icoconvert.com](https://icoconvert.com) can do this from a PNG
3. Name the file `icon.ico` and place it in the `assets/` folder
4. Delete the `dist/` folder, then run `npm run build` to rebuild with the new icon

> **Note:** Changes to the app icon won't appear on an already-installed shortcut.
> Right-click the shortcut → Properties → Change Icon to refresh it manually, or reinstall the app.

## Auto-launch on login (optional)

Add this to `app.whenReady()` in `main.js`:

```js
app.setLoginItemSettings({
  openAtLogin: true,
  openAsHidden: true, // start minimized to tray, no popup
});
```

## Project structure

```
shift-tracker-app/
├── main.js          ← Electron main process (tray, window, IPC)
├── preload.js       ← Context bridge (renderer ↔ main)
├── package.json
├── assets/
    ├── trayIcon.png
    ├── icon.ico
└── src/
    ├── time-tracker.html
    ├── time-tracker.css
    └── time-tracker.js
```
