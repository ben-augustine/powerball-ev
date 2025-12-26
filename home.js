// Worker endpoint (hourly caching happens in the Worker)
const WORKER_URL = "https://powerball-ev-data.ben-augustine319.workers.dev/powerball";

// Display rules
const DISPLAY_TICKET_PRICE = 2;
const CONTRIBUTION_PER_TICKET = 0.70;

// For computeEV ticket-estimation:
// tickets = Δcash / (jackpotShare * ticketPrice)
// We want tickets = Δcash / 0.70
// So ticketPrice=1 and jackpotShare=1.0 (do NOT distort payouts)
const EV_ENGINE_TICKET_PRICE = 2;
const EV_ENGINE_JACKPOT_SHARE = 1.0;   // FIX

async function refreshHero() {
  const heroCash = document.getElementById("heroCash");
  const heroTickets = document.getElementById("heroTickets");
  const heroEV = document.getElementById("heroEV");
  const heroMeta = document.getElementById("heroMeta");

  if (!heroCash || !heroTickets || !heroEV || !heroMeta) return;

  heroMeta.textContent = "";

  try {
    const r = await fetch(WORKER_URL, { cache: "no-store" });
    const j = await r.json();

    const cashValue = j?.next?.cashValue;
    const prevCashValue = j?.prev?.cashValue;

    if (!Number.isFinite(cashValue) || !Number.isFinite(prevCashValue)) {
      throw new Error("Missing cash values");
    }

    let ticketsSold;

// If jackpot reset, prevCashValue > cashValue → can't infer from delta → assume 8M
    if (prevCashValue > cashValue) {
      ticketsSold = 8_000_000;
    } else {
      ticketsSold = (cashValue - prevCashValue) / CONTRIBUTION_PER_TICKET;
    }

    // Defaults for home (no inputs)
    const fedTax = 0.37;
    const stateTax = 0.00;
    const combinedTax = Math.min(1, Math.max(0, fedTax + stateTax));

    // --- CHANGE START ---
    // Lower tiers (no tax): compute with cashValue=0
    const resLowerNoTax = window.PowerballEV.computeEV({
      cashValue: 0,
      prevCashValue: NaN,
      ticketPrice: EV_ENGINE_TICKET_PRICE,
      jackpotShare: EV_ENGINE_JACKPOT_SHARE,
      fedTax: 0,
      stateTax: 0,
    });

    // Total EV (no tax): compute with real cashValue
    const resTotalNoTax = window.PowerballEV.computeEV({
      cashValue,
      prevCashValue,
      ticketPrice: EV_ENGINE_TICKET_PRICE,
      jackpotShare: EV_ENGINE_JACKPOT_SHARE, // FIXED
      fedTax: 0,
      stateTax: 0,
    });

    if (!resLowerNoTax?.ok) throw new Error(resLowerNoTax?.error || "EV lower-tier calc failed");
    if (!resTotalNoTax?.ok) throw new Error(resTotalNoTax?.error || "EV total calc failed");

    const lowerEV = resLowerNoTax.totalEV;
    const jackpotEVPreTax = resTotalNoTax.totalEV - resLowerNoTax.totalEV;
    const totalEV = lowerEV + (jackpotEVPreTax * (1 - combinedTax));
    // --- CHANGE END ---

    heroCash.textContent = resTotalNoTax.formats.money0(cashValue);
    heroTickets.textContent = Math.round(ticketsSold).toLocaleString();
    heroEV.textContent = resTotalNoTax.formats.money(totalEV);

    // EV color (green if >= $2, red otherwise)
    heroEV.classList.remove("ev-positive", "ev-negative");
    if (totalEV >= DISPLAY_TICKET_PRICE) heroEV.classList.add("ev-positive");
    else heroEV.classList.add("ev-negative");

    const when = j?.fetchedAt ? new Date(j.fetchedAt).toLocaleString() : "unknown";
    heroMeta.textContent = `Updated: ${when}`;
  } catch (e) {
    console.error(e);
    heroMeta.textContent = "Update failed.";
  }
}

// Run now + hourly
refreshHero();
setInterval(refreshHero, 60 * 60 * 1000);
