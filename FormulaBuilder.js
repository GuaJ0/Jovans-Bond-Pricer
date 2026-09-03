// latex
function formulaBuilder(faceValue, couponRate, years, yieldRate, PPY, Dec, bondType, targetId, useCurve, curvePoints, isSolvingYield, accruedInfo) {
  let latex = '';

  if (bondType === 'Normal' && useCurve) {
    // discounted at each cash flow's own curve rate instead of a flat yield
    const nodes = curvePoints.map((p) => `${p.t}\\text{y}=${p.r.toFixed(Dec)}\\%`).join(',\\ ');
    latex = `
      \\[
      P = \\sum_{i=1}^{${years} \\times ${PPY}}
      \\frac{${(couponRate * faceValue).toFixed(Dec)}/${PPY}}
      {\\left(1 + \\frac{r(t_i)}{${PPY}}\\right)^i}
      + \\frac{${faceValue}}
      {\\left(1 + \\frac{r(${years})}{${PPY}}\\right)^{${years} \\times ${PPY}}}
      \\]
      \\[
      r(t) \\text{ interpolated from curve: } ${nodes}
      \\]
    `;
  } else if (bondType === 'Normal') {
    // normal coupon bond
    latex = `
      \\[
      P = \\sum_{i=1}^{${years} \\times ${PPY}}
      \\frac{${(couponRate * faceValue).toFixed(Dec)}/${PPY}}
      {\\left(1 + \\frac{${yieldRate.toFixed(Dec)}}{${PPY}}\\right)^i}
      + \\frac{${faceValue}}
      {\\left(1 + \\frac{${yieldRate.toFixed(Dec)}}{${PPY}}\\right)^{${years} \\times ${PPY}}}
      \\]
    `;
  } else if (bondType === 'Perpetual') {
    // perpetual: P = cF / lambda
    latex = `
      \\[
      P = \\frac{cF}{\\lambda}
      = \\frac{${couponRate.toFixed(Dec)} \\times ${faceValue}}
      {${yieldRate.toFixed(Dec)}}
      \\]
    `;
  } else if (bondType === 'Zero' && useCurve) {
    const curveRate = interpolateCurve(curvePoints, years) / 100;
    latex = `
      \\[
      P = \\frac{${faceValue}}
      {\\left(1 + r(${years})\\right)^{${years}}}
      = \\frac{${faceValue}}
      {\\left(${(1 + curveRate).toFixed(Dec)}\\right)^{${years}}}
      \\]
    `;
  } else if (bondType === 'Zero') {
    // zero coupon: P = F / (1 + lambda)^years
    latex = `
      \\[
      P = \\frac{${faceValue}}
      {\\left(${(1 + yieldRate).toFixed(Dec)}\\right)^{${years}}}
      \\]
    `;
  }

  if (isSolvingYield) {
    latex += `
      \\[
      \\text{yield solved from market price via } P(\\lambda) = \\text{target price}
      \\]
    `;
  }

  if (accruedInfo) {
    latex += `
      \\[
      \\text{Dirty Price} = \\text{Clean Price} + \\text{Accrued Interest}
      = ${accruedInfo.clean.toFixed(Dec)} + ${accruedInfo.accrued.toFixed(Dec)}
      = ${accruedInfo.dirty.toFixed(Dec)}
      \\]
    `;
  }

  const el = document.getElementById(targetId);
  if (!el) return;

  el.innerHTML = latex;
  if (window.MathJax && MathJax.typesetPromise) {
    MathJax.typesetPromise([el]);
  }
}

// Update formula
function updateFormulaFromInputs(suffix) {
  const faceValue = parseFloat(document.getElementById('faceValue' + suffix).value) || 100;
  const couponRatePercent = parseFloat(document.getElementById('couponRate' + suffix).value) || 0;
  const couponRate = couponRatePercent / 100;
  const years = parseFloat(document.getElementById('years' + suffix).value) || 1;
  const yieldPercent = parseFloat(document.getElementById('yield' + suffix).value) || 0;
  const yieldRate = yieldPercent / 100;
  const PPY = parseInt(document.getElementById('PPY' + suffix).value) || 1;
  const Dec = parseInt(document.getElementById('Dec' + suffix).value) || 2;
  const bondType = document.querySelector('input[name="bondType' + suffix + '"]:checked').value;
  const useCurve = bondType !== 'Perpetual' &&
    document.getElementById('useCurve' + suffix)?.checked;
  const curvePoints = useCurve ? getCurvePoints() : null;
  const isSolvingYield = document.getElementById('solveYield' + suffix)?.checked;

  let accruedInfo = null;
  if (bondType === 'Normal' && !useCurve) {
    const periodElapsedPercent = parseFloat(document.getElementById('periodElapsed' + suffix).value) || 0;
    if (periodElapsedPercent > 0) {
      const priced = priceNormalBond({ faceValue, couponRatePercent, years, PPY, yieldPercent, curvePoints: null });
      const accrued = accruedInterest({ coupon: priced.coupon, fractionOfPeriodElapsed: periodElapsedPercent / 100 });
      accruedInfo = { clean: priced.price, accrued, dirty: dirtyPrice(priced.price, accrued) };
    }
  }

  const targetId = suffix === 'A' ? 'formulaA' : 'formulaB';
  formulaBuilder(faceValue, couponRate, years, yieldRate, PPY, Dec, bondType, targetId, useCurve, curvePoints, isSolvingYield, accruedInfo);
}
