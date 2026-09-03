// DOM glue: reads inputs, validates, delegates math to BondMath.js / Curve.js,
// writes results back to the page. No pricing math lives in this file.

const URL_NUMBER_FIELDS = ['faceValue', 'couponRate', 'years', 'yield', 'PPY', 'Dec', 'periodElapsed', 'marketPrice'];
const URL_CHECKBOX_FIELDS = ['useCurve', 'solveYield'];
const URL_SLIDER_PAIRS = ['faceValue', 'couponRate', 'years', 'yield', 'PPY', 'periodElapsed'];

function readBondInputs(idSuffix) {
  return {
    faceValue: parseFloat(document.getElementById('faceValue' + idSuffix).value),
    PPY: parseInt(document.getElementById('PPY' + idSuffix).value, 10),
    couponRatePercent: parseFloat(document.getElementById('couponRate' + idSuffix).value),
    years: parseFloat(document.getElementById('years' + idSuffix).value),
    yieldPercent: parseFloat(document.getElementById('yield' + idSuffix).value),
    Dec: parseInt(document.getElementById('Dec' + idSuffix).value, 10),
    bondType: document.querySelector('input[name="bondType' + idSuffix + '"]:checked').value,
    isSolvingYield: document.getElementById('solveYield' + idSuffix).checked,
    marketPrice: parseFloat(document.getElementById('marketPrice' + idSuffix).value),
    useCurve: document.getElementById('useCurve' + idSuffix).checked,
    periodElapsedPercent: parseFloat(document.getElementById('periodElapsed' + idSuffix).value),
  };
}

function clearBondOutputs(idSuffix) {
  ['bondPrice', 'effective', 'coupon', 'totalPayments', 'macDuration', 'modDuration', 'convexity', 'accrued', 'dirtyPrice']
    .forEach((key) => {
      const el = document.getElementById(key + idSuffix);
      if (el) el.textContent = '—';
    });
  const tbody = document.querySelector('#schedule' + idSuffix + ' tbody');
  if (tbody) tbody.innerHTML = '';
}

function renderSchedule(idSuffix, cashFlows, Dec) {
  const tbody = document.querySelector('#schedule' + idSuffix + ' tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  cashFlows.forEach((cf) => {
    const tr = document.createElement('tr');
    tr.innerHTML =
      '<td>' + cf.period + '</td>' +
      '<td>' + cf.t.toFixed(2) + '</td>' +
      '<td>$' + cf.amount.toFixed(Dec) + '</td>' +
      '<td>' + cf.discountFactor.toFixed(4) + '</td>' +
      '<td>$' + cf.pv.toFixed(Dec) + '</td>';
    tbody.appendChild(tr);
  });
}

// price calculator
function calculateBond(idSuffix) {
  const inputs = readBondInputs(idSuffix);
  const { faceValue, PPY, couponRatePercent, years, Dec, bondType, isSolvingYield, marketPrice, useCurve, periodElapsedPercent } = inputs;
  let yieldPercent = inputs.yieldPercent;

  const errorsEl = document.getElementById('errors' + idSuffix);
  const errors = validateBondInputs({ faceValue, couponRatePercent, years, yieldPercent, PPY, Dec, bondType, isSolvingYield, marketPrice });

  if (errors.length) {
    errorsEl.textContent = errors.join(' ');
    clearBondOutputs(idSuffix);
    return NaN;
  }

  const curvePoints = (useCurve && bondType !== 'Perpetual') ? getCurvePoints() : null;

  if (isSolvingYield) {
    const solved = solveYieldForPrice({ bondType, faceValue, couponRatePercent, years, PPY, targetPrice: marketPrice });
    if (solved == null) {
      errorsEl.textContent = 'Could not solve for a yield that reproduces this market price.';
      clearBondOutputs(idSuffix);
      return NaN;
    }
    yieldPercent = solved;
    document.getElementById('yield' + idSuffix).value = solved.toFixed(Dec);
    const slider = document.getElementById('yieldSlider' + idSuffix);
    if (slider) slider.value = Math.min(20, Math.max(0, solved));
  }

  errorsEl.textContent = '';

  let result;
  if (bondType === 'Normal') {
    result = priceNormalBond({ faceValue, couponRatePercent, years, PPY, yieldPercent, curvePoints });
  } else if (bondType === 'Perpetual') {
    result = pricePerpetualBond({ faceValue, couponRatePercent, yieldPercent });
    result.cashFlows = [];
  } else {
    result = priceZeroCouponBond({ faceValue, years, yieldPercent, curvePoints });
  }

  const { price, cashFlows } = result;
  const curveNote = curvePoints ? ' (curve @ ' + years + 'y)' : '';
  const solvedNote = isSolvingYield ? ' (solved)' : '';

  let effectiveLabel;
  if (bondType === 'Normal') {
    const finalCF = cashFlows[cashFlows.length - 1];
    const annualRate = finalCF.rate * PPY * 100;
    effectiveLabel = annualRate.toFixed(Dec) + '%' + curveNote + solvedNote;
  } else if (bondType === 'Zero') {
    effectiveLabel = (result.rate * 100).toFixed(Dec) + '%' + curveNote + solvedNote;
  } else {
    effectiveLabel = isSolvingYield ? yieldPercent.toFixed(Dec) + '%' + solvedNote : 'N/A';
  }
  document.getElementById('effective' + idSuffix).textContent = effectiveLabel;

  document.getElementById('totalPayments' + idSuffix).textContent =
    bondType === 'Normal' ? cashFlows.length : bondType === 'Zero' ? '1' : '∞';

  document.getElementById('coupon' + idSuffix).textContent =
    bondType === 'Zero' ? '$0' : '$' + result.coupon.toFixed(Dec);

  document.getElementById('bondPrice' + idSuffix).textContent =
    isFinite(price) ? '$' + price.toFixed(Dec) : '∞';

  // duration & convexity
  let macDur = null;
  let modDur = null;
  let conv = null;
  if (bondType === 'Normal' || bondType === 'Zero') {
    macDur = macaulayDuration(cashFlows, price);
    const periodsForMod = bondType === 'Zero' ? 1 : PPY;
    const impliedYieldPercent = bondType === 'Zero'
      ? result.rate * 100
      : (curvePoints
          ? (solveYieldForPrice({ bondType: 'Normal', faceValue, couponRatePercent, years, PPY, targetPrice: price }) ?? yieldPercent)
          : yieldPercent);
    modDur = modifiedDuration(macDur, impliedYieldPercent, periodsForMod);
    conv = convexity(cashFlows, price, impliedYieldPercent, periodsForMod);
  } else {
    macDur = perpetualMacaulayDuration(yieldPercent);
    modDur = perpetualModifiedDuration(yieldPercent);
    conv = perpetualConvexity(yieldPercent);
  }

  document.getElementById('macDuration' + idSuffix).textContent = macDur != null ? macDur.toFixed(Dec) + ' yrs' : 'N/A';
  document.getElementById('modDuration' + idSuffix).textContent = modDur != null ? modDur.toFixed(Dec) + ' yrs' : 'N/A';
  document.getElementById('convexity' + idSuffix).textContent = conv != null ? conv.toFixed(Dec) : 'N/A';

  // accrued interest / dirty price — coupon-bond concept, Normal bonds only
  let accrued = null;
  let dirty = null;
  if (bondType === 'Normal') {
    accrued = accruedInterest({ coupon: result.coupon, fractionOfPeriodElapsed: periodElapsedPercent / 100 });
    dirty = dirtyPrice(price, accrued);
  }
  document.getElementById('accrued' + idSuffix).textContent = accrued != null ? '$' + accrued.toFixed(Dec) : 'N/A';
  document.getElementById('dirtyPrice' + idSuffix).textContent = dirty != null && isFinite(dirty) ? '$' + dirty.toFixed(Dec) : 'N/A';

  renderSchedule(idSuffix, cashFlows, Dec);

  return price;
}

// recalculate + update formulas
function updateAll() {
  const priceA = calculateBond('A');
  const priceB = calculateBond('B');
  const Dec = parseInt(document.getElementById('DecA').value, 10) || 2;

  if (isFinite(priceA) && isFinite(priceB)) {
    const diff = priceA - priceB;
    document.getElementById('priceDiff').textContent = '$' + diff.toFixed(Dec);
  } else {
    document.getElementById('priceDiff').textContent = 'N/A';
  }

  updateFormulaFromInputs('A');
  updateFormulaFromInputs('B');

  syncURL();
}

// number input and slider
function bindSlider(numberIdBase, sliderIdBase, suffix) {
  const num = document.getElementById(numberIdBase + suffix);
  const slider = document.getElementById(sliderIdBase + suffix);

  if (!num || !slider) return;

  slider.addEventListener('input', function () {
    num.value = this.value;
    updateAll();
  });

  num.addEventListener('input', function () {
    slider.value = this.value;
    updateAll();
  });
}

// coordinates the bond-type radios, "use yield curve" checkbox and
// "solve for yield from market price" checkbox, which all interact:
// - Perpetual bonds can't use the curve (no single well-defined maturity)
// - solving for yield needs a single flat yield, so it excludes the curve
// - accrued interest / dirty price only apply to Normal (coupon) bonds
function bindYieldModeControls(suffix) {
  const bondTypeRadios = document.querySelectorAll('input[name="bondType' + suffix + '"]');
  const useCurveCheckbox = document.getElementById('useCurve' + suffix);
  const solveYieldCheckbox = document.getElementById('solveYield' + suffix);
  const yieldField = document.getElementById('yieldField' + suffix);
  const marketPriceField = document.getElementById('marketPriceField' + suffix);
  const accruedField = document.getElementById('accruedField' + suffix);

  function syncCurveAvailability() {
    const bondType = document.querySelector('input[name="bondType' + suffix + '"]:checked').value;
    if (bondType === 'Perpetual') {
      useCurveCheckbox.checked = false;
      useCurveCheckbox.disabled = true;
    } else {
      useCurveCheckbox.disabled = false;
    }
    accruedField.hidden = bondType !== 'Normal';
  }

  function syncYieldFields() {
    const solving = solveYieldCheckbox.checked;
    yieldField.hidden = solving;
    marketPriceField.hidden = !solving;
    if (solving) useCurveCheckbox.checked = false;
  }

  bondTypeRadios.forEach((r) => r.addEventListener('change', function () {
    syncCurveAvailability();
    updateAll();
  }));

  solveYieldCheckbox.addEventListener('change', function () {
    syncYieldFields();
    updateAll();
  });

  useCurveCheckbox.addEventListener('change', function () {
    if (useCurveCheckbox.checked) {
      solveYieldCheckbox.checked = false;
      syncYieldFields();
    }
    updateAll();
  });

  syncCurveAvailability();
  syncYieldFields();
}

function resetBondA() {
  document.getElementById('faceValueA').value = 100;
  document.getElementById('faceValueSliderA').value = 100;

  document.getElementById('couponRateA').value = 10;
  document.getElementById('couponRateSliderA').value = 10;

  document.getElementById('yearsA').value = 10;
  document.getElementById('yearsSliderA').value = 10;

  document.getElementById('yieldA').value = 1;
  document.getElementById('yieldSliderA').value = 1;

  document.getElementById('PPYA').value = 1;
  document.getElementById('PPYSliderA').value = 1;

  document.getElementById('DecA').value = 2;

  document.getElementById('periodElapsedA').value = 0;
  document.getElementById('periodElapsedSliderA').value = 0;

  document.getElementById('marketPriceA').value = 100;
  document.getElementById('solveYieldA').checked = false;
  document.getElementById('yieldFieldA').hidden = false;
  document.getElementById('marketPriceFieldA').hidden = true;

  document.querySelector('input[name="bondTypeA"][value="Normal"]').checked = true;
  document.getElementById('useCurveA').checked = false;
  document.getElementById('useCurveA').disabled = false;
  document.getElementById('accruedFieldA').hidden = false;
  document.getElementById('errorsA').textContent = '';

  updateAll();
}

function resetBondB() {
  document.getElementById('faceValueB').value = 100;
  document.getElementById('faceValueSliderB').value = 100;

  document.getElementById('couponRateB').value = 5;
  document.getElementById('couponRateSliderB').value = 5;

  document.getElementById('yearsB').value = 10;
  document.getElementById('yearsSliderB').value = 10;

  document.getElementById('yieldB').value = 2;
  document.getElementById('yieldSliderB').value = 2;

  document.getElementById('PPYB').value = 1;
  document.getElementById('PPYSliderB').value = 1;

  document.getElementById('DecB').value = 2;

  document.getElementById('periodElapsedB').value = 0;
  document.getElementById('periodElapsedSliderB').value = 0;

  document.getElementById('marketPriceB').value = 100;
  document.getElementById('solveYieldB').checked = false;
  document.getElementById('yieldFieldB').hidden = false;
  document.getElementById('marketPriceFieldB').hidden = true;

  document.querySelector('input[name="bondTypeB"][value="Normal"]').checked = true;
  document.getElementById('useCurveB').checked = false;
  document.getElementById('useCurveB').disabled = false;
  document.getElementById('accruedFieldB').hidden = false;
  document.getElementById('errorsB').textContent = '';

  updateAll();
}

// shareable scenario via URL query params
function syncURL() {
  const params = new URLSearchParams();
  ['A', 'B'].forEach((suffix) => {
    URL_NUMBER_FIELDS.forEach((field) => {
      const el = document.getElementById(field + suffix);
      if (el) params.set(field + suffix, el.value);
    });
    URL_CHECKBOX_FIELDS.forEach((field) => {
      const el = document.getElementById(field + suffix);
      if (el) params.set(field + suffix, el.checked ? '1' : '0');
    });
    const bondType = document.querySelector('input[name="bondType' + suffix + '"]:checked');
    if (bondType) params.set('bondType' + suffix, bondType.value);
  });
  CURVE_MATURITIES.forEach((t) => {
    const el = document.getElementById('curveRate' + t);
    if (el) params.set('curveRate' + t, el.value);
  });
  const newUrl = window.location.pathname + '?' + params.toString();
  window.history.replaceState(null, '', newUrl);
}

function hydrateFromURL() {
  const params = new URLSearchParams(window.location.search);
  if (![...params.keys()].length) return;

  ['A', 'B'].forEach((suffix) => {
    URL_NUMBER_FIELDS.forEach((field) => {
      const el = document.getElementById(field + suffix);
      if (el && params.has(field + suffix)) el.value = params.get(field + suffix);
    });
    URL_CHECKBOX_FIELDS.forEach((field) => {
      const el = document.getElementById(field + suffix);
      if (el && params.has(field + suffix)) el.checked = params.get(field + suffix) === '1';
    });
    const bondTypeValue = params.get('bondType' + suffix);
    if (bondTypeValue) {
      const radio = document.querySelector('input[name="bondType' + suffix + '"][value="' + bondTypeValue + '"]');
      if (radio) radio.checked = true;
    }
    URL_SLIDER_PAIRS.forEach((field) => {
      const num = document.getElementById(field + suffix);
      const slider = document.getElementById(field + 'Slider' + suffix);
      if (num && slider) slider.value = num.value;
    });
    const yieldField = document.getElementById('yieldField' + suffix);
    const marketPriceField = document.getElementById('marketPriceField' + suffix);
    const solving = document.getElementById('solveYield' + suffix).checked;
    if (yieldField) yieldField.hidden = solving;
    if (marketPriceField) marketPriceField.hidden = !solving;
    const accruedField = document.getElementById('accruedField' + suffix);
    if (accruedField) {
      const bondType = document.querySelector('input[name="bondType' + suffix + '"]:checked').value;
      accruedField.hidden = bondType !== 'Normal';
    }
  });

  CURVE_MATURITIES.forEach((t) => {
    const el = document.getElementById('curveRate' + t);
    if (el && params.has('curveRate' + t)) el.value = params.get('curveRate' + t);
  });
}

function bindCopyLink() {
  const btn = document.getElementById('copyLink');
  if (!btn) return;
  btn.addEventListener('click', async function () {
    syncURL();
    const original = btn.textContent;
    try {
      await navigator.clipboard.writeText(window.location.href);
      btn.textContent = 'Link Copied!';
    } catch (e) {
      window.prompt('Copy this link:', window.location.href);
    }
    setTimeout(() => { btn.textContent = original; }, 1500);
  });
}

// theme toggle — a tiny inline script in <head> already applies the saved
// theme before first paint; this just wires the button
function bindThemeToggle() {
  const btn = document.getElementById('themeToggle');
  if (!btn) return;
  btn.addEventListener('click', function () {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('bondPricerTheme', next); } catch (e) {}
    drawCurveChart();
  });
}

window.onload = function () {
  hydrateFromURL();

  // sliders for A
  bindSlider('faceValue', 'faceValueSlider', 'A');
  bindSlider('couponRate', 'couponRateSlider', 'A');
  bindSlider('years', 'yearsSlider', 'A');
  bindSlider('yield', 'yieldSlider', 'A');
  bindSlider('PPY', 'PPYSlider', 'A');
  bindSlider('periodElapsed', 'periodElapsedSlider', 'A');

  // sliders for B
  bindSlider('faceValue', 'faceValueSlider', 'B');
  bindSlider('couponRate', 'couponRateSlider', 'B');
  bindSlider('years', 'yearsSlider', 'B');
  bindSlider('yield', 'yieldSlider', 'B');
  bindSlider('PPY', 'PPYSlider', 'B');
  bindSlider('periodElapsed', 'periodElapsedSlider', 'B');

  // recalc when any field changes
  document.getElementById('bondFormA').addEventListener('input', updateAll);
  document.getElementById('bondFormB').addEventListener('input', updateAll);

  // reset buttons
  document.getElementById('resetA').addEventListener('click', resetBondA);
  document.getElementById('resetB').addEventListener('click', resetBondB);

  // yield curve panel + per-bond curve/solve-yield/perpetual interplay
  bindCurveControls();
  bindYieldModeControls('A');
  bindYieldModeControls('B');

  bindCopyLink();
  bindThemeToggle();

  updateAll();
};
