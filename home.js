// Worker endpoint (hourly caching happens in the Worker)
const WORKER_URL = "https://powerball-ev-data.ben-augustine319.workers.dev/powerball?v=1";

// Display rules
const DISPLAY_TICKET_PRICE = 2;
const CONTRIBUTION_PER_TICKET = 0.70;

// For computeEV ticket-estimation: tickets = Δcash / (jackpotShare * ticketPrice)
// We want tickets = Δcash / 0.70  => use 0.70 * 1
const EV_ENGINE_TICKET_PRICE = 1;
const EV_ENGINE_JACKPOT_SHARE = 0.70;

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

    // Tickets sold since last draw based on $0.70 cash increase per ticket
    const ticketsSold = (cashValue - prevCashValue) / CONTRIBUTION_PER_TICKET;

    // Defaults for home (no inputs)
    const fedTax = 0.37;
    const stateTax = 0.00;

    const res = window.PowerballEV.computeEV({
      cashValue,
      prevCashValue,
      ticketPrice: EV_ENGINE_TICKET_PRICE,
      jackpotShare: EV_ENGINE_JACKPOT_SHARE,
      fedTax,
      stateTax,
    });

    if (!res.ok) throw new Error(res.error);

    heroCash.textContent = res.formats.money0(cashValue);
    heroTickets.textContent = Math.round(ticketsSold).toLocaleString();
    heroEV.textContent = res.formats.money(res.totalEV);

    // EV color (green if >= $2, red otherwise)
    heroEV.classList.remove("ev-positive", "ev-negative");
    if (res.totalEV >= DISPLAY_TICKET_PRICE) heroEV.classList.add("ev-positive");
    else heroEV.classList.add("ev-negative");

    const when = j?.fetchedAt ? new Date(j.fetchedAt).toLocaleString() : "unknown";
    // Make this more discreet: just a subtle timestamp
    heroMeta.textContent = `Updated: ${when}`;
  } catch (e) {
    console.error(e);
    heroMeta.textContent = "Update failed.";
  }
}

// Run now + hourly
refreshHero();
setInterval(refreshHero, 60 * 60 * 1000);
