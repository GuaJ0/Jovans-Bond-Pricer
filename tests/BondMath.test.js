import { describe, it, expect } from 'vitest';
import {
  priceNormalBond,
  pricePerpetualBond,
  priceZeroCouponBond,
  solveYieldForPrice,
  macaulayDuration,
  modifiedDuration,
  convexity,
  validateBondInputs,
} from '../BondMath.js';

describe('priceNormalBond', () => {
  it('prices at par when coupon rate equals yield', () => {
    const { price } = priceNormalBond({
      faceValue: 100, couponRatePercent: 5, years: 10, PPY: 2, yieldPercent: 5, curvePoints: null,
    });
    expect(price).toBeCloseTo(100, 6);
  });

  it('prices below par at a discount and above par at a premium', () => {
    const discount = priceNormalBond({
      faceValue: 100, couponRatePercent: 5, years: 10, PPY: 1, yieldPercent: 8, curvePoints: null,
    }).price;
    const premium = priceNormalBond({
      faceValue: 100, couponRatePercent: 5, years: 10, PPY: 1, yieldPercent: 2, curvePoints: null,
    }).price;
    expect(discount).toBeLessThan(100);
    expect(premium).toBeGreaterThan(100);
  });

  it('discounts each cash flow at its own curve rate when curvePoints are given', () => {
    const curvePoints = [{ t: 1, r: 4 }, { t: 30, r: 4 }]; // flat 4% curve
    const flat = priceNormalBond({
      faceValue: 100, couponRatePercent: 5, years: 5, PPY: 1, yieldPercent: 4, curvePoints: null,
    }).price;
    const curved = priceNormalBond({
      faceValue: 100, couponRatePercent: 5, years: 5, PPY: 1, yieldPercent: 0, curvePoints,
    }).price;
    expect(curved).toBeCloseTo(flat, 6);
  });
});

describe('pricePerpetualBond', () => {
  it('matches the closed-form P = cF/lambda', () => {
    const { price } = pricePerpetualBond({ faceValue: 100, couponRatePercent: 5, yieldPercent: 5 });
    expect(price).toBeCloseTo(100, 6);
  });
});

describe('priceZeroCouponBond', () => {
  it('matches the closed-form P = F/(1+y)^years', () => {
    const { price } = priceZeroCouponBond({ faceValue: 100, years: 5, yieldPercent: 4, curvePoints: null });
    expect(price).toBeCloseTo(100 / Math.pow(1.04, 5), 6);
  });

  it('uses the curve rate at the bond maturity when curvePoints are given', () => {
    const curvePoints = [{ t: 1, r: 3 }, { t: 5, r: 6 }, { t: 10, r: 6 }];
    const { price, rate } = priceZeroCouponBond({ faceValue: 100, years: 5, yieldPercent: 0, curvePoints });
    expect(rate).toBeCloseTo(0.06, 6);
    expect(price).toBeCloseTo(100 / Math.pow(1.06, 5), 6);
  });
});

describe('solveYieldForPrice', () => {
  it('round-trips for Normal bonds across discount/par/premium and PPY', () => {
    const cases = [
      { couponRatePercent: 5, yieldPercent: 5, PPY: 1 },
      { couponRatePercent: 5, yieldPercent: 8, PPY: 1 },
      { couponRatePercent: 5, yieldPercent: 2, PPY: 2 },
      { couponRatePercent: 0, yieldPercent: 6, PPY: 4 },
    ];
    cases.forEach(({ couponRatePercent, yieldPercent, PPY }) => {
      const faceValue = 100;
      const years = 10;
      const { price } = priceNormalBond({ faceValue, couponRatePercent, years, PPY, yieldPercent, curvePoints: null });
      const solved = solveYieldForPrice({ bondType: 'Normal', faceValue, couponRatePercent, years, PPY, targetPrice: price });
      expect(solved).not.toBeNull();
      expect(solved).toBeCloseTo(yieldPercent, 4);
    });
  });

  it('round-trips for Zero-coupon bonds', () => {
    const { price } = priceZeroCouponBond({ faceValue: 100, years: 7, yieldPercent: 3.5, curvePoints: null });
    const solved = solveYieldForPrice({ bondType: 'Zero', faceValue: 100, couponRatePercent: 0, years: 7, PPY: 1, targetPrice: price });
    expect(solved).toBeCloseTo(3.5, 6);
  });

  it('matches the closed form for Perpetual bonds', () => {
    const solved = solveYieldForPrice({ bondType: 'Perpetual', faceValue: 100, couponRatePercent: 5, years: 0, PPY: 1, targetPrice: 125 });
    expect(solved).toBeCloseTo((5 * 100) / 125, 6);
  });
});

describe('duration & convexity', () => {
  it('gives a zero-coupon bond Macaulay duration exactly equal to its maturity', () => {
    const { price, cashFlows } = priceZeroCouponBond({ faceValue: 100, years: 7, yieldPercent: 4, curvePoints: null });
    expect(macaulayDuration(cashFlows, price)).toBeCloseTo(7, 9);
  });

  it('decreases as yield rises, all else equal', () => {
    const low = priceNormalBond({ faceValue: 100, couponRatePercent: 5, years: 10, PPY: 1, yieldPercent: 2, curvePoints: null });
    const high = priceNormalBond({ faceValue: 100, couponRatePercent: 5, years: 10, PPY: 1, yieldPercent: 10, curvePoints: null });
    const durLow = macaulayDuration(low.cashFlows, low.price);
    const durHigh = macaulayDuration(high.cashFlows, high.price);
    expect(durHigh).toBeLessThan(durLow);
  });

  it('modified duration is Macaulay duration discounted by one period rate', () => {
    const { price, cashFlows } = priceNormalBond({ faceValue: 100, couponRatePercent: 5, years: 10, PPY: 2, yieldPercent: 6, curvePoints: null });
    const mac = macaulayDuration(cashFlows, price);
    const mod = modifiedDuration(mac, 6, 2);
    expect(mod).toBeCloseTo(mac / (1 + 0.06 / 2), 9);
  });

  it('convexity is positive for a plain coupon bond', () => {
    const { price, cashFlows } = priceNormalBond({ faceValue: 100, couponRatePercent: 5, years: 10, PPY: 1, yieldPercent: 6, curvePoints: null });
    expect(convexity(cashFlows, price, 6, 1)).toBeGreaterThan(0);
  });
});

describe('validateBondInputs', () => {
  const base = { faceValue: 100, couponRatePercent: 5, years: 10, yieldPercent: 5, PPY: 1, Dec: 2, bondType: 'Normal', isSolvingYield: false, marketPrice: NaN };

  it('accepts a valid Normal bond', () => {
    expect(validateBondInputs(base)).toEqual([]);
  });

  it('rejects a non-positive face value', () => {
    expect(validateBondInputs({ ...base, faceValue: 0 }).length).toBeGreaterThan(0);
  });

  it('rejects non-positive years for coupon-bearing/zero bonds', () => {
    expect(validateBondInputs({ ...base, years: 0 }).length).toBeGreaterThan(0);
  });

  it('rejects PPY below 1 or non-integer', () => {
    expect(validateBondInputs({ ...base, PPY: 0 }).length).toBeGreaterThan(0);
    expect(validateBondInputs({ ...base, PPY: 1.5 }).length).toBeGreaterThan(0);
  });

  it('rejects Dec outside 0-6', () => {
    expect(validateBondInputs({ ...base, Dec: 7 }).length).toBeGreaterThan(0);
    expect(validateBondInputs({ ...base, Dec: -1 }).length).toBeGreaterThan(0);
  });

  it('rejects yield at or below -100%', () => {
    expect(validateBondInputs({ ...base, yieldPercent: -100 }).length).toBeGreaterThan(0);
  });

  it('requires a positive yield for Perpetual bonds', () => {
    expect(validateBondInputs({ ...base, bondType: 'Perpetual', yieldPercent: 0 }).length).toBeGreaterThan(0);
  });

  it('requires a positive market price when solving for yield', () => {
    expect(validateBondInputs({ ...base, isSolvingYield: true, marketPrice: 0 }).length).toBeGreaterThan(0);
    expect(validateBondInputs({ ...base, isSolvingYield: true, marketPrice: 100 })).toEqual([]);
  });
});
