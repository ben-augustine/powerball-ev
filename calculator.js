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

function isUserEntered(id) {
  const el = document.getElementById(id);
  if (!el) return false;
  return el.value.trim() !== "";
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

  // default: manual
  sel.value = "";
  stateTaxInput.readOnly = false;

  function applyFromSelect() {
    const code = sel.value;
    if (!code) {
      stateTaxInput.readOnly = false;
      return;
    }
    const rate = STATE_TAX_TOP_2025[code] ?? 0;
    stateTaxInput.value = rate.toFixed(4);
    stateTaxInput.readOnly = true;

    scheduleCalc();
  }

  sel.addEventListener("change", applyFromSelect);

  // Clicking into tax box flips back to manual
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
// Worker autofill (cash + prevCash internal + auto ticketsSold)
// ==============================
async function autofillFromWorker() {
  const cashEl = document.getElementById("cashValue");
  const prevHidden = document.getElementById("prevCashValue"); // hidden
  const ticketsEl = document.getElementById("ticketsSold");    // visible
  if (!cashEl || !prevHidden || !ticketsEl) return;

  try {
    const r = await fetch(WORKER_URL, { cache: "no-store" });
    const j = await r.json();

    const nextCash = j?.next?.cashValue;
    const prevCash = j?.prev?.cashValue;
    if (!Number.isFinite(nextCash) || !Number.isFinite(prevCash)) return;

    // Fill cash only if empty
    if (!cashEl.value) cashEl.value = Math.round(nextCash);

    // Always set internal prev cash from worker (baseline)
    prevHidden.value = Math.round(prevCash);

    // If user hasn't typed tickets, compute and fill tickets
    if (!isUserEntered("ticketsSold")) {
      const ticketPrice = numFrom("ticketPrice", 2);
      const jackpotShare = numFrom("jackpotShare", 0.70);
      const t = computeTicketsSold({
        cashValue: Number(cashEl.value),
        prevCashValue: Number(prevHidden.value),
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

  const prevHidden = document.getElementById("prevCashValue"); // hidden
  const ticketsEl = document.getElementById("ticketsSold");    // visible

  if (!Number.isFinite(cashValue) || cashValue <= 0) {
    evOut.textContent = "—";
    edgeOut.textContent = "—";
    notesOut.textContent = "Enter a valid cash value jackpot.";
    return;
  }

  // Decide whether tickets are manual or auto
  const ticketsManual = isUserEntered("ticketsSold");
  const ticketsSold = ticketsManual ? numFrom("ticketsSold", NaN) : NaN;

  let prevCashValue = Number(prevHidden?.value);

  if (ticketsManual && Number.isFinite(ticketsSold) && ticketsSold > 0) {
    // Manual tickets => back-calc prev cash and store it
    prevCashValue = computePrevCashFromTickets({
      cashValue,
      ticketsSold,
      jackpotShare,
      ticketPrice
    });
    if (prevHidden) prevHidden.value = Math.round(prevCashValue);
  } else {
    // Auto tickets (from prev cash). If we have a usable prev cash, keep tickets box synced.
    if (Number.isFinite(prevCashValue)) {
      const t = computeTicketsSold({ cashValue, prevCashValue, jackpotShare, ticketPrice });
      if (Number.isFinite(t) && ticketsEl && !ticketsManual) {
        ticketsEl.value = Math.round(t);
      }
    }
  }

  const res = window.PowerballEV.computeEV({
    cashValue,
    prevCashValue,
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
// Auto-recalculate on change (debounced)
// ==============================
let calcTimer = null;
function scheduleCalc() {
  clearTimeout(calcTimer);
  calcTimer = setTimeout(runCalc, 150);
}

function attachAutoCalc() {
  [
    "cashValue",
    "ticketsSold",
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
attachAutoCalc();

// Autofill cash/prevCash + auto tickets, then calculate once
autofillFromWorker().then(runCalc);
