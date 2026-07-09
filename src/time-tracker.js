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

function pad2(n) {
  return String(n).padStart(2, "0");
}

// ── Custom time picker (replaces native <input type="time">, whose dropdown can't be styled) ──
var tpInstances = {};

function fmtTimeDisplay(value) {
  var parts = value.split(":").map(Number);
  var h = parts[0],
    m = parts[1];
  var ap = h >= 12 ? "PM" : "AM";
  var h12 = h % 12;
  if (h12 === 0) h12 = 12;
  return h12 + ":" + pad2(m) + " " + ap;
}

function buildTimePickerHTML(id, value, open) {
  var parts = value.split(":").map(Number);
  var h24 = parts[0],
    m = parts[1];
  var ap = h24 >= 12 ? "PM" : "AM";
  var h12 = h24 % 12;
  if (h12 === 0) h12 = 12;

  var hoursHtml = "";
  for (var hh = 1; hh <= 12; hh++) {
    hoursHtml += '<div class="tp-option' + (hh === h12 ? " selected" : "") + '" onclick="tpSelectHour(\'' + id + "'," + hh + ')">' + hh + "</div>";
  }
  var minsHtml = "";
  for (var mm = 0; mm < 60; mm++) {
    minsHtml += '<div class="tp-option' + (mm === m ? " selected" : "") + '" onclick="tpSelectMinute(\'' + id + "'," + mm + ')">' + pad2(mm) + "</div>";
  }
  var ampmHtml =
    '<div class="tp-option' + (ap === "AM" ? " selected" : "") + "\" onclick=\"tpSelectAmPm('" + id + "','AM')\">AM</div>" +
    '<div class="tp-option' + (ap === "PM" ? " selected" : "") + "\" onclick=\"tpSelectAmPm('" + id + "','PM')\">PM</div>";

  return (
    '<div class="time-picker-trigger"><input type="text" class="tp-input" id="' +
    id +
    '-label" value="' +
    fmtTimeDisplay(value) +
    '" autocomplete="off" onfocus="this.select()" onkeydown="tpInputKeydown(event,\'' +
    id +
    '\')" onblur="tpCommitTyped(\'' +
    id +
    '\',this.value)" /><button type="button" class="tp-caret-btn" onclick="toggleTimePicker(\'' +
    id +
    '\')"><svg class="tp-caret" viewBox="0 0 10 6" width="10" height="6"><path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div>' +
    (open
      ? '<div class="time-picker-panel"><div class="tp-col" id="' +
        id +
        '-hours">' +
        hoursHtml +
        '</div><div class="tp-col" id="' +
        id +
        '-mins">' +
        minsHtml +
        '</div><div class="tp-col tp-ampm">' +
        ampmHtml +
        "</div></div>"
      : "")
  );
}

function initTimePicker(container, id, value, onChange) {
  tpInstances[id] = { value: value, onChange: onChange, container: container, open: false };
  renderTimePickerDOM(id);
}

function renderTimePickerDOM(id) {
  var inst = tpInstances[id];
  if (!inst) return;
  inst.container.classList.toggle("open", inst.open);
  inst.container.innerHTML = buildTimePickerHTML(id, inst.value, inst.open);
  if (inst.open) {
    scrollSelectedIntoView(id);
    var panel = inst.container.querySelector(".time-picker-panel");
    if (panel) {
      var rect = inst.container.getBoundingClientRect();
      if (rect.bottom + panel.offsetHeight + 8 > window.innerHeight) {
        panel.classList.add("flip-up");
      }
    }
  }
}

function scrollSelectedIntoView(id) {
  ["-hours", "-mins"].forEach(function (suf) {
    var col = document.getElementById(id + suf);
    if (!col) return;
    var sel = col.querySelector(".selected");
    if (sel) sel.scrollIntoView({ block: "center" });
  });
}

var tpSuppressNextDocClick = false;

function toggleTimePicker(id) {
  tpSuppressNextDocClick = true;
  Object.keys(tpInstances).forEach(function (key) {
    if (key !== id && tpInstances[key].open) {
      tpInstances[key].open = false;
      renderTimePickerDOM(key);
    }
  });
  var inst = tpInstances[id];
  inst.open = !inst.open;
  renderTimePickerDOM(id);
}

function closeAllTimePickers() {
  Object.keys(tpInstances).forEach(function (key) {
    if (tpInstances[key].open) {
      tpInstances[key].open = false;
      renderTimePickerDOM(key);
    }
  });
}

function syncTimePicker(id, value) {
  var inst = tpInstances[id];
  if (!inst || inst.value === value) return;
  inst.value = value;
  if (!inst.open) renderTimePickerDOM(id);
}

function to24(h12, ap) {
  var h = h12 % 12;
  if (ap === "PM") h += 12;
  return h;
}

function setTimePickerValue(id, h24, m) {
  tpSuppressNextDocClick = true;
  var inst = tpInstances[id];
  var value = pad2(h24) + ":" + pad2(m);
  inst.value = value;
  renderTimePickerDOM(id);
  inst.onChange(value);
}

function parseTypedTime(raw, currentValue) {
  var s = (raw || "").trim().toLowerCase().replace(/\s+/g, "");
  if (!s) return null;
  var m = s.match(/^(\d{1,2}):?(\d{2})?(am|pm|a|p)?$/);
  if (!m) return null;
  var h = parseInt(m[1], 10);
  var min = m[2] ? parseInt(m[2], 10) : 0;
  if (min > 59) return null;
  var apStr = m[3];
  if (apStr) {
    if (h < 1 || h > 12) return null;
    var ap = apStr[0] === "p" ? "PM" : "AM";
    return { h24: to24(h, ap), m: min };
  }
  if (h < 0 || h > 23) return null;
  if (h >= 1 && h <= 12) {
    var curParts = currentValue.split(":").map(Number);
    var curAp = curParts[0] >= 12 ? "PM" : "AM";
    return { h24: to24(h, curAp), m: min };
  }
  return { h24: h, m: min };
}

function tpCommitTyped(id, raw) {
  var inst = tpInstances[id];
  if (!inst) return;
  var parsed = parseTypedTime(raw, inst.value);
  if (!parsed) {
    renderTimePickerDOM(id);
    return;
  }
  setTimePickerValue(id, parsed.h24, parsed.m);
}

function tpInputKeydown(e, id) {
  if (e.key === "Enter") {
    e.preventDefault();
    e.target.blur();
  } else if (e.key === "Escape") {
    e.preventDefault();
    renderTimePickerDOM(id);
  }
}

function tpSelectHour(id, h12) {
  var inst = tpInstances[id];
  var parts = inst.value.split(":").map(Number);
  var ap = parts[0] >= 12 ? "PM" : "AM";
  setTimePickerValue(id, to24(h12, ap), parts[1]);
}

function tpSelectMinute(id, m) {
  var inst = tpInstances[id];
  var parts = inst.value.split(":").map(Number);
  setTimePickerValue(id, parts[0], m);
}

function tpSelectAmPm(id, ap) {
  var inst = tpInstances[id];
  var parts = inst.value.split(":").map(Number);
  var h12 = parts[0] % 12;
  if (h12 === 0) h12 = 12;
  setTimePickerValue(id, to24(h12, ap), parts[1]);
}

document.addEventListener("click", function (e) {
  if (tpSuppressNextDocClick) {
    tpSuppressNextDocClick = false;
    return;
  }
  Object.keys(tpInstances).forEach(function (key) {
    var inst = tpInstances[key];
    if (inst.open && !inst.container.contains(e.target)) {
      inst.open = false;
      renderTimePickerDOM(key);
    }
  });
});

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
  syncTimePicker("manual-time", manualTimeValue);
  render();
}

function cancelManualEntry() {
  state.manualEntryOpen = false;
  closeAllTimePickers();
  render();
}

function setManualTime(value) {
  manualTimeValue = value;
}

function confirmManualClockIn() {
  state.clockedIn = true;
  state.clockInTime = parseInputTime(manualTimeValue, new Date());
  state.manualEntryOpen = false;
  closeAllTimePickers();
  saveState();
  render();
}

function openEditClockIn() {
  state.editClockInOpen = true;
  manualTimeValue = fmtInputTime(state.clockInTime || new Date());
  syncTimePicker("edit-clockin-time", manualTimeValue);
  render();
}

function cancelEditClockIn() {
  state.editClockInOpen = false;
  closeAllTimePickers();
  render();
}

function confirmEditClockIn() {
  state.clockInTime = parseInputTime(manualTimeValue, state.clockInTime || new Date());
  state.editClockInOpen = false;
  closeAllTimePickers();
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
    if (state.lunchStartTime) syncTimePicker("lunch-start", fmtInputTime(state.lunchStartTime));
    if (state.lunchEndTime) syncTimePicker("lunch-end", fmtInputTime(state.lunchEndTime));
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
      '<div id="lunch-start" class="time-picker lunch-time-input"></div>' +
      '<button class="lunch-btn active" onclick="toggleLunch()" title="End lunch break (Alt+L)">End Lunch (' +
      fmtDuration(lunchMinutesTotal) +
      ")</button>";
    initTimePicker(document.getElementById("lunch-start"), "lunch-start", fmtInputTime(state.lunchStartTime), setLunchStartTime);
  } else {
    container.innerHTML =
      '<div id="lunch-start" class="time-picker lunch-time-input"></div>' +
      '<span class="lunch-dash">–</span>' +
      '<div id="lunch-end" class="time-picker lunch-time-input"></div>' +
      '<button class="btn-secondary btn-sm cancel-x-btn lunch-clear-btn" onclick="clearLunch()" title="Remove lunch break">✕</button>';
    initTimePicker(document.getElementById("lunch-start"), "lunch-start", fmtInputTime(state.lunchStartTime), setLunchStartTime);
    initTimePicker(document.getElementById("lunch-end"), "lunch-end", fmtInputTime(state.lunchEndTime), setLunchEndTime);
  }
}

function render() {
  var now = new Date();

  document.getElementById("idle-view").style.display = state.clockedIn ? "none" : "flex";
  document.getElementById("active-view").style.display = state.clockedIn ? "block" : "none";

  document.getElementById("manual-entry").style.display = state.manualEntryOpen ? "flex" : "none";
  document.getElementById("idle-actions").style.display = state.manualEntryOpen ? "none" : "block";
  syncTimePicker("manual-time", manualTimeValue);

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
    syncTimePicker("edit-clockin-time", manualTimeValue);
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
  initTimePicker(document.getElementById("manual-time"), "manual-time", fmtInputTime(new Date()), setManualTime);
  initTimePicker(document.getElementById("edit-clockin-time"), "edit-clockin-time", fmtInputTime(new Date()), setManualTime);

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
