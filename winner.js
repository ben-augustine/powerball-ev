// winner.js
const WORKER_URL = "https://powerball-ev-data.ben-augustine319.workers.dev/powerball?v=1";
const DEFAULT_ODDS_JACKPOT = 292201338;

const DEFAULT_TICKET_PRICE = 2;
const DEFAULT_JACKPOT_SHARE = 0.35;

function clampMin(x, min) {
  return x < min ? min : x;
}

function readNumber(el) {
  if (!el) return NaN;
  const raw = String(el.value ?? "").trim();
  if (!raw) return NaN;
  const cleaned = raw.replace(/,/g, "").replace(/\s+/g, "");
  const v = Number(cleaned);
  return Number.isFinite(v) ? v : NaN;
}

function formatInt(n) {
  if (!Number.isFinite(n)) return "—";
  return Math.round(n).toLocaleString();
}

function formatPct(x) {
  if (!Number.isFinite(x)) return "—";
  return (100 * x).toFixed(2) + "%";
}

// P(at least one winner) = 1 - (1 - 1/p)^n
function probAtLeastOneWinner(n, p) {
  if (!Number.isFinite(n) || n <= 0) return 0;
  if (!Number.isFinite(p) || p <= 1) return 0;

  const q = 1 - 1 / p;
  return 1 - Math.exp(n * Math.log(q));
}

function estimateTicketsFromCashDelta({ cashValue, prevCashValue, jackpotShare, ticketPrice }) {
  const delta = cashValue - prevCashValue;
  if (!Number.isFinite(delta) || delta <= 0) return NaN;

  const js = clampMin(jackpotShare, 0.01);
  const tp = clampMin(ticketPrice, 0.01);
  return delta / (js * tp);
}

function render(n, p) {
  const winOut = document.getElementById("winOut");
  const rollOut = document.getElementById("rollOut");

  if (!Number.isFinite(n) || n <= 0 || !Number.isFinite(p) || p <= 1) {
    if (winOut) winOut.textContent = "—";
    if (rollOut) rollOut.textContent = "—";
    return;
  }

  const winProb = probAtLeastOneWinner(n, p);
  const rollProb = 1 - winProb;

  if (winOut) winOut.textContent = formatPct(winProb);
  if (rollOut) rollOut.textContent = formatPct(rollProb);
}

async function loadAutoEstimate() {
  const metaOut = document.getElementById("metaOut");

  try {
    const r = await fetch(WORKER_URL, { cache: "no-store" });
    const j = await r.json();

    const nextCash = j?.next?.cashValue;
    const prevCash = j?.prev?.cashValue;

    if (!Number.isFinite(nextCash) || !Number.isFinite(prevCash)) {
      throw new Error("Missing cash values from worker");
    }

    const n = estimateTicketsFromCashDelta({
      cashValue: nextCash,
      prevCashValue: prevCash,
      jackpotShare: DEFAULT_JACKPOT_SHARE,
      ticketPrice: DEFAULT_TICKET_PRICE
    });

    const when = j?.fetchedAt ? new Date(j.fetchedAt).toLocaleString() : "unknown";
    if (metaOut) metaOut.textContent = `Auto estimate updated: ${when}.`;

    return n;
  } catch (e) {
    console.error(e);
    if (metaOut) metaOut.textContent = "Auto estimate failed (worker fetch/parse).";
    return NaN;
  }
}

function wireLiveUpdates(getAutoN) {
  const nIn = document.getElementById("nIn");
  const pIn = document.getElementById("pIn");
  const useAutoBtn = document.getElementById("useAutoBtn");

  function recompute() {
    const n = readNumber(nIn);
    const p = readNumber(pIn);
    render(n, p);
  }

  // Live update when typing
  if (nIn) nIn.addEventListener("input", recompute);
  if (pIn) pIn.addEventListener("input", recompute);

  // Restore auto estimate
  if (useAutoBtn) {
    useAutoBtn.addEventListener("click", async () => {
      const autoN = await getAutoN();
      if (Number.isFinite(autoN) && autoN > 0 && nIn) nIn.value = formatInt(autoN);
      recompute();
    });
  }
}

async function main() {
  const nIn = document.getElementById("nIn");
  const pIn = document.getElementById("pIn");

  // Set default odds in the box
  if (pIn) pIn.value = DEFAULT_ODDS_JACKPOT.toLocaleString();

  // Load auto estimate, put it in the box, and render
  async function getAutoN() {
    return await loadAutoEstimate();
  }

  const autoN = await getAutoN();
  if (Number.isFinite(autoN) && autoN > 0 && nIn) nIn.value = formatInt(autoN);

  render(readNumber(nIn), readNumber(pIn));

  // Enable live typing updates
  wireLiveUpdates(getAutoN);

  // Refresh auto estimate hourly (only matters if the user clicks Use Auto Estimate)
  setInterval(async () => {
    await loadAutoEstimate(); // updates meta timestamp
  }, 60 * 60 * 1000);
}

window.addEventListener("DOMContentLoaded", main);
