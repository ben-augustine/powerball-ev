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

const WORKER_URL = "https://powerball-ev-data.ben-augustine319.workers.dev/powerball";
async function autofillFromWorker({ runAfter = false } = {}) {
  const autoStatus = document.getElementById("autoStatus");
  const cashEl = document.getElementById("cashValue");
  const prevEl = document.getElementById("prevCashValue");

  if (!cashEl || !prevEl) return;

  if (autoStatus) autoStatus.textContent = "Fetching…";

  try {
    const r = await fetch(WORKER_URL, { cache: "no-store" });
    const j = await r.json();

    const nextCash = j?.next?.cashValue;
    const prevCash = j?.prev?.cashValue;

    if (!Number.isFinite(nextCash) || !Number.isFinite(prevCash)) {
      throw new Error("Missing cash values");
    }

    cashEl.value = Math.round(nextCash);
    prevEl.value = Math.round(prevCash);

    if (autoStatus) {
      const when = j?.fetchedAt ? new Date(j.fetchedAt).toLocaleString() : "unknown";
      autoStatus.textContent = `Autofilled. Last fetch: ${when}`;
    }

    if (runAfter && typeof runCalc === "function") runCalc();
  } catch (e) {
    console.error(e);
    if (autoStatus) autoStatus.textContent = "Autofill failed.";
  }
}


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
  }

  sel.addEventListener("change", applyFromSelect);

  // Clicking into tax box flips back to manual
  stateTaxInput.addEventListener("focus", () => {
    if (sel.value !== "") {
      sel.value = "";
      stateTaxInput.readOnly = false;
    }
  });

  const autofillBtn = document.getElementById("autofillBtn");
    if (autofillBtn) autofillBtn.addEventListener("click", () => autofillFromWorker({ runAfter: true }));

    // Autofill once on load (does NOT auto-calc unless you want it to)
    autofillFromWorker({ runAfter: false });


  applyFromSelect();
}

function runCalc() {
  const cashValue = Number(document.getElementById("cashValue").value);
  const prevCashValue = Number(document.getElementById("prevCashValue").value);

  const ticketPrice = Number(document.getElementById("ticketPrice").value);
  const jackpotShare = Number(document.getElementById("jackpotShare").value);
  const fedTax = Number(document.getElementById("fedTax").value);
  const stateTax = Number(document.getElementById("stateTax").value);

  const evOut = document.getElementById("evOut");
  const edgeOut = document.getElementById("edgeOut");
  const notesOut = document.getElementById("notesOut");

  const res = window.PowerballEV.computeEV({
    cashValue, prevCashValue, ticketPrice, jackpotShare, fedTax, stateTax
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

  notesOut.textContent =
    `EV includes jackpot + all lower prizes (no Power Play). ` +
    `Sales est: ${Math.round(res.ticketsEst).toLocaleString()} ` +
    `(method: ${res.usedDelta ? "Δcash" : "fallback"}). ` +
    `λ(other winners): ${res.lambdaOthers.toFixed(3)}. ` +
    `Tax: ${(res.totalTax * 100).toFixed(1)}%. ` +
    `Jackpot EV: ${m(res.jackpotEVPerTicket)}; Lower-tier EV: ${m(res.lowerEVPerTicket)}.`;
}

initStateDropdown();

document.getElementById("calcBtn").addEventListener("click", runCalc);
