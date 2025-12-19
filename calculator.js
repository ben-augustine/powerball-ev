// ==============================
// State tax data
// ==============================

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
      return;
    }
    const rate = STATE_TAX_TOP_2025[code] ?? 0;
    stateTaxInput.value = rate.toFixed(4);
    stateTaxInput.readOnly = true;
  }

  sel.addEventListener("change", applyFromSelect);

  // Clicking into tax box flips back to manual
  stateTaxInput.addEventListener("focus", () => {
    if (sel.value !== "") {
      sel.value = "";
      stateTaxInput.readOnly = false;
    }
  });

  applyFromSelect();
}

// ==============================
// Autofill cash values from Worker (defaults only)
// ==============================
async function autofillDefaultsFromWorker() {
  const cashEl = document.getElementById("cashValue");
  const prevEl = document.getElementById("prevCashValue");
  if (!cashEl || !prevEl) return;

  try {
    const r = await fetch(WORKER_URL, { cache: "no-store" });
    const j = await r.json();

    const nextCash = j?.next?.cashValue;
    const prevCash = j?.prev?.cashValue;

    if (!Number.isFinite(nextCash) || !Number.isFinite(prevCash)) return;

    if (!cashEl.value) cashEl.value = Math.round(nextCash);
    if (!prevEl.value) prevEl.value = Math.round(prevCash);
  } catch (e) {
    console.error("Autofill failed:", e);
  }
}

// ==============================
// Tickets override behavior
// ==============================
function initTicketsOverrideUX() {
  const prevEl = document.getElementById("prevCashValue");
  const ticketsEl = document.getElementById("ticketsSold");
  if (!prevEl || !ticketsEl) return;

  function syncLocks() {
    const tickets = Number(ticketsEl.value);
    const hasTickets = Number.isFinite(tickets) && tickets > 0;

    if (hasTickets) {
      // tickets override prevCashValue
      prevEl.value = "";
      prevEl.readOnly = true;
    } else {
      prevEl.readOnly = false;
    }
  }

  ticketsEl.addEventListener("input", syncLocks);
  ticketsEl.addEventListener("change", syncLocks);

  // If user clicks into prev cash, clear tickets override
  prevEl.addEventListener("focus", () => {
    if (ticketsEl.value) {
      ticketsEl.value = "";
      prevEl.readOnly = false;
    }
  });

  syncLocks();
}

// ==============================
// Main calculation (auto)
// ==============================
function runCalc() {
  const cashValue = Number(document.getElementById("cashValue")?.value);
  const prevCashValue = Number(document.getElementById("prevCashValue")?.value);
  const ticketsSold = Number(document.getElementById("ticketsSold")?.value);

  const ticketPrice = Number(document.getElementById("ticketPrice")?.value || 2);
  const jackpotShare = clamp01(Number(document.getElementById("jackpotShare")?.value || 0.70));
  const fedTax = clamp01(Number(document.getElementById("fedTax")?.value || 0.37));
  const stateTax = clamp01(Number(document.getElementById("stateTax")?.value || 0.00));

  const evOut = document.getElementById("evOut");
  const edgeOut = document.getElementById("edgeOut");
  const notesOut = document.getElementById("notesOut");
  if (!evOut || !edgeOut || !notesOut) return;

  const res = window.PowerballEV.computeEV({
    cashValue,
    prevCashValue,
    ticketsSold,
    ticketPrice,
    jackpotShare,
    fedTax,
    stateTax
  });

  if (!res.ok) {
    notesOut.textContent = res.error;
    evOut.textContent = "—";
    edgeOut.textContent = "—";
    return;
  }

  const m = res.formats.money;
  evOut.textContent = m(res.totalEV);
  edgeOut.textContent = m(res.totalEV - ticketPrice);

  const method = res.usedManualTickets ? "manual tickets"
               : res.usedDelta ? "Δcash"
               : "fallback";

  notesOut.textContent =
    `EV includes jackpot + all lower prizes (no Power Play). ` +
    `Tickets: ${Math.round(res.ticketsEst).toLocaleString()} (method: ${method}). ` +
    `λ(other winners): ${res.lambdaOthers.toFixed(3)}. ` +
    `Tax: ${(res.totalTax * 100).toFixed(1)}%.`;
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
    "prevCashValue",
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
initTicketsOverrideUX();
attachAutoCalc();

autofillDefaultsFromWorker().then(runCalc);
