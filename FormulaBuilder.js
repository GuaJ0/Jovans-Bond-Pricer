// latex
function formulaBuilder(faceValue, couponRate, years, yieldRate, PPY, Dec, bondType, targetId) {
  let latex = '';

  if (bondType === 'Normal') {
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
  } else if (bondType === 'Zero') {
    // zero coupon: P = F / (1 + lambda)^years
    latex = `
      \\[
      P = \\frac{${faceValue}}
      {\\left(${(1 + yieldRate).toFixed(Dec)}\\right)^{${years}}}
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
  const couponRate = (parseFloat(document.getElementById('couponRate' + suffix).value) || 0) / 100;
  const years = parseInt(document.getElementById('years' + suffix).value) || 1;
  const yieldRate = (parseFloat(document.getElementById('yield' + suffix).value) || 0) / 100;
  const PPY = parseInt(document.getElementById('PPY' + suffix).value) || 1;
  const Dec = parseInt(document.getElementById('Dec' + suffix).value) || 2;
  const bondType = document.querySelector('input[name="bondType' + suffix + '"]:checked').value;

  const targetId = suffix === 'A' ? 'formulaA' : 'formulaB';
  formulaBuilder(faceValue, couponRate, years, yieldRate, PPY, Dec, bondType, targetId);
}
