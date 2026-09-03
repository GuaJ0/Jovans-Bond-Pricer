// pure bond pricing & analytics — no document.* here, so this file is
// unit-testable directly under Node/Vitest as well as loaded in the browser
if (typeof module !== 'undefined' && module.exports) {
  global.interpolateCurve = require('./Curve.js').interpolateCurve;
}

// Normal coupon bond. When curvePoints is provided, each cash flow is
// discounted at the interpolated curve rate for its own maturity instead
// of a single flat yield (spot-rate / term-structure discounting).
function priceNormalBond({ faceValue, couponRatePercent, years, PPY, yieldPercent, curvePoints }) {
  const coupon = faceValue * couponRatePercent / (100 * PPY);
  const totalPayments = Math.round(years * PPY);
  const flatPerPeriodRate = yieldPercent / (100 * PPY);

  const cashFlows = [];
  let price = 0;

  for (let i = 1; i <= totalPayments; i++) {
    const t = i / PPY;
    const perPeriodRate = curvePoints
      ? interpolateCurve(curvePoints, t) / 100 / PPY
      : flatPerPeriodRate;
    const amount = i === totalPayments ? coupon + faceValue : coupon;
    const discountFactor = 1 / Math.pow(1 + perPeriodRate, i);
    const pv = amount * discountFactor;
    cashFlows.push({ period: i, t, amount, rate: perPeriodRate, discountFactor, pv });
    price += pv;
  }

  return { price, coupon, totalPayments, cashFlows };
}

// P = cF / lambda
function pricePerpetualBond({ faceValue, couponRatePercent, yieldPercent }) {
  const price = yieldPercent === 0 ? Infinity : (couponRatePercent * faceValue) / yieldPercent;
  return { price, coupon: (couponRatePercent / 100) * faceValue };
}

// P = F / (1 + lambda)^years, or curve rate at `years` maturity
function priceZeroCouponBond({ faceValue, years, yieldPercent, curvePoints }) {
  const rate = curvePoints ? interpolateCurve(curvePoints, years) / 100 : yieldPercent / 100;
  const discountFactor = 1 / Math.pow(1 + rate, years);
  const pv = faceValue * discountFactor;
  const cashFlows = [{ period: 1, t: years, amount: faceValue, rate, discountFactor, pv }];
  return { price: pv, rate, cashFlows };
}

// given a target market price, solve for the flat yield that reproduces it.
// Zero/Perpetual have closed forms; Normal uses Newton-Raphson (analytic
// derivative) with a bisection fallback over a wide bracket so pathological
// inputs (price far outside any plausible yield) still return something.
function solveYieldForPrice({ bondType, faceValue, couponRatePercent, years, PPY, targetPrice }) {
  if (!(targetPrice > 0)) return null;

  if (bondType === 'Perpetual') {
    return (couponRatePercent * faceValue) / targetPrice;
  }

  if (bondType === 'Zero') {
    if (!(faceValue > 0) || !(years > 0)) return null;
    return (Math.pow(faceValue / targetPrice, 1 / years) - 1) * 100;
  }

  const totalPayments = Math.round(years * PPY);
  const coupon = faceValue * couponRatePercent / (100 * PPY);

  function priceAndDerivative(yPercent) {
    const perPeriodRate = yPercent / (100 * PPY);
    let price = 0;
    let dPriceDPerPeriod = 0;
    for (let i = 1; i <= totalPayments; i++) {
      const amount = i === totalPayments ? coupon + faceValue : coupon;
      const df = Math.pow(1 + perPeriodRate, i);
      price += amount / df;
      dPriceDPerPeriod += (-i * amount) / (df * (1 + perPeriodRate));
    }
    return { price, derivative: dPriceDPerPeriod / (100 * PPY) };
  }

  function priceAt(yPercent) {
    return priceNormalBond({ faceValue, couponRatePercent, years, PPY, yieldPercent: yPercent, curvePoints: null }).price;
  }

  let y = couponRatePercent > 0 ? couponRatePercent : 5;
  for (let iter = 0; iter < 50; iter++) {
    const { price, derivative } = priceAndDerivative(y);
    const diff = price - targetPrice;
    if (Math.abs(diff) < 1e-7 * Math.max(1, targetPrice)) return y;
    if (Math.abs(derivative) < 1e-10) break;
    const next = y - diff / derivative;
    if (!isFinite(next) || next <= -100) break;
    y = next;
  }

  let lo = -99;
  let hi = 1000;
  let loDiff = priceAt(lo) - targetPrice;
  const hiDiff = priceAt(hi) - targetPrice;
  if (loDiff === 0) return lo;
  if (hiDiff === 0) return hi;
  if ((loDiff > 0) === (hiDiff > 0)) return null; // no sign change in bracket

  for (let iter = 0; iter < 200; iter++) {
    const mid = (lo + hi) / 2;
    const midDiff = priceAt(mid) - targetPrice;
    if (Math.abs(midDiff) < 1e-7 * Math.max(1, targetPrice)) return mid;
    if ((loDiff > 0) === (midDiff > 0)) {
      lo = mid;
      loDiff = midDiff;
    } else {
      hi = mid;
    }
  }
  return (lo + hi) / 2;
}

// PV-weighted average time to cash flow, in years — well defined regardless
// of whether flat-yield or curve discounting produced the cash flows.
function macaulayDuration(cashFlows, price) {
  if (!(price > 0)) return null;
  const weighted = cashFlows.reduce((sum, cf) => sum + cf.t * cf.pv, 0);
  return weighted / price;
}

function modifiedDuration(macaulay, yieldPercent, periodsPerYear) {
  if (macaulay == null) return null;
  const perPeriodRate = yieldPercent / (100 * periodsPerYear);
  return macaulay / (1 + perPeriodRate);
}

function convexity(cashFlows, price, yieldPercent, periodsPerYear) {
  if (!(price > 0)) return null;
  const perPeriodRate = yieldPercent / (100 * periodsPerYear);
  const weighted = cashFlows.reduce(
    (sum, cf) => sum + cf.pv * cf.t * (cf.t + 1 / periodsPerYear),
    0
  );
  return weighted / (price * Math.pow(1 + perPeriodRate, 2));
}

// closed forms for a perpetuity: D_mac = (1+y)/y, D_mod = 1/y, C = 2/y^2
function perpetualMacaulayDuration(yieldPercent) {
  const y = yieldPercent / 100;
  return y > 0 ? (1 + y) / y : null;
}
function perpetualModifiedDuration(yieldPercent) {
  const y = yieldPercent / 100;
  return y > 0 ? 1 / y : null;
}
function perpetualConvexity(yieldPercent) {
  const y = yieldPercent / 100;
  return y > 0 ? 2 / (y * y) : null;
}

// accrued interest is a coupon-bond concept: the buyer of a Normal bond
// between coupon dates owes the seller the coupon earned so far this period
function accruedInterest({ coupon, fractionOfPeriodElapsed }) {
  const f = Math.min(1, Math.max(0, fractionOfPeriodElapsed || 0));
  return coupon * f;
}

function dirtyPrice(cleanPrice, accrued) {
  return cleanPrice + accrued;
}

function validateBondInputs({ faceValue, couponRatePercent, years, yieldPercent, PPY, Dec, bondType, isSolvingYield, marketPrice }) {
  const errors = [];

  if (!(faceValue > 0)) errors.push('Face value must be greater than 0.');
  if (Number.isNaN(couponRatePercent) || couponRatePercent < 0) errors.push('Coupon rate cannot be negative.');
  if (bondType !== 'Perpetual' && (!(years > 0) || Number.isNaN(years))) errors.push('Years must be greater than 0.');
  if (!Number.isInteger(PPY) || PPY < 1) errors.push('Payments per year must be a whole number of at least 1.');
  if (!Number.isInteger(Dec) || Dec < 0 || Dec > 6) errors.push('Decimals must be a whole number between 0 and 6.');

  if (isSolvingYield) {
    if (!(marketPrice > 0)) errors.push('Market price must be greater than 0 to solve for yield.');
  } else {
    if (Number.isNaN(yieldPercent) || yieldPercent <= -100) errors.push('Yield must be greater than -100%.');
    if (bondType === 'Perpetual' && yieldPercent <= 0) errors.push('Perpetual bonds require a yield greater than 0%.');
  }

  return errors;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    priceNormalBond,
    pricePerpetualBond,
    priceZeroCouponBond,
    solveYieldForPrice,
    macaulayDuration,
    modifiedDuration,
    convexity,
    perpetualMacaulayDuration,
    perpetualModifiedDuration,
    perpetualConvexity,
    accruedInterest,
    dirtyPrice,
    validateBondInputs,
  };
}
