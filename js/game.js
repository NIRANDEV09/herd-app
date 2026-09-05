import { BOT_TEMPLATES, CONFIG, NEWS } from './data.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const choose = list => list[Math.floor(Math.random() * list.length)];

// Box-Muller Gaussian for realistic market stochastic volatility
function gaussianRandom(mean = 0, stdev = 1) {
  let u = 1 - Math.random();
  let v = Math.random();
  return mean + Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v) * stdev;
}

// Generate realistic, natural starting market prices (e.g. ₹320.0, ₹485.5, ₹650.0, ₹820.0)
function generateStartingPrice() {
  const steps = Math.floor(Math.random() * 55); // 0 to 54
  const base = CONFIG.minStartingPrice + steps * 10; // e.g., 280, 290, ..., 820
  const dec = Math.random() < 0.4 ? 0.5 : (Math.random() < 0.2 ? Math.floor(Math.random() * 9) * 0.1 : 0);
  return Math.round((base + dec) * 10) / 10;
}

export function createGame() {
  return {
    screen: 'menu',
    theme: localStorage.getItem('herd-theme') || 'dark',
    orderSize: 10,
    session: null,
    round: null,
    timerId: null,
    tradeTimerId: null,
  };
}

function createPortfolio(name = 'You') {
  return { name, cash: CONFIG.startingCash, shares: 0, avgCost: 0, startingWorth: CONFIG.startingCash, trades: [] };
}

export function startSession(game) {
  game.session = {
    roundNumber: 0,
    player: createPortfolio(),
    bots: BOT_TEMPLATES.map(bot => ({ ...bot, ...createPortfolio(bot.name) })),
    results: [],
  };
  nextRound(game);
}

export function nextRound(game) {
  const session = game.session;
  session.roundNumber += 1;
  const news = choose(NEWS);
  const polarity = Math.random() + news.bias * 0.35 > 0.5 ? 'buy' : 'sell';
  const signal = polarity === 'buy' ? 'supply-chain data points to stronger demand.' : 'a key customer may be cutting its order book.';
  
  // Dynamic random starting price for the round
  const openPrice = generateStartingPrice();

  // Proportionate percentage-based Intrinsic Value calculation
  const newsImpact = openPrice * (news.bias * 0.14); // ~ ±14% fundamental shift
  const signalImpact = openPrice * (polarity === 'buy' ? 0.045 : -0.045); // ~ ±4.5% private edge
  const valuationNoise = openPrice * (Math.random() - 0.5) * 0.035; // ~ ±1.75% noise
  const intrinsic = openPrice + newsImpact + signalImpact + valuationNoise;

  game.round = {
    news: news.text,
    newsBias: news.bias,
    privateInfo: { polarity, reliability: 0.7 + Math.random() * 0.22, text: `Your private source says ${signal}` },
    openPrice,
    currentPrice: openPrice,
    intrinsic: Math.round(intrinsic * 10) / 10,
    startTime: null,
    momentumVelocity: 0,
    priceHistory: [{ time: 0, price: openPrice }],
    trades: [],
  };
  game.screen = 'setup';
}

export function placeOrder(game, portfolio, side, requestedSize, isPlayer = false) {
  const round = game.round;
  if (!round || game.screen !== 'trading') return null;
  const affordable = Math.floor(portfolio.cash / round.currentPrice);
  const size = Math.max(0, Math.min(Math.floor(requestedSize), side === 'buy' ? affordable : portfolio.shares));
  if (!size) return null;
  const price = round.currentPrice;
  if (side === 'buy') {
    const totalCost = portfolio.avgCost * portfolio.shares + price * size;
    portfolio.shares += size;
    portfolio.cash -= price * size;
    portfolio.avgCost = totalCost / portfolio.shares;
  } else {
    portfolio.shares -= size;
    portfolio.cash += price * size;
    if (!portfolio.shares) portfolio.avgCost = 0;
  }
  
  // Realistic price impact scaled to the current price level
  const priceScale = round.currentPrice / 500;
  const impact = Math.sqrt(size) * CONFIG.priceImpact * 1.6 * priceScale * (side === 'buy' ? 1 : -1);
  const minLimit = round.openPrice * 0.35;
  const maxLimit = round.openPrice * 2.8;
  round.currentPrice = clamp(round.currentPrice + impact, minLimit, maxLimit);
  round.momentumVelocity += impact * 0.5;

  const time = performance.now() - round.startTime;
  const trade = { trader: portfolio.name, side, size, price: Math.round(price * 10) / 10, isPlayer, color: portfolio.color, time };
  round.trades.push(trade);
  portfolio.trades.push({ ...trade, priceAfter: round.currentPrice });
  round.priceHistory.push({ time, price: Math.round(round.currentPrice * 10) / 10 });
  return trade;
}

function botAction(game, bot) {
  const round = game.round;
  if (!round || game.screen !== 'trading') return;
  const movement = (round.currentPrice - round.openPrice) / round.openPrice;
  const newsSignal = round.newsBias;
  const loss = bot.shares && round.currentPrice < bot.avgCost ? (bot.avgCost - round.currentPrice) / bot.avgCost : 0;
  const score = newsSignal * 0.8 + movement * bot.momentum * 7 - bot.anchor * movement * 2 - loss * bot.lossAv * 2 + gaussianRandom(0, 0.4);
  const side = score >= 0 ? 'buy' : 'sell';
  const size = 3 + Math.floor(Math.random() * 16);
  placeOrder(game, bot, side, size, false);
}

export function beginTrading(game, onUpdate, onEnd) {
  const round = game.round;
  round.startTime = performance.now();

  const tick = () => {
    const elapsed = performance.now() - round.startTime;
    if (elapsed >= CONFIG.roundDuration) {
      stopTrading(game);
      settleRound(game);
      onEnd();
      return;
    }

    // Realistic market dynamics scaled to open price
    round.momentumVelocity *= 0.92;
    const volatilityStdev = round.openPrice * 0.0016;
    const noise = gaussianRandom(0, volatilityStdev);
    const newsDrift = (round.newsBias * round.openPrice * 0.0006) * (1 - elapsed / CONFIG.roundDuration);
    const reversion = (round.intrinsic - round.currentPrice) * 0.0032;
    const delta = noise + newsDrift + reversion + (round.momentumVelocity * 0.1);

    const minLimit = round.openPrice * 0.35;
    const maxLimit = round.openPrice * 2.8;
    round.currentPrice = clamp(round.currentPrice + delta, minLimit, maxLimit);
    round.priceHistory.push({ time: elapsed, price: Math.round(round.currentPrice * 10) / 10 });
    onUpdate();
  };

  game.timerId = window.setInterval(tick, 200);
  
  // Bots active trading engine
  game.tradeTimerId = window.setInterval(() => {
    if (game.session && game.session.bots) {
      botAction(game, choose(game.session.bots));
      if (Math.random() < 0.35) {
        botAction(game, choose(game.session.bots));
      }
      onUpdate();
    }
  }, 750);
}

export function stopTrading(game) {
  if (game.timerId) clearInterval(game.timerId);
  if (game.tradeTimerId) clearInterval(game.tradeTimerId);
  game.timerId = null;
  game.tradeTimerId = null;
}

export function settleRound(game) {
  const { session, round } = game;
  const holders = [session.player, ...session.bots].filter(p => p.shares > 0);
  const averageHold = holders.length ? holders.reduce((sum, p) => sum + p.avgCost, 0) / holders.length : round.currentPrice;
  const terminal = round.intrinsic * 0.6 + averageHold * 0.4;
  const people = [session.player, ...session.bots];
  const standings = people.map(person => {
    const value = person.cash + person.shares * terminal;
    const change = value - person.startingWorth;
    person.cash = value; person.shares = 0; person.avgCost = 0; person.startingWorth = value;
    return { name: person.name, color: person.color, archetype: person.archetype, isPlayer: person.name === 'You', change, value };
  }).sort((a, b) => b.change - a.change);
  session.results.push({ round: session.roundNumber, news: round.news, intrinsic: round.intrinsic, averageHold, terminal, standings });
  game.screen = 'round-end';
}

export function totalStandings(session) {
  const rows = new Map();
  session.results.forEach(result => result.standings.forEach(row => {
    const previous = rows.get(row.name) || { ...row, total: 0 };
    previous.total += row.change; rows.set(row.name, previous);
  }));
  return [...rows.values()].sort((a, b) => b.total - a.total);
}

export const getTimeLeft = round => Math.max(0, Math.ceil((CONFIG.roundDuration - (performance.now() - round.startTime)) / 1000));
export const money = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
export const price = value => `₹${Number(value).toFixed(1)}`;
