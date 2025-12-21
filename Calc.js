function updatePrice() {
    let price = 0;
    const faceValue = parseFloat(document.getElementById('faceValue').value); // F
    const PPY = parseInt(document.getElementById('PPY').value) ; // m
    const coupon = faceValue * parseFloat(document.getElementById('couponRate').value) / (100 * PPY) ; // cF/m
    const totalPayments = parseInt(document.getElementById('years').value) * PPY ; // n * m
    const effective = parseFloat(document.getElementById('yield').value) / (100 * PPY); // lamda / m 
    const Dec = document.getElementById('Dec').value;
    const bondType = document.querySelector('input[name="bondType"]:checked').value; 


    if (bondType === 'Normal') {
    for (let i = 1; i <= totalPayments; i++) {
      price += coupon / Math.pow(1 + effective, i);
    }
    price += faceValue / Math.pow(1 + effective, totalPayments); 
    document.getElementById('effective').textContent = (effective*100).toFixed(Dec) +'%';
    document.getElementById('totalPayments').textContent = totalPayments;
    document.getElementById('coupon').textContent = '$' + coupon.toFixed(Dec);
    } 
    
    else if (bondType === 'Perpetual') {
    // P = cF/lamda
    price = coupon /(10000 * effective);
    document.getElementById('effective').textContent = 'N/A';
    document.getElementById('totalPayments').textContent = '∞';
    document.getElementById('coupon').textContent = '$' + (PPY).toFixed(Dec);
    } 

    else if (bondType === 'Zero') {
    // P = F / (1 + lamda)^years
    price = faceValue / Math.pow(1 + effective*PPY, totalPayments/PPY);
    document.getElementById('effective').textContent = (effective*100).toFixed(Dec) + '%';
    document.getElementById('totalPayments').textContent = '1';
    document.getElementById('coupon').textContent = '$' + '0';

    }

    
    document.getElementById('bondPrice').textContent = '$' + price.toFixed(Dec);
    }

    document.getElementById('bondForm').addEventListener('input', function () {
    updatePrice();
    updateFormulaFromInputs();
    });

    window.onload = function () {
    updatePrice();
    updateFormulaFromInputs();
    };