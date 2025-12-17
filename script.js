const ODDS_JACKPOT = 292201338; // Powerball jackpot odds

function money(n) {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function clamp01(x) {
  if (!Number.isFinite(x)) return 0;
  return Math.min(1, Math.max(0, x));
}

// Expected value of jackpot portion per ticket, given:
// - cashValue: total cash jackpot pool
// - lambda: expected # of jackpot winners (Poisson)
// We compute E[ cashValue / K | K>=1 ] * P(K>=1)
// => sum_{k=1..Kmax} P(K=k) * cashValue/k  (truncated)
function expectedJackpotPerTicket(cashValue, lambda) {
  // If lambda is tiny, almost always zero winners.
  if (lambda <= 0) return 0;

  let evJackpot = 0;

  // Truncate Poisson tail; for realistic ticket volumes, k beyond ~50 is negligible.
  const KMAX = 60;

  // Compute Poisson probabilities iteratively to avoid factorials:
  // P0 = e^-λ; Pk = P(k-1) * λ / k
  let p = Math.exp(-lambda); // P0

  for (let k = 1; k <= KMAX; k++) {
    p = p * (lambda / k); // now Pk
    evJackpot += p * (cashValue / k);
  }

  // Note: this ignores probability mass for k > KMAX (tiny unless lambda is huge).
  // If lambda is huge, EV approaches cashValue/lambda roughly anyway.
  return evJackpot / 1; // per drawing, per ticket later handled outside
}

document.getElementById("calcBtn").addEventListener("click", () => {
  const cashValue = Number(document.getElementById("cashValue").value);
  const ticketPrice = Number(document.getElementById("ticketPrice").value);

  const jackpotShare = clamp01(Number(document.getElementById("jackpotShare").value));
  const fedTax = clamp01(Number(document.getElementById("fedTax").value));
  const stateTax = clamp01(Number(document.getElementById("stateTax").value));
  const totalTax = clamp01(fedTax + stateTax);

  const evOut = document.getElementById("evOut");
  const edgeOut = document.getElementById("edgeOut");
  const notesOut = document.getElementById("notesOut");

  if (!Number.isFinite(cashValue) || cashValue <= 0) {
    notesOut.textContent = "Enter a valid cash value jackpot first.";
    evOut.textContent = "—";
    edgeOut.textContent = "—";
    return;
  }

  // Estimate tickets sold (very rough): cashValue / jackpotShare / ticketPrice
  // This is NOT the true method you ultimately want (Δcash between drawings),
  // but it lets you test the split model with a single-drawing input.
  const ticketsEst = cashValue / Math.max(0.01, jackpotShare) / Math.max(0.01, ticketPrice);

  // Expected jackpot winners (Poisson λ)
  const lambda = ticketsEst / ODDS_JACKPOT;

  // Expected jackpot payout (before tax) across split outcomes
  const expectedJackpotPayout = expectedJackpotPerTicket(cashValue, lambda);

  // Convert to per-ticket EV by dividing by tickets sold
  const jackpotEVPerTicketPreTax = expectedJackpotPayout / ticketsEst;

  // Apply taxes to jackpot portion (simplified)
  const jackpotEVPerTicketAfterTax = jackpotEVPerTicketPreTax * (1 - totalTax);

  // For now, total EV is just jackpot EV (we'll add lower-tier next)
  const totalEV = jackpotEVPerTicketAfterTax;

  evOut.textContent = money(totalEV);
  edgeOut.textContent = money(totalEV - (Number.isFinite(ticketPrice) ? ticketPrice : 2));

  notesOut.textContent =
    `Jackpot-only EV (cash). Tickets est: ${Math.round(ticketsEst).toLocaleString()} | ` +
    `λ winners: ${lambda.toFixed(3)} | Tax used: ${(totalTax * 100).toFixed(1)}%. ` +
    `Next: replace ticket estimate with Δcash method + add lower-tier prizes.`;
});
