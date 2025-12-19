// ==============================
// State tax data
// ==============================

// Top marginal personal income tax rates (approx, 2025) as decimals
const STATE_TAX_TOP_2025 = {
  AL:0.0415, AK:0.0000, AZ:0.0250, AR:0.0390, CA:0.1440,
  CO:0.0440, CT:0.0699, DE:0.0785, FL:0.0000, GA:0.0539,
  HI:0.1100, ID:0.0570, IL:0.0495, IN:0.0502, IA:0.0380,
  KS:0.0558, KY:0.0620, LA:0.0300, ME:0.0715, MD:0.0895,
  MA:0.0900, MI:0.0665, MN:0.0985, MS:0.0440, MO:0.0570,
  MT:0.0590, NE:0.0520, NV:0.0000, NH:0.0000, NJ:0.1175,
  NM:0.0590, NY:0.1478, NC:0.0425, ND:0.0250, OH:0.0600,
  OK:0.0475, OR:0.1469, PA:0.0686, RI:0.0599, SC:0.0620,
  SD:0.0000, TN:0.0000, TX:0.0000, UT:0.0455, VT:0.0875,
  VA:0.0575, WA:0.0000, WV:0.0482, WI:0.0765, WY:0.0000,
  DC:0.1075
};

const STATE_NAMES = {
  AL:"Alabama", AK:"Alaska", AZ:"Arizona", AR:"Arkansas", CA:"California",
  CO:"Colorado", CT:"Connecticut", DE:"Delaware", FL:"Florida", GA:"Georgia",
  HI:"Hawaii", ID:"Idaho", IL:"Illinois", IN:"Indiana", IA:"Iowa",
  KS:"Kansas", KY:"Kentucky", LA:"Louisiana", ME:"Maine", MD:"Maryland",
  MA:"Massachusetts", MI:"Michigan", MN:"Minnesota", MS:"Mississippi", MO:"Missouri",
  MT:"Montana", NE:"Nebraska", NV:"Nevada", NH:"New Hampshire", NJ:"New Jersey",
  NM:"New Mexico", NY:"New York", NC:"North Carolina", ND:"North Dakota", OH:"Ohio",
  OK:"Oklahoma", OR:"Oregon", PA:"Pennsylvania", RI:"Rhode Island", SC:"South Carolina",
  SD:"South Dakota", TN:"Tennessee", TX:"Texas", UT:"Utah", VT:"Vermont",
  VA:"Virginia", WA:"Washington", WV:"West Virginia", WI:"Wisconsin", WY:"Wyoming",
  DC:"District of Columbia"
};

// ==============================
// Worker endpoint
// ==============================
const WORKER_URL = "https://powerball-ev-data.ben-augustine319.workers.dev/powerball";

// ==============================
// Helpers
// ==============================
function clamp01(x) {
  if (!Number.isFinite(x)) return 0;
  return Math.min(1, Math.max(0, x));
}

function numFrom(id, fallback = NaN) {
  const el = document.getElementById(id);
  if (!el) return fallback;
  const v = Number(el.value);
  return Number.isFinite(v) ? v : fallback;
}

function hasText(id) {
  const el = document.getElementById(id);
  return !!el && el.value.trim() !== "";
}

// tickets = Δcash / jackpotShare / ticketPrice
function computeTicketsSold({ cashValue, prevCashValue, jackpotShare, ticketPrice }) {
  const deltaCash = cashValue - prevCashValue;
  if (!Number.isFinite(deltaCash) || deltaCash <= 0) return NaN;

  const js = Math.max(0.01, jackpotShare);
  const tp = Math.max(0.01, ticketPrice);
  return deltaCash / js / tp;
}

// prevCash = cash - tickets * jackpotShare * ticketPrice
function computePrevCashFromTickets({ cashValue, ticketsSold, jackpotShare, ticketPrice }) {
  const js = Math.max(0.01, jackpotShare);
  const tp = Math.max(0.01, ticketPrice);
  return cashValue - (ticketsSold * js * tp);
}

// ==============================
// Auto-recalc (debounced)
// ==============================
let calcTimer = null;
function scheduleCalc() {
  clearTimeout(calcTimer);
  calcTimer = setTimeout(runCalc, 150);
}

// Track which field the user is “driving”
let userDrivenMode = "auto"; // "auto" | "tickets" | "prevCash"
let suppressMutualClear = false;

// ==============================
// State dropdown init
// ==============================
function initStateDropdown() {
  const sel = document.getElementById("stateSelect");
  const stateTaxInput = document.getElementById("stateTax");
  if (!sel || !stateTaxInput) return;

  sel.innerHTML = "";

  const manualOpt = document.createElement("option");
  manualOpt.value = "";
  manualOpt.textContent = "Manual (enter rate)";
  sel.appendChild(manualOpt);

  const codes = Object.keys(STATE_NAMES)
    .sort((a, b) => STATE_NAMES[a].localeCompare(STATE_NAMES[b]));

  for (const code of codes) {
    const opt = document.createElement("option");
    opt.value = code;
    opt.textContent = `${STATE_NAMES[code]} (${code})`;
    sel.appendChild(opt);
  }

  sel.value = "";
  stateTaxInput.readOnly = false;

  function applyFromSelect() {
    const code = sel.value;
    if (!code) {
      stateTaxInput.readOnly = false;
      scheduleCalc();
      return;
    }
    const rate = STATE_TAX_TOP_2025[code] ?? 0;
    stateTaxInput.value = rate.toFixed(4);
    stateTaxInput.readOnly = true;
    scheduleCalc();
  }

  sel.addEventListener("change", applyFromSelect);

  stateTaxInput.addEventListener("focus", () => {
    if (sel.value !== "") {
      sel.value = "";
      stateTaxInput.readOnly = false;
      scheduleCalc();
    }
  });

  applyFromSelect();
}

// ==============================
// Worker autofill (fills BOTH boxes initially)
// ==============================
async function autofillFromWorker() {
  const cashEl = document.getElementById("cashValue");
  const prevCashEl = document.getElementById("prevCashValue");
  const ticketsEl = document.getElementById("ticketsSold");
  if (!cashEl || !prevCashEl || !ticketsEl) return;

  try {
    const r = await fetch(WORKER_URL, { cache: "no-store" });
    const j = await r.json();

    const nextCash = j?.next?.cashValue;
    const prevCash = j?.prev?.cashValue;
    if (!Number.isFinite(nextCash) || !Number.isFinite(prevCash)) return;

    // Only set if empty (don’t overwrite manual edits on refresh)
    if (!cashEl.value) cashEl.value = Math.round(nextCash);
    if (!prevCashEl.value) prevCashEl.value = Math.round(prevCash);

    // If tickets is empty, compute and set it
    if (!ticketsEl.value) {
      const ticketPrice = numFrom("ticketPrice", 2);
      const jackpotShare = numFrom("jackpotShare", 0.70);
      const t = computeTicketsSold({
        cashValue: Number(cashEl.value),
        prevCashValue: Number(prevCashEl.value),
        jackpotShare,
        ticketPrice
      });
      if (Number.isFinite(t)) ticketsEl.value = Math.round(t);
    }
  } catch (e) {
    console.error("Worker autofill failed:", e);
  }
}

// ==============================
// Mutual-clear behavior you asked for
// ==============================
function initMutualClearBehavior() {
  const ticketsEl = document.getElementById("ticketsSold");
  const prevCashEl = document.getElementById("prevCashValue");
  if (!ticketsEl || !prevCashEl) return;

  ticketsEl.addEventListener("input", () => {
    if (suppressMutualClear) return;

    // User is driving via tickets => clear previous cash display
    userDrivenMode = "tickets";
    suppressMutualClear = true;
    prevCashEl.value = "";
    suppressMutualClear = false;

    scheduleCalc();
  });

  prevCashEl.addEventListener("input", () => {
    if (suppressMutualClear) return;

    // User is driving via prev cash => clear tickets display
    userDrivenMode = "prevCash";
    suppressMutualClear = true;
    ticketsEl.value = "";
    suppressMutualClear = false;

    scheduleCalc();
  });
}

// ==============================
// Main calculation
// ==============================
function runCalc() {
  const evOut = document.getElementById("evOut");
  const edgeOut = document.getElementById("edgeOut");
  const notesOut = document.getElementById("notesOut");
  if (!evOut || !edgeOut || !notesOut) return;

  const cashValue = numFrom("cashValue", NaN);
  const ticketPrice = numFrom("ticketPrice", 2);
  const jackpotShare = clamp01(numFrom("jackpotShare", 0.70));
  const fedTax = clamp01(numFrom("fedTax", 0.37));
  const stateTax = clamp01(numFrom("stateTax", 0.00));

  const ticketsSold = numFrom("ticketsSold", NaN);
  const prevCashValueUI = numFrom("prevCashValue", NaN);

  if (!Number.isFinite(cashValue) || cashValue <= 0) {
    evOut.textContent = "—";
    edgeOut.textContent = "—";
    notesOut.textContent = "Enter a valid cash value jackpot.";
    return;
  }

  // Determine prevCashValue used for EV engine
  let prevCashValueForCalc = prevCashValueUI;

  if (userDrivenMode === "tickets" && hasText("ticketsSold") && Number.isFinite(ticketsSold) && ticketsSold > 0) {
    // tickets drives => derive prev cash internally, but keep UI cleared (as you requested)
    prevCashValueForCalc = computePrevCashFromTickets({
      cashValue,
      ticketsSold,
      jackpotShare,
      ticketPrice
    });
  } else if (userDrivenMode === "prevCash" && hasText("prevCashValue") && Number.isFinite(prevCashValueUI) && prevCashValueUI > 0) {
    // prev cash drives => use it directly
    prevCashValueForCalc = prevCashValueUI;
  } else {
    // auto mode => if we have both numbers, keep tickets synced (without flipping modes)
    if (Number.isFinite(prevCashValueUI) && prevCashValueUI > 0) {
      const t = computeTicketsSold({ cashValue, prevCashValue: prevCashValueUI, jackpotShare, ticketPrice });
      if (Number.isFinite(t)) {
        const ticketsEl = document.getElementById("ticketsSold");
        if (ticketsEl && !hasText("ticketsSold")) {
          suppressMutualClear = true;
          ticketsEl.value = Math.round(t);
          suppressMutualClear = false;
        }
      }
      prevCashValueForCalc = prevCashValueUI;
    }
  }

  const res = window.PowerballEV.computeEV({
    cashValue,
    prevCashValue: prevCashValueForCalc,
    ticketPrice,
    jackpotShare,
    fedTax,
    stateTax
  });

  if (!res.ok) {
    notesOut.textContent = res.error || "Calculation error.";
    evOut.textContent = "—";
    edgeOut.textContent = "—";
    return;
  }

  const m = res.formats.money;
  evOut.textContent = m(res.totalEV);
  edgeOut.textContent = m(res.totalEV - ticketPrice);

  notesOut.textContent =
    `EV includes jackpot + all lower prizes (no Power Play). ` +
    `Tickets: ${Math.round(res.ticketsEst).toLocaleString()} ` +
    `(method: ${res.usedDelta ? "Δcash" : "fallback"}). ` +
    `λ(other winners): ${res.lambdaOthers.toFixed(3)}. ` +
    `Tax: ${(res.totalTax * 100).toFixed(1)}%. ` +
    `Jackpot EV: ${m(res.jackpotEVPerTicket)}; Lower-tier EV: ${m(res.lowerEVPerTicket)}.`;
}

// ==============================
// Auto-calc wiring
// ==============================
function attachAutoCalc() {
  [
    "cashValue",
    "ticketsSold",
    "prevCashValue",
    "ticketPrice",
    "jackpotShare",
    "fedTax",
    "stateTax",
    "stateSelect",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("input", scheduleCalc);
    el.addEventListener("change", scheduleCalc);
  });
}

// ==============================
// Init
// ==============================
initStateDropdown();
initMutualClearBehavior();
attachAutoCalc();

// Fill both boxes initially from Worker, then calculate once
autofillFromWorker().then(() => {
  // Start in auto mode (so both boxes stay filled until user edits one)
  userDrivenMode = "auto";
  runCalc();
});
