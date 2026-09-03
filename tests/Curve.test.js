import { describe, it, expect } from 'vitest';
import { interpolateCurve } from '../Curve.js';

const points = [
  { t: 1, r: 3 },
  { t: 2, r: 3.5 },
  { t: 5, r: 4 },
  { t: 10, r: 4.2 },
  { t: 30, r: 4.5 },
];

describe('interpolateCurve', () => {
  it('returns the exact rate at each node', () => {
    points.forEach((p) => {
      expect(interpolateCurve(points, p.t)).toBeCloseTo(p.r, 9);
    });
  });

  it('linearly interpolates between two nodes', () => {
    // midpoint between 5y@4% and 10y@4.2%
    expect(interpolateCurve(points, 7.5)).toBeCloseTo(4.1, 9);
  });

  it('flat-extrapolates below the first node', () => {
    expect(interpolateCurve(points, 0)).toBeCloseTo(3, 9);
  });

  it('flat-extrapolates beyond the last node', () => {
    expect(interpolateCurve(points, 50)).toBeCloseTo(4.5, 9);
  });
});
