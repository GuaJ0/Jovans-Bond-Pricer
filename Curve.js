// yield curve: node maturities, interpolation, presets, chart rendering
const CURVE_MATURITIES = [1, 2, 5, 10, 30];

const CURVE_PRESETS = {
  Normal:   [3, 3.5, 4, 4.2, 4.5],
  Flat:     [4, 4, 4, 4, 4],
  Inverted: [5, 4.6, 4.2, 3.8, 3.5],
};

// read current curve nodes as [{t, r}] sorted by maturity, r in percent
function getCurvePoints() {
  return CURVE_MATURITIES.map((t) => ({
    t,
    r: parseFloat(document.getElementById('curveRate' + t).value) || 0,
  }));
}

// linear interpolation between nodes, flat extrapolation past the ends
// t in years, returns a rate in percent
function interpolateCurve(points, t) {
  if (t <= points[0].t) return points[0].r;
  if (t >= points[points.length - 1].t) return points[points.length - 1].r;

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (t >= a.t && t <= b.t) {
      const frac = (t - a.t) / (b.t - a.t);
      return a.r + frac * (b.r - a.r);
    }
  }
  return points[points.length - 1].r;
}

function applyCurvePreset(name) {
  const rates = CURVE_PRESETS[name];
  if (!rates) return;
  CURVE_MATURITIES.forEach((t, i) => {
    document.getElementById('curveRate' + t).value = rates[i];
  });
}

function drawCurveChart() {
  const canvas = document.getElementById('curveChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const points = getCurvePoints();

  const W = canvas.width;
  const H = canvas.height;
  const padL = 45;
  const padR = 20;
  const padT = 15;
  const padB = 30;

  ctx.clearRect(0, 0, W, H);

  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  const colors = isLight
    ? { axis: '#999', grid: '#ddd', tickText: '#555', line: '#2563eb', nodeLabel: '#333' }
    : { axis: '#444', grid: '#2a2a2a', tickText: '#aaa', line: '#4ea1ff', nodeLabel: '#ccc' };

  const maxT = points[points.length - 1].t;
  const rates = points.map((p) => p.r);
  const minR = Math.min(0, ...rates);
  const maxR = Math.max(...rates) * 1.15 || 1;

  const x = (t) => padL + (t / maxT) * (W - padL - padR);
  const y = (r) => H - padB - ((r - minR) / (maxR - minR)) * (H - padT - padB);

  // axes
  ctx.strokeStyle = colors.axis;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padL, padT);
  ctx.lineTo(padL, H - padB);
  ctx.lineTo(W - padR, H - padB);
  ctx.stroke();

  // y-axis ticks (rate %)
  ctx.fillStyle = colors.tickText;
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  const ticks = 4;
  for (let i = 0; i <= ticks; i++) {
    const r = minR + ((maxR - minR) * i) / ticks;
    const yy = y(r);
    ctx.strokeStyle = colors.grid;
    ctx.beginPath();
    ctx.moveTo(padL, yy);
    ctx.lineTo(W - padR, yy);
    ctx.stroke();
    ctx.fillText(r.toFixed(1) + '%', padL - 6, yy);
  }

  // curve line
  ctx.strokeStyle = colors.line;
  ctx.lineWidth = 2;
  ctx.beginPath();
  points.forEach((p, i) => {
    const px = x(p.t);
    const py = y(p.r);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.stroke();

  // node dots + labels
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  points.forEach((p) => {
    const px = x(p.t);
    const py = y(p.r);
    ctx.fillStyle = colors.line;
    ctx.beginPath();
    ctx.arc(px, py, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = colors.nodeLabel;
    ctx.fillText(p.t + 'y', px, H - padB + 6);
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { interpolateCurve, CURVE_MATURITIES, CURVE_PRESETS };
}

function bindCurveControls() {
  CURVE_MATURITIES.forEach((t) => {
    const el = document.getElementById('curveRate' + t);
    if (!el) return;
    el.addEventListener('input', function () {
      drawCurveChart();
      if (typeof updateAll === 'function') updateAll();
    });
  });

  const presetButtons = {
    curvePresetNormal: 'Normal',
    curvePresetFlat: 'Flat',
    curvePresetInverted: 'Inverted',
  };
  Object.entries(presetButtons).forEach(([id, presetName]) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.addEventListener('click', function () {
      applyCurvePreset(presetName);
      drawCurveChart();
      if (typeof updateAll === 'function') updateAll();
    });
  });

  drawCurveChart();
}
