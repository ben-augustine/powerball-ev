(() => {
  const ODDS_JACKPOT = 292201338; // total outcomes = C(69,5)*26
  const WHITE_TOTAL = 69;
  const WHITE_PICK = 5;
  const PB_TOTAL = 26;

  function clamp01(x) {
    if (!Number.isFinite(x)) return 0;
    return Math.min(1, Math.max(0, x));
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
      maximumFractionDigits: 0
    });
  }

  function nCr(n, r) {
    if (r < 0 || r > n) return 0;
    r = Math.min(r, n - r);
    let num = 1, den = 1;
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
    let sum = p * cashValue;   // x=0 => cash/(1+0)

    for (let x = 1; x <= XMAX; x++) {
      p *= (lambda / x);
      sum += p * (cashValue / (1 + x));
    }
    return sum;
  }

  function outcomesFor(kWhite, pbMatch) {
    const whiteWays =
      nCr(WHITE_PICK, kWhite) *
      nCr(WHITE_TOTAL - WHITE_PICK, WHITE_PICK - kWhite);
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
    const tiers = [
      [5, false],
      [4, true],
      [4, false],
      [3, true],
      [3, false],
      [2, true],
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

  function computeEV({
    cashValue,
    prevCashValue,
    ticketPrice,
    jackpotShare,
    fedTax,
    stateTax
  }) {
    const cv = Number(cashValue);
    if (!Number.isFinite(cv) || cv <= 0) {
      return { ok: false, error: "Enter a valid cash value jackpot." };
    }

    const tp = Number(ticketPrice);
    const js = clamp01(Number(jackpotShare));
    const ft = clamp01(Number(fedTax));
    const st = clamp01(Number(stateTax));
    const totalTax = clamp01(ft + st);

    let ticketsEst;
    let usedDelta = false;

    const pcv = Number(prevCashValue);
    if (Number.isFinite(pcv) && pcv > 0) {
      const deltaCash = cv - pcv;
      if (deltaCash <= 0) {
        return { ok: false, error: "Previous cash value must be lower than current cash value." };
      }
      ticketsEst = deltaCash / Math.max(0.01, js) / Math.max(0.01, tp);
      usedDelta = true;
    } else {
      ticketsEst = cv / Math.max(0.01, js) / Math.max(0.01, tp);
    }

    const lambdaOthers = ticketsEst / ODDS_JACKPOT;

    const expectedIfWin = expectedShareGivenWin(cv, lambdaOthers);
    const afterTaxMult = 1 - totalTax;

    const jackpotEVPerTicket = (1 / ODDS_JACKPOT) * expectedIfWin * afterTaxMult;
    const lowerEVPerTicket = lowerTierEVPerTicket(afterTaxMult);
    const totalEV = jackpotEVPerTicket + lowerEVPerTicket;

    return {
      ok: true,
      totalEV,
      jackpotEVPerTicket,
      lowerEVPerTicket,
      ticketsEst,
      usedDelta,
      lambdaOthers,
      totalTax,
      formats: { money, money0 }
    };
  }

  window.PowerballEV = { computeEV, clamp01, money, money0 };
})();
