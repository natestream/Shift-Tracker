const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  nativeImage,
  screen,
  ipcMain,
  dialog,
} = require("electron");

Menu.setApplicationMenu(null);
const { truncate } = require("fs/promises");
const { autoUpdater } = require("electron-updater");

// Handle close button from renderer
ipcMain.on("hide-window", () => {
  if (win) win.hide();
});

ipcMain.on("update-tooltip", (event, text) => {
  if (tray) tray.setToolTip(text || "Shift Tracker");
});

ipcMain.handle("toggle-pin", () => {
  isPinned = !isPinned;
  if (win) win.setAlwaysOnTop(isPinned);
  return isPinned;
});

ipcMain.handle("confirm-reset-day", async () => {
  if (!win) return false;
  const result = await dialog.showMessageBox(win, {
    type: "warning",
    buttons: ["Cancel", "Reset Day"],
    defaultId: 0,
    cancelId: 0,
    title: "Reset Day",
    message: "Reset today's tracked day?",
    detail: "This clears your clock-in, lunch, and progress for today. This can't be undone.",
  });
  return result.response === 1;
});
const path = require("path");

// Keep global references so they aren't garbage collected
let tray = null;
let win = null;
let isPinned = false;

// Dimensions of the popup
const POPUP_WIDTH = 480;
const POPUP_HEIGHT = 640;

app.setName("Shift Tracker");

// Don't show in the dock (macOS) — tray-only
app.dock?.hide();

// Single instance lock — don't open a second copy
if (!app.requestSingleInstanceLock()) {
  app.quit();
}

app.on("second-instance", () => {
  toggleWindow();
});

app.whenReady().then(() => {
  app.setLoginItemSettings({
    openAtLogin: true,
    openAsHidden: true,
  });
  createTray();
  createWindow();

  autoUpdater.checkForUpdatesAndNotify();
});

// Prevent app from quitting when all windows are closed
app.on("window-all-closed", (e) => {
  e.preventDefault();
});

function createTray() {
  // Build a simple clock emoji icon — replace with a real .png/ico if you want
  const icon = buildTrayIcon();
  tray = new Tray(icon);
  tray.setToolTip("Shift Tracker");

  tray.on("click", () => toggleWindow());

  // Right-click menu
  const { Menu } = require("electron");
  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Open Shift Tracker",
      click: () => showWindow(),
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        app.isQuitting = true;
        app.quit();
      },
    },
  ]);
  tray.on("right-click", () => tray.popUpContextMenu(contextMenu));
}

function createWindow() {
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, "assets", "icon.ico")
    : path.join(__dirname, "assets", "icon.ico");

  win = new BrowserWindow({
    icon: iconPath,
    width: POPUP_WIDTH,
    height: POPUP_HEIGHT,
    show: true,
    frame: true,
    autoHideMenuBar: true,
    resizable: false,
    movable: true,
    alwaysOnTop: true,
    skipTaskbar: false, // Don't appear in taskbar
    roundedCorners: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  win.loadFile(path.join(__dirname, "src", "time-tracker.html"));

  // Hide instead of close when X is pressed
  win.on("close", (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      win.hide();
    }
  });

  // Hide when focus is lost (clicked outside), unless pinned
  win.on("blur", () => {
    if (!isPinned && win.isVisible()) {
      win.hide();
    }
  });
}

function toggleWindow() {
  if (!win) return;
  if (win.isVisible()) {
    win.hide();
  } else {
    showWindow();
  }
}

function showWindow() {
  const trayBounds = tray.getBounds();
  const { workArea } = screen.getDisplayMatching(trayBounds);

  // Position popup above/below the tray icon
  let x = Math.round(trayBounds.x + trayBounds.width / 2 - POPUP_WIDTH / 2);
  let y;

  // macOS tray is at the top; Windows/Linux typically at the bottom
  if (process.platform === "darwin") {
    y = trayBounds.y + trayBounds.height + 4;
  } else {
    // If tray is in the bottom half of the screen, popup goes up
    const screenMidY = workArea.y + workArea.height / 2;
    if (trayBounds.y > screenMidY) {
      y = trayBounds.y - POPUP_HEIGHT - 4;
    } else {
      y = trayBounds.y + trayBounds.height + 4;
    }
  }

  // Keep popup within screen bounds horizontally
  x = Math.max(
    workArea.x + 4,
    Math.min(x, workArea.x + workArea.width - POPUP_WIDTH - 4),
  );

  win.setPosition(x, y, false);
  win.show();
  win.focus();
}

function buildTrayIcon() {
  const { nativeImage } = require("electron");

  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, "assets", "trayIcon.png")
    : path.join(__dirname, "assets", "trayIcon.png");

  return nativeImage.createFromPath(iconPath);
}
