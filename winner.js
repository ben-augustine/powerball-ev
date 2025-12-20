// Worker endpoint (use v=1 — you already saw the non-v query sometimes returns nulls)
const WORKER_URL = "https://powerball-ev-data.ben-augustine319.workers.dev/powerball?v=1";

// Powerball jackpot odds
const ODDS_JACKPOT = 292201338;

// Defaults for estimating tickets from cash delta
const DEFAULT_TICKET_PRICE = 2;
const DEFAULT_JACKPOT_SHARE = 0.70;

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
  // Use log for stability: (1 - 1/p)^n = exp(n * ln(1 - 1/p))
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

function renderWithN(n, sourceLabel) {
  const winOut = document.getElementById("winOut");
  const rollOut = document.getElementById("rollOut");
  const nOut = document.getElementById("nOut");

  const p = ODDS_JACKPOT;
  const pOut = document.getElementById("pOut");
  if (pOut) pOut.value = p.toLocaleString();

  if (!Number.isFinite(n) || n <= 0) {
    if (winOut) winOut.textContent = "—";
    if (rollOut) rollOut.textContent = "—";
    if (nOut) nOut.textContent = "—";
    return;
  }

  const winProb = probAtLeastOneWinner(n, p);
  const rollProb = 1 - winProb;

  if (winOut) winOut.textContent = formatPct(winProb);
  if (rollOut) rollOut.textContent = formatPct(rollProb);
  if (nOut) nOut.textContent = `${formatInt(n)} (${sourceLabel})`;
}

async function main() {
  const overrideEl = document.getElementById("ticketsOverride");

  // Initial load: auto estimate from Worker
  const autoN = await loadAutoEstimate();
  renderWithN(autoN, "auto estimate");

  // If user types an override, use it immediately
  let timer = null;
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const overrideN = readNumber(overrideEl);
      if (Number.isFinite(overrideN) && overrideN > 0) {
        renderWithN(overrideN, "manual override");
      } else {
        renderWithN(autoN, "auto estimate");
      }
    }, 120);
  }

  if (overrideEl) {
    overrideEl.addEventListener("input", schedule);
    overrideEl.addEventListener("change", schedule);
  }

  // Refresh auto estimate hourly (only matters if override is blank)
  setInterval(async () => {
    const newAutoN = await loadAutoEstimate();
    // only update stored autoN if it’s valid
    if (Number.isFinite(newAutoN) && newAutoN > 0) {
      // update reference
      // eslint-disable-next-line no-unused-vars
      // (we just re-render based on whether override exists)
      const overrideN = readNumber(overrideEl);
      if (!Number.isFinite(overrideN) || overrideN <= 0) {
        renderWithN(newAutoN, "auto estimate");
      }
    }
  }, 60 * 60 * 1000);
}

window.addEventListener("DOMContentLoaded", main);
