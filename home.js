// Put your Worker endpoint here:
const WORKER_URL =
  "https://powerball-ev-data.ben-augustine319.workers.dev/powerball";


function readNum(id) {
  return Number(document.getElementById(id).value);
}

async function refreshHero() {
  const heroCash = document.getElementById("heroCash");
  const heroTickets = document.getElementById("heroTickets");
  const heroEV = document.getElementById("heroEV");
  const heroMeta = document.getElementById("heroMeta");

  heroMeta.textContent = "Updating…";

  try {
    const r = await fetch(WORKER_URL, { cache: "no-store" });
    const j = await r.json();

    const cashValue = j?.next?.cashValue;
    const prevCashValue = j?.prev?.cashValue;

    if (!Number.isFinite(cashValue) || !Number.isFinite(prevCashValue)) {
      throw new Error("Missing cash values");
    }

    const ticketPrice = readNum("ticketPrice") || 2;
    const jackpotShare = readNum("jackpotShare") || 0.70;
    const fedTax = readNum("fedTax") || 0.37;
    const stateTax = readNum("stateTax") || 0.00;

    // Use your same EV engine; prevCashValue drives ticket estimation
    const res = window.PowerballEV.computeEV({
      cashValue,
      prevCashValue,
      ticketPrice,
      jackpotShare,
      fedTax,
      stateTax
    });

    if (!res.ok) throw new Error(res.error);

    heroCash.textContent = res.formats.money0(cashValue);
    heroTickets.textContent = Math.round(res.ticketsEst).toLocaleString();
    heroEV.textContent = res.formats.money(res.totalEV);

    const when = j?.fetchedAt ? new Date(j.fetchedAt).toLocaleString() : "unknown";
    heroMeta.textContent = `Auto-updated hourly. Last fetch: ${when}.`;
  } catch (e) {
    heroMeta.textContent = "Auto-update failed. Check Worker URL / parsing.";
  }
}

document.getElementById("refreshBtn").addEventListener("click", refreshHero);

refreshHero();
setInterval(refreshHero, 60 * 60 * 1000);
