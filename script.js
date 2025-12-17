const ODDS_JACKPOT = 292201338; // Powerball jackpot odds

function money(n) {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function clamp01(x) {
  if (!Number.isFinite(x)) return 0;
  return Math.min(1, Math.max(0, x));
}

// Poisson expectation: E[ cash / (1 + X) ] where X ~ Poisson(lambda)
// computed via iterative probabilities: P0=e^-λ, Px= P(x-1)*λ/x
function expectedShareGivenWin(cashValue, lambda) {
  const XMAX = 200; // plenty for realistic lambdas
  let p = Math.exp(-lambda); // P0
  let sum = p * (cashValue / 1); // x=0 => cash/(1+0)

  for (let x = 1; x <= XMAX; x++) {
    p = p * (lambda / x);
    sum += p * (cashValue / (1 + x));
  }
  return sum;
}

document.getElementById("calcBtn").addEventListener("click", () => {
  const cashValue = Number(document.getElementById("cashValue").value);
  const prevCashValue = Number(document.getElementById("prevCashValue").value);

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

  // Ticket-sales estimate: use Δcash if prev provided; otherwise warn + fall back.
  let ticketsEst;
  let usedDelta = false;

  if (Number.isFinite(prevCashValue) && prevCashValue > 0) {
    const deltaCash = cashValue - prevCashValue;
    if (deltaCash <= 0) {
      notesOut.textContent = "Previous cash value must be lower than current cash value to estimate sales.";
      evOut.textContent = "—";
      edgeOut.textContent = "—";
      return;
    }
    ticketsEst = deltaCash / Math.max(0.01, jackpotShare) / Math.max(0.01, ticketPrice);
    usedDelta = true;
  } else {
    // Fallback is intentionally crude; only for testing.
    ticketsEst = cashValue / Math.max(0.01, jackpotShare) / Math.max(0.01, ticketPrice);
  }

  // Expected number of OTHER jackpot winners if our ticket wins
  // Approx: all other tickets ~ ticketsEst, each wins with prob 1/odds
  const lambdaOthers = ticketsEst / ODDS_JACKPOT;

  // EV of jackpot for ONE ticket:
  // P(win) * E[ cash / (1 + X_others) ] * (1 - tax)
  const expectedIfWin = expectedShareGivenWin(cashValue, lambdaOthers);
  const jackpotEVPerTicket = (1 / ODDS_JACKPOT) * expectedIfWin * (1 - totalTax);

  evOut.textContent = money(jackpotEVPerTicket);
  edgeOut.textContent = money(jackpotEVPerTicket - (Number.isFinite(ticketPrice) ? ticketPrice : 2));

  notesOut.textContent =
    `Jackpot-only EV (cash). ` +
    `Ticket sales est: ${Math.round(ticketsEst).toLocaleString()} ` +
    `(method: ${usedDelta ? "Δcash" : "fallback"}). ` +
    `λ(other winners): ${lambdaOthers.toFixed(3)}. ` +
    `Tax: ${(totalTax * 100).toFixed(1)}%.`;
});
