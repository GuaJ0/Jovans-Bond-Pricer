# Jovans Bond Pricer
A web-based bond pricing tool that calculates the price of normal coupon, perpetual and zero‑coupon bonds, with side‑by‑side comparison between two bonds, a yield curve, a yield-to-maturity solver, duration/convexity, and accrued interest.
The app is a dependency-free static site — open `index.html` directly, no build step required. Node/npm is only needed if you want to run the test suite.

![Defalt page](Bond_Pricer_Screenshot2.png)

**Live demo:** _add your GitHub Pages URL here once deployed (see Deployment below)_

[![Tests](https://github.com/GuaJ0/Jovans-Bond-Pricer/actions/workflows/test.yml/badge.svg)](https://github.com/GuaJ0/Jovans-Bond-Pricer/actions/workflows/test.yml)

## Features

- Three bond types
	- Normal coupon bond
	- Perpetual bond
	- Zero‑coupon bond
- Two‑bond comparison
	- Independent input panel for Bond A and Bond B
	- Real‑time updates of prices
- Yield curve
	- Editable term structure (1y/2y/5y/10y/30y nodes) with Normal/Flat/Inverted presets
	- Linear interpolation between nodes for any maturity
	- Per‑bond toggle to discount Normal and Zero‑coupon cash flows off the curve instead of a flat yield
	- Canvas chart of the curve shape, which adapts to light/dark theme
- Yield‑to‑maturity solver
	- Enter a market price instead of a yield and the app solves for the yield that reproduces it (Newton‑Raphson for coupon bonds, closed form for Zero/Perpetual)
	- Mutually exclusive with curve discounting, since solving produces a single flat yield
- Duration & convexity
	- Macaulay duration (PV‑weighted average time to cash flow) and modified duration
	- Convexity
	- Closed‑form values for Perpetual bonds; computed from the actual discounted cash‑flow schedule for Normal/Zero bonds (including when curve discounting is active, via an implied flat yield)
- Accrued interest / dirty price
	- "Coupon period elapsed" input for Normal bonds computes accrued interest and the dirty price (clean price + accrued interest)
- Cash flow schedule
	- Collapsible per‑bond table listing each cash flow's period, maturity, amount, discount factor and present value
- Input validation
	- Inline error messages for invalid inputs (negative face value/years, non‑integer payments per year, out‑of‑range decimals, non‑positive yield for a perpetuity, etc.) instead of silent NaN/Infinity output
- Shareable scenarios
	- The full state of both bonds and the yield curve is kept in sync with the URL query string, and a "Copy Shareable Link" button copies the current scenario
- Light/dark theme toggle, persisted across visits
- Interactive controls
	- Sliders and numeric inputs for face value, coupon rate, years to maturity, yield and payments per year
	- Reset buttons for Bond A and Bond B to restore default parameters
- Formula visualization using MathJax
	- Displays the exact pricing formula for each bond, with current input values substituted, including the curve‑discounting and dirty‑price variants
	- Separate formula panels for Bond A and Bond B
- Clean, responsive UI for finance use cases
	- Output cards for bond price, effective rate, coupon payment, number of payments, duration, convexity, accrued interest and dirty price

![Comparing different bond types](Bond_Pricer_Screenshot1.png)

## How it works

- The app prices bonds by discounting future cash flows using the specified yield to maturity and coupon schedule.
- For coupon bonds, price is computed as the sum of discounted coupon payments plus the discounted face value at maturity.
- Perpetual bonds are priced as a perpetuity, using the closed‑form P = cF/λ where c is the annual coupon rate and λ is the annual yield.
- Zero‑coupon bonds are priced as a single discounted cash flow of the face value at maturity.
- When curve discounting is enabled, each Normal‑bond cash flow (and the Zero‑coupon payoff) is discounted at the yield curve's interpolated rate for that specific cash flow's maturity, instead of a single flat yield — i.e. proper spot‑rate/term‑structure discounting. Perpetual bonds always use the flat yield, since their infinite horizon has no single well‑defined curve maturity.
- The yield‑to‑maturity solver finds the flat yield λ such that the bond's price P(λ) equals a given market price, using Newton‑Raphson with an analytic derivative (falling back to bisection over a wide bracket for pathological inputs); Zero‑coupon and Perpetual bonds use closed‑form solutions instead.
- Duration and convexity are computed from the same discounted cash‑flow schedule used for pricing, so they stay consistent with curve discounting, the YTM solver, and every other input.
- Accrued interest is a coupon‑bond concept: it's the fraction of the current coupon period elapsed multiplied by the coupon payment, and it's added to the clean price to get the dirty price.

## Tech

- HTML5 for structure and layout
- CSS3 custom properties for a light/dark theme, and a responsive two‑column layout that collapses to one column on small screens
- Vanilla JavaScript for calculations, event handling and slider/field synchronization — no framework, no bundler
- MathJax for rendering LaTeX formulas of the pricing equations
- Vitest for unit tests of the pricing/analytics logic (dev‑only; not needed to run the app itself)
- GitHub Actions for CI (tests on every push/PR) and a zero‑build GitHub Pages deployment

## Structure

- `index.html` – main page: Bond A/B panels, yield curve panel, comparison and formula containers
- `Style.css` – CSS custom properties for the light/dark theme, layout and typography
- `Calc.js` – DOM glue: reads inputs, validates them, calls into `BondMath.js`/`Curve.js`, writes results, URL sync, theme toggle
- `BondMath.js` – pure pricing/analytics engine (pricing, YTM solver, duration, convexity, accrued interest, validation) — no DOM access, so it's unit‑testable directly under Node
- `FormulaBuilder.js` – LaTeX generation and MathJax rendering for bond formulas
- `Curve.js` – yield curve node interpolation, presets, and canvas chart rendering
- `tests/` – Vitest unit tests for `BondMath.js` and `Curve.js`
- `.github/workflows/` – CI (`test.yml`) and GitHub Pages deployment (`deploy.yml`)

## Development

The app itself needs no build step — just open `index.html` in a browser. Node/npm is only needed to run the test suite:

```
npm install
npm test          # run the unit tests once
npm run test:watch # re-run on file changes
```

## Deployment

The included `.github/workflows/deploy.yml` publishes the repo root (minus dev‑only files) to GitHub Pages on every push to `main`, with no build step. To enable it: push this repo to GitHub, then in **Settings → Pages**, set **Source** to **GitHub Actions**. After the workflow runs once, your live URL will be `https://<username>.github.io/<repo>/`.
