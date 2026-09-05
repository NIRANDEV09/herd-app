import { CONFIG } from './data.js';
import { beginTrading, createGame, getTimeLeft, money, nextRound, placeOrder, price, settleRound, startSession, stopTrading, totalStandings } from './game.js';

const app = document.querySelector('#app');
const game = createGame();
document.documentElement.dataset.theme = game.theme;
const esc = value => String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);

function setTheme() {
  document.documentElement.dataset.theme = game.theme;
  localStorage.setItem('herd-theme', game.theme);
}

function mount(html) {
  app.innerHTML = html;
}

function buttonTheme() {
  return '<button class="secondary theme" data-action="theme" type="button">Theme</button>';
}

function renderMenu() {
  mount(`<section class="screen menu">${buttonTheme()}<div><div class="brand">HERD<span class="dot">.</span></div><p class="tagline">A <b>Keynesian beauty contest</b>, tradeable. Play three rounds against five behavioural bots. The market is the room.</p><button class="primary" data-action="start" type="button">Start session</button><div class="explain"><div><span class="accent mono">01 · READ</span><h3>Public and private signals</h3><p class="dim">Everyone sees the headline. Your private tip is only yours.</p></div><div><span class="accent mono">02 · TRADE</span><h3>One minute, one asset</h3><p class="dim">Buy or sell while bot behaviour pushes the live price.</p></div><div><span class="accent mono">03 · SETTLE</span><h3>Truth meets the crowd</h3><p class="dim">The terminal value rewards reading both intrinsic value and the herd.</p></div></div></div></section>`);
}

function renderSetup() {
  const r = game.round;
  const buy = r.privateInfo.polarity === 'buy';
  mount(`<section class="screen setup">${buttonTheme()}<div class="card"><div class="eyebrow">Round ${game.session.roundNumber} of ${CONFIG.totalRounds}</div><h2 class="title">Market opens in a moment.</h2><div class="section"><label>Public news · everyone sees this</label><p class="news">${esc(r.news)}</p></div><div class="section"><label>Private tile · only you</label><p class="private"><b class="${buy ? 'up' : 'down'}">${buy ? 'BUY' : 'SELL'} SIGNAL</b><br>${esc(r.privateInfo.text)} <span class="dim">(${Math.round(r.privateInfo.reliability * 100)}% reliable)</span></p></div><div class="section"><label>Payoff formula</label><p class="formula">Terminal = 0.6 × intrinsic + 0.4 × crowd avg hold</p></div><div class="section"><button class="primary" data-action="enter" type="button">Enter the market</button></div></div></section>`);
}

function chartSvg() {
  const { priceHistory, intrinsic } = game.round;
  const W = 800, H = 390;
  const padLeft = 20, padRight = 60, padTop = 20, padBottom = 26;
  const plotW = W - padLeft - padRight;
  const plotH = H - padTop - padBottom;

  const prices = priceHistory.map(point => point.price);
  const rawMin = Math.min(...prices, intrinsic);
  const rawMax = Math.max(...prices, intrinsic);
  const basePrice = game.round.openPrice || prices[0] || 500;
  const margin = Math.max(basePrice * 0.035, (rawMax - rawMin) * 0.12);
  const min = rawMin - margin, max = rawMax + margin;
  const span = max - min || 1;

  const y = value => padTop + plotH - ((value - min) / span) * plotH;
  const x = time => padLeft + Math.min(time, CONFIG.roundDuration) / CONFIG.roundDuration * plotW;

  // Horizontal Grid & Y-Axis Price Labels
  const yLevels = [0, 1, 2, 3, 4];
  const grid = yLevels.map(i => {
    const pVal = min + (span / 4) * i;
    const yPos = y(pVal);
    return `<line x1="${padLeft}" x2="${padLeft + plotW}" y1="${yPos.toFixed(1)}" y2="${yPos.toFixed(1)}" stroke="var(--border)" stroke-dasharray="3 5"/>
            <text x="${padLeft + plotW + 8}" y="${(yPos + 4).toFixed(1)}" fill="var(--mute)" font-size="10" font-family="JetBrains Mono, monospace">₹${Math.round(pVal)}</text>`;
  }).join('');

  // Vertical Grid & X-Axis Time Labels
  const timeLabels = [0, 15, 30, 45, 60].map(sec => {
    const xPos = x(sec * 1000);
    return `<line x1="${xPos.toFixed(1)}" x2="${xPos.toFixed(1)}" y1="${padTop}" y2="${padTop + plotH}" stroke="var(--border)" stroke-dasharray="2 6" opacity="0.6"/>
            <text x="${xPos.toFixed(1)}" y="${H - 6}" text-anchor="middle" fill="var(--mute)" font-size="10" font-family="JetBrains Mono, monospace">${sec}s</text>`;
  }).join('');

  // Points for polyline and gradient area
  const points = priceHistory.map(point => `${x(point.time).toFixed(1)},${y(point.price).toFixed(1)}`).join(' ');
  const firstX = x(priceHistory[0].time).toFixed(1);
  const lastPoint = priceHistory[priceHistory.length - 1];
  const lastX = x(lastPoint.time);
  const lastY = y(lastPoint.price);
  const baseY = (padTop + plotH).toFixed(1);
  const areaPoints = `${firstX},${baseY} ${points} ${lastX.toFixed(1)},${baseY}`;

  // Current market price badge at the graph tip
  const badgeW = 72, badgeH = 22;
  let badgeX = lastX - badgeW / 2;
  if (badgeX + badgeW > padLeft + plotW) badgeX = padLeft + plotW - badgeW;
  if (badgeX < padLeft) badgeX = padLeft;
  const badgeY = lastY < padTop + 30 ? lastY + 8 : lastY - badgeH - 6;

  const tipMarker = `
    <circle cx="${lastX.toFixed(1)}" cy="${lastY.toFixed(1)}" r="4.5" fill="var(--accent)"/>
    <circle cx="${lastX.toFixed(1)}" cy="${lastY.toFixed(1)}" r="8.5" fill="none" stroke="var(--accent)" opacity="0.5"/>
    <rect x="${badgeX.toFixed(1)}" y="${badgeY.toFixed(1)}" width="${badgeW}" height="${badgeH}" rx="3" fill="var(--surface)" stroke="var(--accent)" stroke-width="1.5"/>
    <text x="${(badgeX + badgeW / 2).toFixed(1)}" y="${(badgeY + 15).toFixed(1)}" text-anchor="middle" fill="var(--accent)" font-size="11" font-weight="700" font-family="JetBrains Mono, monospace">₹${lastPoint.price.toFixed(1)}</text>
  `;

  // Intrinsic Fair Value line
  const intrinsicY = y(intrinsic);
  const intrinsicLine = `
    <line x1="${padLeft}" x2="${padLeft + plotW}" y1="${intrinsicY.toFixed(1)}" y2="${intrinsicY.toFixed(1)}" stroke="var(--warn)" stroke-dasharray="3 5"/>
    <text x="${padLeft + plotW + 8}" y="${(intrinsicY + 4).toFixed(1)}" fill="var(--warn)" font-size="9" font-weight="700" font-family="JetBrains Mono, monospace">FV</text>
  `;

  return `
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Live Company X price chart">
      <defs>
        <linearGradient id="chartGradient" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.25"/>
          <stop offset="100%" stop-color="var(--accent)" stop-opacity="0.0"/>
        </linearGradient>
      </defs>
      ${grid}
      ${timeLabels}
      ${intrinsicLine}
      <polygon points="${areaPoints}" fill="url(#chartGradient)"/>
      <polyline points="${points}" fill="none" stroke="var(--accent)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>
      ${tipMarker}
    </svg>
  `;
}

function renderTrading() {
  const p = game.session.player, r = game.round, pnl = p.cash + p.shares * r.currentPrice - p.startingWorth;
  const tapeHtml = r.trades.slice(-11).reverse().map(t => `<div class="trade"><span class="badge" style="color:${t.isPlayer ? 'var(--accent)' : t.color}">${esc(t.trader)}</span><span class="${t.side === 'buy' ? 'up' : 'down'}">${t.side.toUpperCase()}</span><span>${t.size}@${t.price.toFixed(1)}</span></div>`).join('') || '<p class="dim mono">Waiting for trades…</p>';
  
  mount(`<section class="trading">
    <header class="status">
      <div class="status-left">
        <h1>HERD<span class="dot">.</span></h1>
        <span class="mono dim">ROUND ${game.session.roundNumber}/${CONFIG.totalRounds}</span>
      </div>
      <div class="status-center">
        <span class="timer ${getTimeLeft(r) <= 10 ? 'urgent' : ''}">${String(getTimeLeft(r)).padStart(2,'0')}s</span>
      </div>
      <div class="status-right">
        <span class="stat"><label>Cash</label><b id="stat-cash">${money(p.cash)}</b></span>
        <span class="stat"><label>Shares</label><b id="stat-shares">${p.shares}</b></span>
        <span class="stat"><label>Net P&L</label><b id="stat-pnl" class="${pnl >= 0 ? 'up' : 'down'}">${money(pnl)}</b></span>
      </div>
    </header>
    <div class="main">
      <article class="chart-panel">
        <div class="chart-head">
          <div>
            <div class="market-price" id="market-price-val">${price(r.currentPrice)}</div>
            <span class="eyebrow">Company X · market price</span>
          </div>
          <span class="dim mono">Dotted line: hidden fair value</span>
        </div>
        <div class="chart" id="trading-chart">${chartSvg()}</div>
      </article>
      <aside class="rail">
        <div class="panel private">
          <b>PRIVATE · ${r.privateInfo.polarity.toUpperCase()} SIGNAL</b><br>
          Reliability ${Math.round(r.privateInfo.reliability*100)}%
        </div>
        <div class="panel position">
          <div><label>Avg cost</label><b class="mono" id="stat-avg-cost">${p.avgCost ? price(p.avgCost) : '—'}</b></div>
          <div><label>Market value</label><b class="mono" id="stat-mkt-val">${money(p.shares * r.currentPrice)}</b></div>
        </div>
        <div class="panel">
          <label>Place order · shares</label>
          <div class="order-stepper">
            <button class="stepper-btn" data-step="-1" type="button" title="Decrease order size">−</button>
            <input id="order-size" class="order-size" type="number" min="1" value="${game.orderSize}">
            <button class="stepper-btn" data-step="+1" type="button" title="Increase order size">+</button>
          </div>
          <div class="presets">
            ${[5,10,25,50].map(n => `<button class="preset" data-size="${n}" type="button">${n}</button>`).join('')}
          </div>
          <div class="orders">
            <button class="buy" data-order="buy" type="button">Buy</button>
            <button class="sell" data-order="sell" type="button">Sell</button>
          </div>
        </div>
        <div class="tape" id="trade-tape">${tapeHtml}</div>
      </aside>
    </div>
    <footer class="newsbar"><b class="accent mono">NEWS</b> ${esc(r.news)}</footer>
  </section>`);
}

function refreshTrading() {
  if (game.screen !== 'trading') return;
  const tradingEl = app.querySelector('.trading');
  if (!tradingEl) {
    renderTrading();
    return;
  }

  const p = game.session?.player;
  const r = game.round;
  if (!p || !r) return;

  const pnl = p.cash + p.shares * r.currentPrice - p.startingWorth;
  const timeLeft = getTimeLeft(r);

  // 1. Update Timer
  const timerEl = tradingEl.querySelector('.timer');
  if (timerEl) {
    timerEl.textContent = `${String(timeLeft).padStart(2, '0')}s`;
    if (timeLeft <= 10) {
      timerEl.classList.add('urgent');
    } else {
      timerEl.classList.remove('urgent');
    }
  }

  // 2. Update Header Cash, Shares, P&L
  const cashEl = document.getElementById('stat-cash');
  if (cashEl) cashEl.textContent = money(p.cash);
  const sharesEl = document.getElementById('stat-shares');
  if (sharesEl) sharesEl.textContent = p.shares;
  const pnlEl = document.getElementById('stat-pnl');
  if (pnlEl) {
    pnlEl.textContent = money(pnl);
    pnlEl.className = pnl >= 0 ? 'up' : 'down';
  }

  // 3. Update Market Price
  const mktPriceEl = document.getElementById('market-price-val');
  if (mktPriceEl) mktPriceEl.textContent = price(r.currentPrice);

  // 4. Update Position Info
  const avgCostEl = document.getElementById('stat-avg-cost');
  if (avgCostEl) avgCostEl.textContent = p.avgCost ? price(p.avgCost) : '—';
  const mktValEl = document.getElementById('stat-mkt-val');
  if (mktValEl) mktValEl.textContent = money(p.shares * r.currentPrice);

  // 5. Update Live Chart SVG
  const chartEl = document.getElementById('trading-chart');
  if (chartEl) chartEl.innerHTML = chartSvg();

  // 6. Update Live Trade Tape
  const tapeEl = document.getElementById('trade-tape');
  if (tapeEl) {
    tapeEl.innerHTML = r.trades.slice(-11).reverse().map(t => 
      `<div class="trade"><span class="badge" style="color:${t.isPlayer ? 'var(--accent)' : t.color}">${esc(t.trader)}</span><span class="${t.side === 'buy' ? 'up' : 'down'}">${t.side.toUpperCase()}</span><span>${t.size}@${t.price.toFixed(1)}</span></div>`
    ).join('') || '<p class="dim mono">Waiting for trades…</p>';
  }
}

function renderRoundEnd() {
  const result = game.session.results.at(-1), player = result.standings.find(row => row.isPlayer), rank = result.standings.indexOf(player) + 1;
  mount(`<section class="screen round-end"><div class="card"><div class="eyebrow">Round ${result.round} · settled</div><h2 class="title">Market closes.</h2><p class="dim">${esc(result.news)}</p><div class="result-grid"><div><label>Intrinsic</label><b class="up">${price(result.intrinsic)}</b></div><div><label>Crowd avg hold</label><b class="accent">${price(result.averageHold)}</b></div><div><label>Terminal</label><b>${price(result.terminal)}</b></div></div><div class="panel"><label>Your round P&L · Rank ${rank}/${result.standings.length}</label><h2 class="${player.change >= 0 ? 'up' : 'down'} mono">${money(player.change)}</h2>${result.standings.map((row,i) => `<div class="row ${row.isPlayer ? 'self':''}"><span>#${i+1}</span><span>${esc(row.name)} ${row.archetype ? `<small class="dim">${row.archetype}</small>`:''}</span><span class="${row.change>=0?'up':'down'}">${money(row.change)}</span></div>`).join('')}</div><div class="section"><button class="primary" data-action="continue" type="button">${game.session.roundNumber === CONFIG.totalRounds ? 'See your fingerprint' : 'Next round'}</button></div></div></section>`);
}

/**
 * Generates tailored behavioral advice, caution alerts, and good practice tips
 * based on player's overall trading performance, order bias, and volume.
 */
function getTradingAdvice(player, rank, totalCount) {
  const trades = player.trades || [];
  const count = trades.length;
  const buys = trades.filter(t => t.side === 'buy').length;
  const buyRatio = count > 0 ? buys / count : 0.5;
  const profit = player.total || 0;

  // Case 1: Passive / Low Activity
  if (count <= 2) {
    return {
      persona: "The Passive Observer",
      icon: "🛡️",
      tag: "Low Activity",
      caution: "Caution: Sitting completely on the sidelines protects initial capital, but forfeits high-probability profit spreads when market prices deviate significantly from Fair Value.",
      suggestion: "Good Practice: Watch for extreme mispricings against the dotted FV line. Start entering with small share batches (5–10 shares) early in the round to capture momentum with controlled risk."
    };
  }

  // Case 2: Hyperactive Overtrading
  if (count >= 14) {
    if (profit > 0) {
      return {
        persona: "High-Frequency Momentum Scalper",
        icon: "⚡",
        tag: "Hyperactive & Profitable",
        caution: "Caution: High trading velocity creates substantial market impact slippage. Rapidly flipping sizes risks getting caught at the peak if bot liquidity dries up.",
        suggestion: "Good Practice: Let winning swings develop. Rather than clicking on every micro-tick, allow crowd momentum to unfold before scaling out your position."
      };
    } else {
      return {
        persona: "The Overtrading Churner",
        icon: "⚠️",
        tag: "High Churn & Drawdown",
        caution: "Caution: Excessive order frequency is eroding your balance. Entering and exiting too frequently amplifies whipsaw losses.",
        suggestion: "Good Practice: Practice patience. Wait for the initial 10–15s opening volatility to settle, gauge whether the crowd is underreacting or overreacting to the news, and place fewer, higher-conviction trades."
      };
    }
  }

  // Case 3: Heavy Buy Tilt (FOMO / Long-Only)
  if (buyRatio >= 0.75) {
    if (profit > 0) {
      return {
        persona: "The Bullish Trend Rider",
        icon: "🚀",
        tag: "Strong Long Bias",
        caution: "Caution: Long-only conviction works well in rising markets, but leaves you exposed if you hold heavy long inventory into a bearish settlement round.",
        suggestion: "Good Practice: Remember the terminal settlement formula gives 40% weight to the crowd's average holding price. If market price stretches far above FV, lock in profits by selling into the late-round pump."
      };
    } else {
      return {
        persona: "The FOMO Top-Buyer",
        icon: "📈",
        tag: "Late-Cycle Buyer",
        caution: "Caution: Buying after sharp price rallies leaves you vulnerable to sudden profit-taking dumps by bots (like Mira & Ravi) before the round closes.",
        suggestion: "Good Practice: Avoid chasing green spikes when price is already far above the Fair Value (FV) line. Look to accumulate when the price dips below FV or when private signals confirm undervaluation."
      };
    }
  }

  // Case 4: Heavy Sell Tilt (Short Bias)
  if (buyRatio <= 0.25) {
    return {
      persona: "The Defensive Bear",
      icon: "🐻",
      tag: "Net Seller Tilt",
      caution: "Caution: Premature selling or aggressive dumping caps your upside when strong positive news bias triggers a sustained herd breakout.",
      suggestion: "Good Practice: Check if the public news headline and private signals align bullishly. When fundamentals are strong, scale your sells incrementally rather than clearing inventory immediately."
    };
  }

  // Case 5: Top Tier Performer
  if (rank <= 2 && profit > 0) {
    return {
      persona: "Keynesian Market Master",
      icon: "🏆",
      tag: "Championship Tier",
      caution: "Caution: Avoid overconfidence bias. Bot archetypes adjust their aggression dynamically based on price deviations and loss thresholds across rounds.",
      suggestion: "Good Practice: Continue balancing intrinsic fundamentals with crowd psychology. Scale your position sizes up using presets (25 / 50 shares) when private signal reliability is high (>85%)."
    };
  }

  // Case 6: Balanced Trader
  if (profit >= 0) {
    return {
      persona: "The Disciplined Tactician",
      icon: "🎯",
      tag: "Prudent & Balanced",
      caution: "Caution: Hesitation during strong market breakout phases can lead to leaving potential gains on the table.",
      suggestion: "Good Practice: Leverage the stepper buttons (+ / −) to fine-tune your entry quantities and maximize upside on high-confidence setups."
    };
  } else {
    return {
      persona: "The Trend Fader",
      icon: "🔄",
      tag: "Fighting the Herd",
      caution: "Caution: Fading the crowd too early ('catching a falling knife') can drain your cash before the price reverts toward intrinsic value.",
      suggestion: "Good Practice: In a Keynesian beauty contest, the goal is to anticipate what the crowd thinks of the crowd. Ride the momentum wave first, and only take contrarian bets in the final 15 seconds."
    };
  }
}

function renderDebrief() {
  const rows = totalStandings(game.session), player = rows.find(row => row.isPlayer), rank = rows.indexOf(player) + 1;
  const count = game.session.player.trades.length, buys = game.session.player.trades.filter(t => t.side === 'buy').length;
  const momentum = count ? (buys / count * 2 - 1) : 0;
  const advice = getTradingAdvice(player, rank, rows.length);

  mount(`<section class="debrief">
    <div class="eyebrow">Session debrief · behavioural fingerprint</div>
    <h2 class="title">You finished <span class="accent">#${rank}</span> of ${rows.length}.</h2>
    <p class="dim">Across three rounds, your total result was <b class="${player.total >= 0 ? 'up' : 'down'} mono">${money(player.total)}</b>.</p>
    
    <div class="debrief-grid">
      <div class="panel">
        <label>Your trading style</label>
        <div class="metric">
          <b>Momentum tilt</b>
          <span class="dim"> ${momentum >= 0 ? 'More buyer than seller' : 'More seller than buyer'}</span>
          <div class="track"><div class="fill" style="width:${Math.abs(momentum)*50}% ;margin-left:${momentum < 0 ? 50-Math.abs(momentum)*50 : 50}%"></div></div>
        </div>
        <div class="metric">
          <b>Activity</b>
          <span class="dim"> ${count} orders placed</span>
          <div class="track"><div class="fill" style="width:${Math.min(count*6,100)}%"></div></div>
        </div>

        <!-- Behavioral Coaching & Style Advice -->
        <div class="debrief-advice">
          <div class="advice-header">
            <span class="advice-icon">${advice.icon}</span>
            <div>
              <div class="advice-title">${advice.persona}</div>
              <span class="badge-tag">${advice.tag}</span>
            </div>
          </div>
          <div class="advice-card caution-card">
            <b class="down">⚠️ Caution</b>
            <p>${advice.caution}</p>
          </div>
          <div class="advice-card suggestion-card">
            <b class="accent">💡 Good Practice & Advice</b>
            <p>${advice.suggestion}</p>
          </div>
        </div>
      </div>

      <div class="panel">
        <label>Session leaderboard</label>
        ${rows.map((row,i) => `<div class="row ${row.isPlayer?'self':''}"><span>#${i+1}</span><span>${esc(row.name)}</span><span class="${row.total>=0?'up':'down'}">${money(row.total)}</span></div>`).join('')}
      </div>
    </div>
    
    <div class="section"><button class="primary" data-action="restart" type="button">Play again</button></div>
  </section>`);
}

function render() {
  if (game.screen === 'menu') renderMenu();
  else if (game.screen === 'setup') renderSetup();
  else if (game.screen === 'trading') renderTrading();
  else if (game.screen === 'round-end') renderRoundEnd();
  else renderDebrief();
}

// Global delegated event listeners so NO click or input events are ever dropped
app.addEventListener('click', (e) => {
  const button = e.target.closest('button');
  if (!button) return;

  // 1. Order Size Presets (5, 10, 25, 50)
  if (button.dataset.size !== undefined) {
    game.orderSize = Number(button.dataset.size);
    const input = document.querySelector('#order-size');
    if (input) input.value = game.orderSize;
    return;
  }

  // 2. Stepper Buttons (+ / -)
  if (button.dataset.step !== undefined) {
    const delta = Number(button.dataset.step);
    game.orderSize = Math.max(1, (game.orderSize || 10) + delta);
    const input = document.querySelector('#order-size');
    if (input) input.value = game.orderSize;
    return;
  }

  // 3. Instant Buy / Sell Orders
  if (button.dataset.order !== undefined) {
    const input = document.querySelector('#order-size');
    if (input) {
      game.orderSize = Math.max(1, Number(input.value) || 1);
    }
    placeOrder(game, game.session.player, button.dataset.order, game.orderSize, true);
    refreshTrading();
    return;
  }

  // 4. Navigation Actions
  if (button.dataset.action !== undefined) {
    const action = button.dataset.action;
    if (action === 'theme') {
      game.theme = game.theme === 'dark' ? 'light' : 'dark';
      setTheme();
      render();
    } else if (action === 'start') {
      startSession(game);
      render();
    } else if (action === 'enter') {
      game.screen = 'trading';
      render();
      beginTrading(game, refreshTrading, render);
    } else if (action === 'continue') {
      if (game.session.roundNumber < CONFIG.totalRounds) {
        nextRound(game);
        render();
      } else {
        game.screen = 'debrief';
        render();
      }
    } else if (action === 'restart') {
      stopTrading(game);
      game.screen = 'menu';
      render();
    }
  }
});

// Stepper input change sync
app.addEventListener('input', (e) => {
  if (e.target.id === 'order-size') {
    game.orderSize = Math.max(1, Number(e.target.value) || 1);
  }
});

render();
