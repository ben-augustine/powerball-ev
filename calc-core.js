(() => {
  const ODDS_JACKPOT = 292201338; // total outcomes = C(69,5)*26
  const WHITE_TOTAL = 69;
  const WHITE_PICK = 5;
  const PB_TOTAL = 26;

  // Each ticket contributes ~$0.70 to *cash value*
  // (This is the model you want for ticket sales inference.)
  const CONTRIBUTION_PER_TICKET = 0.70;

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
    const XMAX = 200;
    let p = Math.exp(-lambda); // P0
    let sum = p * (cashValue / 1);
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

  // Lower tiers are ALWAYS untaxed per your spec.
  function lowerTierEVPerTicket() {
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
      ev += p * prize;
    }
    return ev;
  }

  function money(n) {
    if (!Number.isFinite(n)) return "—";
    return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
  }

  function money0(n) {
    if (!Number.isFinite(n)) return "—";
    return n.toLocaleString(undefined, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    });
  }

  function computeEV(opts) {
    const cashValue = Number(opts.cashValue);
    const prevCashValue = Number(opts.prevCashValue);
    const ticketsSold = Number(opts.ticketsSold);

    // Kept for compatibility with existing callers (but NOT used for tickets estimation anymore)
    const ticketPrice = Number(opts.ticketPrice);
    const jackpotShare = clamp01(Number(opts.jackpotShare));

    const fedTax = clamp01(Number(opts.fedTax));
    const stateTax = clamp01(Number(opts.stateTax));
    const totalTax = clamp01(fedTax + stateTax);

    // Allow cashValue = 0 specifically so you can compute "lower tiers only"
    if (!Number.isFinite(cashValue) || cashValue < 0) {
      return { ok: false, error: "Enter a valid cash value jackpot." };
    }

    // Tickets estimate: manual override > deltaCash/0.70 > fallback (cashValue/0.70)
    let ticketsEst;
    let usedDelta = false;
    let usedManualTickets = false;

    if (Number.isFinite(ticketsSold) && ticketsSold > 0) {
      ticketsEst = ticketsSold;
      usedManualTickets = true;
    } else if (Number.isFinite(prevCashValue) && prevCashValue >= 0) {
      const deltaCash = cashValue - prevCashValue;
      if (deltaCash < 0) {
        return {
          ok: false,
          error: "Previous cash value must be <= current cash value (or enter tickets sold).",
        };
      }
      ticketsEst = deltaCash / CONTRIBUTION_PER_TICKET;
      usedDelta = true;
    } else {
      ticketsEst = cashValue / CONTRIBUTION_PER_TICKET;
    }

    const lambdaOthers = (Number.isFinite(ticketsEst) && ticketsEst > 0)
      ? (ticketsEst / ODDS_JACKPOT)
      : 0;

    // Jackpot EV: taxed and split-aware
    const afterTaxMult = (1 - totalTax);

    let expectedIfWin = 0;
    let jackpotEVPerTicket = 0;

    if (cashValue > 0) {
      expectedIfWin = expectedShareGivenWin(cashValue, lambdaOthers);
      jackpotEVPerTicket = (1 / ODDS_JACKPOT) * expectedIfWin * afterTaxMult;
    }

    // Lower tiers: untaxed
    const lowerEVPerTicket = lowerTierEVPerTicket();

    // Total: lower (untaxed) + jackpot (taxed)
    const totalEV = jackpotEVPerTicket + lowerEVPerTicket;

    return {
      ok: true,
      cashValue,
      prevCashValue,
      ticketsSold,
      ticketsEst,
      usedDelta,
      usedManualTickets,
      lambdaOthers,
      totalTax,
      jackpotEVPerTicket,
      lowerEVPerTicket,
      totalEV,
      formats: { money, money0 },
      // keep these for compatibility/debugging even though they're no longer used for tickets inference
      ticketPrice,
      jackpotShare,
    };
  }

  window.PowerballEV = { computeEV };
})();
