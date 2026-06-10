var tickInterval = null;
var STORAGE_KEY = "shift-tracker-today";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function saveState() {
  var state = {
    date: todayStr(),
    in1: document.getElementById("in1").value,
    out1: document.getElementById("out1").value,
    in2: document.getElementById("in2").value,
    goal: document.getElementById("goal").value,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    var state = JSON.parse(raw);
    if (state.date !== todayStr()) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    document.getElementById("in1").value = state.in1 || "";
    document.getElementById("out1").value = state.out1 || "";
    document.getElementById("in2").value = state.in2 || "";
    document.getElementById("goal").value = state.goal || "8";
  } catch (e) {}
}

function toMins(val) {
  if (!val) return null;
  var parts = val.split(":").map(Number);
  return parts[0] * 60 + parts[1];
}

function nowMins() {
  var n = new Date();
  return n.getHours() * 60 + n.getMinutes() + n.getSeconds() / 60;
}

function fmtTime(totalMins) {
  var normalized = ((totalMins % 1440) + 1440) % 1440;
  var h = Math.floor(normalized / 60);
  var m = Math.round(normalized % 60);
  if (m === 60) { h++; m = 0; }
  var ampm = h >= 12 ? "pm" : "am";
  var h12 = h % 12 === 0 ? 12 : h % 12;
  return h12 + ":" + String(m).padStart(2, "0") + " " + ampm;
}

function fmtDurationClock(mins) {
  var totalSec = Math.round(mins * 60);
  var h = Math.floor(totalSec / 3600);
  var m = Math.floor((totalSec % 3600) / 60);
  var s = totalSec % 60;
  if (h > 0) return h + ":" + String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
  return m + ":" + String(s).padStart(2, "0");
}

function fmtDurationShort(mins) {
  var h = Math.floor(mins / 60);
  var m = Math.round(mins % 60);
  if (h === 0) return m + "m";
  if (m === 0) return h + "h";
  return h + "h " + m + "m";
}

function fmtTimeLeft(mins) {
  if (mins <= 0) return "Goal reached!";
  var totalSec = Math.round(mins * 60);
  var h = Math.floor(totalSec / 3600);
  var m = Math.floor((totalSec % 3600) / 60);
  var s = totalSec % 60;
  if (h > 0) return h + "h " + String(m).padStart(2, "0") + "m left";
  if (m > 0) return m + "m " + String(s).padStart(2, "0") + "s left";
  return s + "s left";
}

function getPaidMinsSoFar(in1, out1, in2, now) {
  if (in1 === null) return null;
  if (now < in1) return 0;
  if (out1 === null) return now - in1;
  if (now <= out1) return now - in1;
  var morning = out1 - in1;
  if (in2 === null) return morning;
  if (now <= in2) return morning;
  return morning + (now - in2);
}

function renderLive(in1, out1, in2, goalMins) {
  var area = document.getElementById("live-area");
  if (in1 === null) {
    area.innerHTML =
      '<div class="session-empty">' +
        '<div class="session-empty-icon">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">' +
            '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>' +
          '</svg>' +
        '</div>' +
        '<p class="session-empty-title">Not tracking</p>' +
        '<p class="session-empty-sub">Stamp your morning clock-in time to start</p>' +
      '</div>';
    return;
  }

  var now = nowMins();
  var paidSoFar = getPaidMinsSoFar(in1, out1, in2, now);
  if (paidSoFar === null || paidSoFar < 0) paidSoFar = 0;

  var remaining = Math.max(goalMins - paidSoFar, 0);
  var pct = Math.min((paidSoFar / goalMins) * 100, 100);
  var fillClass = pct >= 100 ? "over" : pct >= 90 ? "warn" : "";

  var onBreak =
    (out1 !== null && in2 === null && now > out1) ||
    (out1 !== null && in2 !== null && now > out1 && now < in2);

  var statusPill = onBreak
    ? '<span class="session-status-pill break"><span class="session-dot"></span>On lunch break</span>'
    : '<span class="session-status-pill active"><span class="session-dot"></span>Clocked in</span>';

  var timerClass = onBreak ? "session-timer break" : "session-timer";
  var pctLabel = pct >= 100
    ? '<span style="color:var(--teal);font-weight:600">Goal reached!</span>'
    : Math.round(pct) + "% of goal";

  area.innerHTML =
    '<div class="session-card">' +
      '<div class="session-top">' +
        '<span class="session-heading">Current Session</span>' +
        statusPill +
      '</div>' +
      '<div class="' + timerClass + '">' + fmtDurationClock(paidSoFar) + '</div>' +
      '<div>' +
        '<div class="session-progress-bar">' +
          '<div class="session-progress-fill ' + fillClass + '" style="width:' + pct.toFixed(1) + '%"></div>' +
        '</div>' +
        '<div class="session-progress-labels">' +
          '<span>0h</span>' +
          '<span>' + pctLabel + '</span>' +
          '<span>' + (goalMins / 60).toFixed(1) + 'h goal</span>' +
        '</div>' +
      '</div>' +
    '</div>';
}

function clearField(id) {
  document.getElementById(id).value = "";
  calc();
}

function stampNow(id) {
  var now = new Date();
  var hh = String(now.getHours()).padStart(2, "0");
  var mm = String(now.getMinutes()).padStart(2, "0");
  document.getElementById(id).value = hh + ":" + mm;
  calc();
}

function resetAll() {
  localStorage.removeItem(STORAGE_KEY);
  document.getElementById("in1").value = "";
  document.getElementById("out1").value = "";
  document.getElementById("in2").value = "";
  document.getElementById("goal").value = "8";
  if (tickInterval) {
    clearInterval(tickInterval);
    tickInterval = null;
  }
  renderLive(null, null, null, 480);
  document.getElementById("result-area").innerHTML = "";
}

function calc() {
  saveState();

  var in1 = toMins(document.getElementById("in1").value);
  var out1 = toMins(document.getElementById("out1").value);
  var in2 = toMins(document.getElementById("in2").value);
  var goalHrs = parseFloat(document.getElementById("goal").value) || 8;
  var goalMins = Math.round(goalHrs * 60);

  if (tickInterval) clearInterval(tickInterval);
  renderLive(in1, out1, in2, goalMins);
  if (in1 !== null) {
    tickInterval = setInterval(function () {
      renderLive(in1, out1, in2, goalMins);
    }, 1000);
  }

  var area = document.getElementById("result-area");

  if (in1 === null) {
    area.innerHTML = "";
    return;
  }

  var morningMins = null, breakMins = null, paidSoFar = null, afternoonStart = null;

  if (out1 !== null && in2 !== null) {
    morningMins = out1 - in1;
    breakMins = in2 - out1;
    afternoonStart = in2;
    paidSoFar = morningMins;
  } else if (out1 !== null) {
    morningMins = out1 - in1;
    paidSoFar = morningMins;
  } else {
    paidSoFar = 0;
  }

  var remainingMins = goalMins - (paidSoFar || 0);
  var clockOutMins = null, noLunch = false;

  if (afternoonStart !== null) {
    clockOutMins = afternoonStart + remainingMins;
  } else if (out1 === null) {
    clockOutMins = in1 + goalMins;
    noLunch = true;
  }

  var html = '<div class="result-card">';
  html += '<div class="result-header">';
  html += '<span class="result-section-label">Clock out</span>';
  if (clockOutMins !== null) {
    html += noLunch
      ? '<span class="result-badge-warn">No lunch entered</span>'
      : '<span class="result-badge-ok">On track</span>';
  }
  html += '</div>';

  if (clockOutMins !== null) {
    html +=
      '<div class="result-clockout">' +
        '<span class="result-clockout-label">Leave at</span>' +
        '<span class="result-clockout-time">' + fmtTime(clockOutMins) + '</span>' +
      '</div>';
  }
  html += '</div>';

  var metrics = [];
  if (morningMins !== null)
    metrics.push(['Morning block', fmtDurationShort(morningMins)]);
  if (breakMins !== null)
    metrics.push(['Lunch break', fmtDurationShort(breakMins)]);
  if (afternoonStart !== null)
    metrics.push(['Afternoon needed', fmtDurationShort(remainingMins)]);
  if (paidSoFar !== null && afternoonStart !== null)
    metrics.push(['Paid so far', fmtDurationShort(paidSoFar)]);

  if (metrics.length) {
    html += '<div class="result-card metrics-grid">';
    metrics.forEach(function (m) {
      html +=
        '<div class="metric-cell">' +
          '<p class="metric-cell-label">' + m[0] + '</p>' +
          '<p class="metric-cell-val">' + m[1] + '</p>' +
        '</div>';
    });
    html += '</div>';
  }

  area.innerHTML = html;
}

window.addEventListener("DOMContentLoaded", function () {
  loadState();
  calc();
});
