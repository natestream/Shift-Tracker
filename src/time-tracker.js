var STORAGE_KEY = "shift-tracker-today";

var state = {
  clockedIn: false,
  clockInTime: null,
  goalHours: 8,
  lunchStartTime: null,
  lunchEndTime: null,
  manualEntryOpen: false,
  editClockInOpen: false,
};

var manualTimeValue = "";
var pinnedVisual = false;
var tickInterval = null;
var midnightCheckInterval = null;
var currentTrackedDate = null;
var lastLunchRenderState = null;

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function fmtInputTime(d) {
  var h = String(d.getHours()).padStart(2, "0");
  var m = String(d.getMinutes()).padStart(2, "0");
  return h + ":" + m;
}

function fmtClock(d) {
  if (!d) return "--:--";
  var h = d.getHours(),
    m = d.getMinutes();
  var ap = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return h + ":" + String(m).padStart(2, "0") + " " + ap;
}

function fmtDuration(mins) {
  mins = Math.max(0, Math.round(mins));
  var h = Math.floor(mins / 60),
    m = mins % 60;
  if (h <= 0) return m + "m";
  return h + "h " + m + "m";
}

function parseInputTime(str, base) {
  var parts = str.split(":").map(Number);
  var d = new Date(base);
  d.setHours(parts[0], parts[1], 0, 0);
  return d;
}

function goalLabel() {
  var g = state.goalHours;
  return (Number.isInteger(g) ? g : g.toFixed(1)) + "h";
}

function setPinnedVisual(pinned) {
  pinnedVisual = pinned;
  var btn = document.getElementById("pin-btn");
  btn.classList.toggle("pinned", pinned);
  btn.textContent = pinned ? "Pinned" : "Pin";
  btn.title = pinned ? "Unpin window" : "Pin window (keep visible)";
}

function saveState() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      date: todayStr(),
      clockedIn: state.clockedIn,
      clockInTime: state.clockInTime ? state.clockInTime.toISOString() : null,
      goalHours: state.goalHours,
      lunchStartTime: state.lunchStartTime ? state.lunchStartTime.toISOString() : null,
      lunchEndTime: state.lunchEndTime ? state.lunchEndTime.toISOString() : null,
    }),
  );
}

function loadState() {
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    var saved = JSON.parse(raw);
    if (saved.date !== todayStr()) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    state.clockedIn = !!saved.clockedIn;
    state.clockInTime = saved.clockInTime ? new Date(saved.clockInTime) : null;
    state.goalHours = typeof saved.goalHours === "number" ? saved.goalHours : 8;
    state.lunchStartTime = saved.lunchStartTime ? new Date(saved.lunchStartTime) : null;
    state.lunchEndTime = saved.lunchEndTime ? new Date(saved.lunchEndTime) : null;
  } catch (e) { }
}

function clockInNow() {
  state.clockedIn = true;
  state.clockInTime = new Date();
  saveState();
  render();
}

function openManualEntry() {
  state.manualEntryOpen = true;
  manualTimeValue = fmtInputTime(new Date());
  render();
}

function cancelManualEntry() {
  state.manualEntryOpen = false;
  render();
}

function setManualTime(value) {
  manualTimeValue = value;
}

function confirmManualClockIn() {
  state.clockedIn = true;
  state.clockInTime = parseInputTime(manualTimeValue, new Date());
  state.manualEntryOpen = false;
  saveState();
  render();
}

function openEditClockIn() {
  state.editClockInOpen = true;
  manualTimeValue = fmtInputTime(state.clockInTime || new Date());
  render();
}

function cancelEditClockIn() {
  state.editClockInOpen = false;
  render();
}

function confirmEditClockIn() {
  state.clockInTime = parseInputTime(manualTimeValue, state.clockInTime || new Date());
  state.editClockInOpen = false;
  saveState();
  render();
}

function incGoal() {
  state.goalHours = Math.min(16, state.goalHours + 0.5);
  saveState();
  render();
}

function decGoal() {
  state.goalHours = Math.max(1, state.goalHours - 0.5);
  saveState();
  render();
}

function toggleLunch() {
  if (!state.lunchStartTime) {
    state.lunchStartTime = new Date();
  } else if (!state.lunchEndTime) {
    state.lunchEndTime = new Date();
  }
  saveState();
  render();
}

function setLunchStartTime(value) {
  var base = state.clockInTime || new Date();
  state.lunchStartTime = parseInputTime(value, base);
  saveState();
  render();
}

function setLunchEndTime(value) {
  var base = state.lunchStartTime || state.clockInTime || new Date();
  state.lunchEndTime = parseInputTime(value, base);
  saveState();
  render();
}

function clearLunch() {
  state.lunchStartTime = null;
  state.lunchEndTime = null;
  saveState();
  render();
}

async function requestReset() {
  var confirmed = window.electronAPI
    ? await window.electronAPI.confirmResetDay()
    : window.confirm("Reset today's tracked day?");
  if (!confirmed) return;

  state.clockedIn = false;
  state.clockInTime = null;
  state.lunchStartTime = null;
  state.lunchEndTime = null;
  state.editClockInOpen = false;
  state.manualEntryOpen = false;
  saveState();
  render();
}

function checkMidnightRollover() {
  if (currentTrackedDate === null) {
    currentTrackedDate = todayStr();
    return;
  }
  if (todayStr() === currentTrackedDate) return;
  currentTrackedDate = todayStr();

  localStorage.removeItem(STORAGE_KEY);
  state.clockedIn = false;
  state.clockInTime = null;
  state.lunchStartTime = null;
  state.lunchEndTime = null;
  state.editClockInOpen = false;
  state.manualEntryOpen = false;
  render();
}

function renderLunchContainer(lunchActive, lunchMinutesTotal) {
  var container = document.getElementById("lunch-container");
  var lunchState = !state.lunchStartTime ? "none" : lunchActive ? "active" : "done";

  if (lunchState === lastLunchRenderState) {
    var inputs = container.querySelectorAll(".lunch-time-input");
    if (state.lunchStartTime && inputs[0] && document.activeElement !== inputs[0]) {
      inputs[0].value = fmtInputTime(state.lunchStartTime);
    }
    if (state.lunchEndTime && inputs[1] && document.activeElement !== inputs[1]) {
      inputs[1].value = fmtInputTime(state.lunchEndTime);
    }
    var btn = container.querySelector(".lunch-btn");
    if (btn && lunchState === "active") {
      btn.textContent = "End Lunch (" + fmtDuration(lunchMinutesTotal) + ")";
    }
    return;
  }
  lastLunchRenderState = lunchState;

  if (lunchState === "none") {
    container.innerHTML =
      '<button class="lunch-btn" onclick="toggleLunch()" title="Start lunch break (Alt+L)">Start Lunch <span class="shortcut-hint">Alt+L</span></button>';
  } else if (lunchState === "active") {
    container.innerHTML =
      '<input type="time" class="lunch-time-input" value="' +
      fmtInputTime(state.lunchStartTime) +
      '" onchange="setLunchStartTime(this.value)" />' +
      '<button class="lunch-btn active" onclick="toggleLunch()" title="End lunch break (Alt+L)">End Lunch (' +
      fmtDuration(lunchMinutesTotal) +
      ")</button>";
  } else {
    container.innerHTML =
      '<input type="time" class="lunch-time-input" value="' +
      fmtInputTime(state.lunchStartTime) +
      '" onchange="setLunchStartTime(this.value)" />' +
      '<span class="lunch-dash">–</span>' +
      '<input type="time" class="lunch-time-input" value="' +
      fmtInputTime(state.lunchEndTime) +
      '" onchange="setLunchEndTime(this.value)" />' +
      '<button class="btn-secondary btn-sm cancel-x-btn lunch-clear-btn" onclick="clearLunch()" title="Remove lunch break">✕</button>';
  }
}

function render() {
  var now = new Date();

  document.getElementById("idle-view").style.display = state.clockedIn ? "none" : "flex";
  document.getElementById("active-view").style.display = state.clockedIn ? "block" : "none";

  document.getElementById("manual-entry").style.display = state.manualEntryOpen ? "flex" : "none";
  document.getElementById("idle-actions").style.display = state.manualEntryOpen ? "none" : "block";
  document.getElementById("manual-time").value = manualTimeValue;

  document.getElementById("goal-label-idle").textContent = goalLabel() + " goal";
  document.getElementById("goal-label-active").textContent = goalLabel() + " goal";
  document.getElementById("goal-label-inline").textContent = goalLabel() + " goal";

  var lunchActive = !!(state.lunchStartTime && !state.lunchEndTime);
  var lunchMinutesTotal = 0;
  if (state.lunchStartTime && state.lunchEndTime) {
    lunchMinutesTotal = (state.lunchEndTime.getTime() - state.lunchStartTime.getTime()) / 60000;
  } else if (lunchActive) {
    lunchMinutesTotal = (now.getTime() - state.lunchStartTime.getTime()) / 60000;
  }
  lunchMinutesTotal = Math.max(0, lunchMinutesTotal);

  var elapsedMinutes = 0;
  if (state.clockedIn && state.clockInTime) {
    elapsedMinutes = (now.getTime() - state.clockInTime.getTime()) / 60000 - lunchMinutesTotal;
    elapsedMinutes = Math.max(0, elapsedMinutes);
  }
  var goalMinutes = state.goalHours * 60;
  var progressPct = Math.min(100, Math.max(0, (elapsedMinutes / goalMinutes) * 100));
  var remainingMinutes = Math.max(0, goalMinutes - elapsedMinutes);
  var isOvertime = elapsedMinutes >= goalMinutes;

  var statusDot = document.getElementById("status-dot");
  statusDot.classList.toggle("active", state.clockedIn && !isOvertime && !lunchActive);
  statusDot.classList.toggle("overtime", state.clockedIn && isOvertime && !lunchActive);
  statusDot.classList.toggle("lunch", state.clockedIn && lunchActive);

  if (state.clockedIn) {
    document.getElementById("clockin-row-display").style.display = state.editClockInOpen ? "none" : "flex";
    document.getElementById("clockin-row-edit").style.display = state.editClockInOpen ? "flex" : "none";
    document.getElementById("edit-clockin-time").value = manualTimeValue;
    document.getElementById("clockin-time-label").textContent = fmtClock(state.clockInTime);

    var clockOutLabel = "--:--";
    if (state.clockInTime) {
      var clockOut = new Date(state.clockInTime.getTime() + (goalMinutes + lunchMinutesTotal) * 60000);
      clockOutLabel = fmtClock(clockOut);
    }
    var heroTime = document.getElementById("hero-time");
    heroTime.textContent = clockOutLabel;
    heroTime.classList.toggle("overtime", isOvertime && !lunchActive);
    heroTime.classList.toggle("paused", lunchActive);

    var remaining = document.getElementById("hero-remaining");
    remaining.textContent = isOvertime
      ? fmtDuration(elapsedMinutes - goalMinutes) + " overtime"
      : fmtDuration(remainingMinutes) + " remaining";
    remaining.classList.toggle("overtime", isOvertime && !lunchActive);
    remaining.style.display = lunchActive ? "none" : "inline-block";

    document.getElementById("hero-paused-banner").style.display = lunchActive ? "inline-flex" : "none";

    document.getElementById("worked-label").textContent = fmtDuration(elapsedMinutes) + " worked" + (lunchActive ? " (paused)" : "");
    var fill = document.getElementById("progress-fill");
    fill.style.width = progressPct + "%";
    fill.classList.toggle("overtime", isOvertime && !lunchActive);
    fill.classList.toggle("paused", lunchActive);

    renderLunchContainer(lunchActive, lunchMinutesTotal);

    if (window.electronAPI && window.electronAPI.updateTooltip) {
      window.electronAPI.updateTooltip("Clock out at " + clockOutLabel);
    }
  } else {
    if (window.electronAPI && window.electronAPI.updateTooltip) {
      window.electronAPI.updateTooltip("Shift Tracker");
    }
  }
}

window.addEventListener("DOMContentLoaded", function () {
  loadState();
  currentTrackedDate = todayStr();
  render();

  tickInterval = setInterval(render, 1000);

  if (midnightCheckInterval) clearInterval(midnightCheckInterval);
  midnightCheckInterval = setInterval(checkMidnightRollover, 30000);

  document.addEventListener("keydown", function (e) {
    if (!e.altKey) return;
    if (e.key === "1") {
      e.preventDefault();
      if (!state.clockedIn && !state.manualEntryOpen) clockInNow();
    } else if (e.key === "l" || e.key === "L") {
      e.preventDefault();
      if (state.clockedIn) toggleLunch();
    }
  });
});
