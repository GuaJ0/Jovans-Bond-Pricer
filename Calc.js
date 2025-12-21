// price calculator 
function calculateBond(idSuffix) {
  const faceValue = parseFloat(document.getElementById('faceValue' + idSuffix).value);
  const PPY = parseInt(document.getElementById('PPY' + idSuffix).value);
  const couponRatePercent = parseFloat(document.getElementById('couponRate' + idSuffix).value);
  const years = parseInt(document.getElementById('years' + idSuffix).value);
  const yieldPercent = parseFloat(document.getElementById('yield' + idSuffix).value);
  const Dec = parseInt(document.getElementById('Dec' + idSuffix).value);
  const bondType = document.querySelector('input[name="bondType' + idSuffix + '"]:checked').value;

  const coupon = faceValue * couponRatePercent / (100 * PPY);
  const totalPayments = years * PPY;
  const effective = yieldPercent / (100 * PPY); 

  let price = 0;

  if (bondType === 'Normal') {
    // normal coupon bond
    for (let i = 1; i <= totalPayments; i++) {
      price += coupon / Math.pow(1 + effective, i);
    }
    price += faceValue / Math.pow(1 + effective, totalPayments);

    document.getElementById('effective' + idSuffix).textContent =
      (effective * 100).toFixed(Dec) + '%';
    document.getElementById('totalPayments' + idSuffix).textContent = totalPayments;
    document.getElementById('coupon' + idSuffix).textContent =
      '$' + coupon.toFixed(Dec);

  } else if (bondType === 'Perpetual') {
    // P = cF / lambda 
    const lambda = yieldPercent;
    const c = couponRatePercent;

    price = lambda === 0 ? Infinity : (c * faceValue) / (lambda);

    document.getElementById('effective' + idSuffix).textContent = 'N/A';
    document.getElementById('totalPayments' + idSuffix).textContent = '∞';
    document.getElementById('coupon' + idSuffix).textContent =
      '$' + (c * faceValue).toFixed(Dec);

  } else if (bondType === 'Zero') {
    // P = F / (1 + lambda)^years
    const lambda = yieldPercent / 100;
    price = faceValue / Math.pow(1 + lambda, years);

    document.getElementById('effective' + idSuffix).textContent =
      (lambda * 100).toFixed(Dec) + '%';
    document.getElementById('totalPayments' + idSuffix).textContent = '1';
    document.getElementById('coupon' + idSuffix).textContent = '$0';
  }

  document.getElementById('bondPrice' + idSuffix).textContent =
    isFinite(price) ? '$' + price.toFixed(Dec) : '∞';

  return price;
}

// recalculate + update formulas
function updateAll() {
  const priceA = calculateBond('A');
  const priceB = calculateBond('B');
  const Dec = parseInt(document.getElementById('DecA').value) || 2;

  if (isFinite(priceA) && isFinite(priceB)) {
    const diff = priceA - priceB;
    document.getElementById('priceDiff').textContent =
      '$' + diff.toFixed(Dec);
  } else {
    document.getElementById('priceDiff').textContent = 'N/A';
  }

  updateFormulaFromInputs('A');
  updateFormulaFromInputs('B');
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

  document.querySelector('input[name="bondTypeA"][value="Normal"]').checked = true;

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

  document.querySelector('input[name="bondTypeB"][value="Normal"]').checked = true;

  updateAll();
}

window.onload = function () {
  // sliders for A
  bindSlider('faceValue', 'faceValueSlider', 'A');
  bindSlider('couponRate', 'couponRateSlider', 'A');
  bindSlider('years', 'yearsSlider', 'A');
  bindSlider('yield', 'yieldSlider', 'A');
  bindSlider('PPY', 'PPYSlider', 'A');

  // sliders for B
  bindSlider('faceValue', 'faceValueSlider', 'B');
  bindSlider('couponRate', 'couponRateSlider', 'B');
  bindSlider('years', 'yearsSlider', 'B');
  bindSlider('yield', 'yieldSlider', 'B');
  bindSlider('PPY', 'PPYSlider', 'B');

  // recalc when any field changes
  document.getElementById('bondFormA').addEventListener('input', updateAll);
  document.getElementById('bondFormB').addEventListener('input', updateAll);

  // reset buttons
  document.getElementById('resetA').addEventListener('click', resetBondA);
  document.getElementById('resetB').addEventListener('click', resetBondB);

  updateAll();
};
