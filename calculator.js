// ==============================
// Calculator behavior constants
// ==============================

// What you want to display/compare against:
const DISPLAY_TICKET_PRICE = 2;

// Each ticket contributes ~$0.70 to *cash value*
const CONTRIBUTION_PER_TICKET = 0.70;

// EV engine should NOT distort jackpot payout.
// We handle ticket economics separately.
const EV_ENGINE_TICKET_PRICE = 1;
const EV_ENGINE_JACKPOT_SHARE = 1.0;   // FIX: no extra scaling

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
const WORKER_URL =
  "https://powerball-ev-data.ben-augustine319.workers.dev/powerball?v=1";

// ==============================
// Helpers
// ==============================
function clamp01(x) {
  if (!Number.isFinite(x)) return 0;
  return Math.min(1, Math.max(0, x));
}

function readNumberValue(el) {
  if (!el) return NaN;
  const raw = String(el.value ?? "").trim();
  if (!raw) return NaN;
  const cleaned = raw.replace(/,/g, "").replace(/\s+/g, "");
  const v = Number(cleaned);
  return Number.isFinite(v) ? v : NaN;
}

function numFrom(id, fallback = NaN) {
  const el = document.getElementById(id);
  const v = readNumberValue(el);
  return Number.isFinite(v) ? v : fallback;
}

// tickets = Δcash / 0.70
function computeTicketsSoldFromDeltaCash(cashValue, prevCashValue) {
  const deltaCash = cashValue - prevCashValue;
  if (!Number.isFinite(deltaCash) || deltaCash <= 0) return NaN;
  return deltaCash / CONTRIBUTION_PER_TICKET;
}

// prevCash = cash - tickets × 0.70
function computePrevCashFromTickets(cashValue, ticketsSold) {
  if (!Number.isFinite(ticketsSold) || ticketsSold <= 0) return NaN;
  return cashValue - (ticketsSold * CONTRIBUTION_PER_TICKET);
}

// ==============================
// Auto-recalc
// ==============================
let calcTimer = null;
function scheduleCalc() {
  clearTimeout(calcTimer);
  calcTimer = setTimeout(runCalc, 120);
}

// ==============================
// State dropdown wiring (YOUR HTML uses id="stateSelect")
// ==============================
function populateStateSelect() {
  const sel = document.getElementById("stateSelect");
  if (!sel) return;

  // If options already exist, don't touch them
  if (sel.options && sel.options.length > 0) return;

  const entries = Object.entries(STATE_NAMES).sort((a, b) => a[1].localeCompare(b[1]));
  for (const [code, name] of entries) {
    const opt = document.createElement("option");
    opt.value = code;
    opt.textContent = name;
    sel.appendChild(opt);
  }

  // Default to Iowa if nothing selected (matches you)
  if (!sel.value) sel.value = "IA";
}

function syncStateTaxFromSelect() {
  const sel = document.getElementById("stateSelect");
  const stateTaxEl = document.getElementById("stateTax");
  if (!sel || !stateTaxEl) return;

  const code = String(sel.value ?? "").trim().toUpperCase();
  const rate = STATE_TAX_TOP_2025[code];
  if (!Number.isFinite(rate)) return;

  stateTaxEl.value = String(rate);
  scheduleCalc();
}

// ==============================
// Worker autofill
// ==============================
async function autofillFromWorker() {
  const cashEl = document.getElementById("cashValue");
  const ticketsEl = document.getElementById("ticketsSold");
  if (!cashEl || !ticketsEl) return;

  try {
    const r = await fetch(WORKER_URL, { cache: "no-store" });
    const j = await r.json();

    const nextCash = j?.next?.cashValue;
    const prevCash = j?.prev?.cashValue;
    if (!Number.isFinite(nextCash) || !Number.isFinite(prevCash)) return;

    if (!String(cashEl.value ?? "").trim())
      cashEl.value = String(Math.round(nextCash));

    if (!String(ticketsEl.value ?? "").trim()) {
      const cashNow = readNumberValue(cashEl);
      const cashUse = Number.isFinite(cashNow) ? cashNow : nextCash;
      const t = computeTicketsSoldFromDeltaCash(cashUse, prevCash);
      if (Number.isFinite(t)) ticketsEl.value = String(Math.round(t));
    }

    scheduleCalc();
  } catch (e) {
    console.error("Worker autofill failed:", e);
  }
}

// ==============================
// Main calculation
// ==============================
function runCalc() {
  const evOut = document.getElementById("evOut");
  if (!evOut) return;

  if (!window.PowerballEV || typeof window.PowerballEV.computeEV !== "function") {
    evOut.textContent = "—";
    return;
  }

  const cashValue = numFrom("cashValue", NaN);
  const ticketsSold = numFrom("ticketsSold", NaN);

  const fedTax = clamp01(numFrom("fedTax", 0.37));
  const stateTax = clamp01(numFrom("stateTax", 0.00));
  const combinedTax = clamp01(fedTax + stateTax);

  if (!Number.isFinite(cashValue) || cashValue <= 0) {
    evOut.textContent = "—";
    return;
  }

  let prevCashValue = NaN;
  if (Number.isFinite(ticketsSold) && ticketsSold > 0) {
    prevCashValue = computePrevCashFromTickets(cashValue, ticketsSold);
  }

  // Lower tiers: compute with cashValue=0 and NO taxes
  const resLowerNoTax = window.PowerballEV.computeEV({
    cashValue: 0,
    prevCashValue: NaN,
    ticketPrice: EV_ENGINE_TICKET_PRICE,
    jackpotShare: EV_ENGINE_JACKPOT_SHARE,
    fedTax: 0,
    stateTax: 0
  });

  // Full EV (lower + jackpot): compute with real cashValue and NO taxes
  const resTotalNoTax = window.PowerballEV.computeEV({
    cashValue,
    prevCashValue,
    ticketPrice: EV_ENGINE_TICKET_PRICE,
    jackpotShare: EV_ENGINE_JACKPOT_SHARE,
    fedTax: 0,
    stateTax: 0
  });

  if (!resLowerNoTax || !resLowerNoTax.ok || !resTotalNoTax || !resTotalNoTax.ok) {
    evOut.textContent = "—";
    return;
  }

  const lowerEV = resLowerNoTax.totalEV;
  const jackpotEVPreTax = resTotalNoTax.totalEV - resLowerNoTax.totalEV;

  // Apply taxes ONLY to jackpot portion (this is what you wanted)
  const totalEV = lowerEV + (jackpotEVPreTax * (1 - combinedTax));

  const m = resTotalNoTax.formats.money;
  evOut.textContent = m(totalEV);
}

// ==============================
// Init
// ==============================
window.addEventListener("DOMContentLoaded", async () => {
  populateStateSelect();
  syncStateTaxFromSelect();

  // Event delegation: always recalcs even if inputs get replaced later
  document.addEventListener("input", (e) => {
    if (e.target && e.target.id === "stateSelect") {
      syncStateTaxFromSelect();
      return;
    }
    scheduleCalc();
  }, true);

  document.addEventListener("change", (e) => {
    if (e.target && e.target.id === "stateSelect") {
      syncStateTaxFromSelect();
      return;
    }
    scheduleCalc();
  }, true);

  await autofillFromWorker();
  runCalc();
});
