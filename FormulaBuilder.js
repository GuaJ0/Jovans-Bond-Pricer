function formulaBuilder(faceValue, couponRate, years, yieldRate, PPY, Dec, bondType){
  let latex = '';

  if (bondType === 'Normal') {
    // normal coupon bond
    latex = `
      \\[ P = \\sum_{i=1}^{${years} \\times ${PPY}}
      \\frac{${(couponRate * faceValue).toFixed(Dec)}/${PPY}}
      {\\left(1 + \\frac{${(yieldRate).toFixed(Dec)}}{${PPY}}\\right)^i}
      + \\frac{${faceValue}}
      {\\left(1 + \\frac{${(yieldRate).toFixed(Dec)}}{${PPY}}\\right)^{${years} \\times ${PPY}}} \\]`;
  } 
  else if (bondType === 'Perpetual') {    // continuous coupon: P = cF/lambda
    latex = `\\[ P = \\frac{${couponRate.toFixed(Dec)} \\times ${faceValue}}{${yieldRate.toFixed(Dec)}}\\]`;
  } 
  else if (bondType === 'Zero') {    // zero coupon: P = F / (1 + lambda)^{years}
  latex = `\\[
  P = \\frac{${faceValue}}
  {\\left(${(1+yieldRate).toFixed(Dec)}\\right)^{${years}}}
  \\]`;
  }

  document.getElementById('formula').innerHTML = latex;
  if (window.MathJax) {
    MathJax.typesetPromise();
  }
}

function updateFormulaFromInputs() {
  const faceValue = parseFloat(document.getElementById('faceValue').value) || 100;
  const couponRate = (parseFloat(document.getElementById('couponRate').value) || 0) / 100;
  const years = parseInt(document.getElementById('years').value) || 1;
  const yieldRate = (parseFloat(document.getElementById('yield').value) || 0) / 100;
  const PPY = parseInt(document.getElementById('PPY').value) || 1;
  const Dec = parseInt(document.getElementById('Dec').value) || 2;
  const bondType = document.querySelector('input[name="bondType"]:checked').value;

  formulaBuilder(faceValue, couponRate, years, yieldRate, PPY, Dec, bondType);
}


