const ODDS_JACKPOT = 292201338; // total outcomes = C(69,5)*26
const WHITE_TOTAL = 69;
const WHITE_PICK = 5;
const PB_TOTAL = 26;

function money(n) {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function clamp01(x) {
  if (!Number.isFinite(x)) return 0;
  return Math.min(1, Math.max(0, x));
}

function nCr(n, r) {
  if (r < 0 || r > n) return 0;
  r = Math.min(r, n - r);
  let num = 1;
  let den = 1;
  for (let i = 1; i <= r; i++) {
    num *= (n - r + i);
    den *= i;
  }
  return num / den;
}

// Poisson expectation: E[ cash / (1 + X) ] where X ~ Poisson(lambda)
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

// Count outcomes for exactly k white matches (out of 5), and PB match yes/no
function outcomesFor(kWhite, pbMatch) {
  const whiteWays =
    nCr(WHITE_PICK, kWhite) * nCr(WHITE_TOTAL - WHITE_PICK, WHITE_PICK - kWhite);
  const pbWays = pbMatch ? 1 : (PB_TOTAL - 1);
  return whiteWays * pbWays;
}

function probFor(kWhite, pbMatch) {
  return outcomesFor(kWhite, pbMatch) / ODDS_JACKPOT;
}

// Base (no Power Play) prize table (USD)
function prizeFor(kWhite, pbMatch) {
  if (kWhite === 5 && pbMatch) return null; // jackpot handled separately
  if (kWhite === 5 && !pbMatch) return 1_000_000;
  if (kWhite === 4 && pbMatch) return 50_000;
  if (kWhite === 4 && !pbMatch) return 100;
  if (kWhite === 3 && pbMatch) return 100;
  if (kWhite === 3 && !pbMatch) return 7;
  if (kWhite === 2 && pbMatch) return 7;
  if (kWhite === 1 && pbMatch) return 4;
  if (kWhite === 0 && pbMatch) return 4;
  return 0;
}

function lowerTierEVPerTicket(afterTaxMultiplier) {
  // sum over all non-jackpot tiers
  const tiers = [
    [5, false],
    [4, true],
    [4, false],
    [3, true],
    [3, false],
    [2, true],
    [2, false],
    [1, true],
    [0, true],
  ];

  let ev = 0;
  for (const [k, pb] of tiers) {
    const prize = prizeFor(k, pb);
    const p = probFor(k, pb);
    ev += p * prize * afterTaxMultiplier;
  }
  return ev;
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

  // Ticket-sales estimate from Δcash, else fallback
  let ticketsEst;
  let usedDelta = false;

  if (Number.isFinite(prevCashValue) && prevCashValue > 0) {
    const deltaCash = cashValue - prevCashValue;
    if (deltaCash <= 0) {
      notesOut.textContent =
        "Previous cash value must be lower than current cash value to estimate sales.";
      evOut.textContent = "—";
      edgeOut.textContent = "—";
      return;
    }
    ticketsEst = deltaCash / Math.max(0.01, jackpotShare) / Math.max(0.01, ticketPrice);
    usedDelta = true;
  } else {
    ticketsEst = cashValue / Math.max(0.01, jackpotShare) / Math.max(0.01, ticketPrice);
  }

  const lambdaOthers = ticketsEst / ODDS_JACKPOT;

  // Jackpot EV (with split modeling)
  const expectedIfWin = expectedShareGivenWin(cashValue, lambdaOthers);
  const afterTaxMult = (1 - totalTax);
  const jackpotEVPerTicket = (1 / ODDS_JACKPOT) * expectedIfWin * afterTaxMult;

  // Lower-tier EV (fixed prizes; no split modeling needed)
  const lowerEVPerTicket = lowerTierEVPerTicket(afterTaxMult);

  const totalEV = jackpotEVPerTicket + lowerEVPerTicket;

  evOut.textContent = money(totalEV);
  edgeOut.textContent = money(totalEV - (Number.isFinite(ticketPrice) ? ticketPrice : 2));

  notesOut.textContent =
    `EV includes jackpot + all lower prizes (no Power Play). ` +
    `Sales est: ${Math.round(ticketsEst).toLocaleString()} ` +
    `(method: ${usedDelta ? "Δcash" : "fallback"}). ` +
    `λ(other winners): ${lambdaOthers.toFixed(3)}. ` +
    `Tax: ${(totalTax * 100).toFixed(1)}%. ` +
    `Jackpot EV: ${money(jackpotEVPerTicket)}; Lower-tier EV: ${money(lowerEVPerTicket)}.`;
});
