export const CONFIG = {
  startingCash: 100000,
  minStartingPrice: 280,
  maxStartingPrice: 950,
  roundDuration: 60000,
  totalRounds: 3,
  priceImpact: 0.08,
};

export const NEWS = [
  { text: "Company X beats Q3 earnings estimates. Guidance is mixed.", bias: 0.35 },
  { text: "SEBI launches an informal probe into Company X's accounting.", bias: -0.55 },
  { text: "Company X board approves a ₹500 cr share buyback.", bias: 0.50 },
  { text: "Analyst downgrade cites Company X's stretched valuation.", bias: -0.35 },
  { text: "Company X announces a strategic partnership with a global firm.", bias: 0.45 },
];

export const BOT_TEMPLATES = [
  { name: "Mira", archetype: "Momentum", color: "#a78bfa", momentum: 0.9, anchor: 0.15, lossAv: 1.1 },
  { name: "Arjun", archetype: "Anchor", color: "#fbbf24", momentum: 0.1, anchor: 0.9, lossAv: 1.5 },
  { name: "Zoya", archetype: "Contrarian", color: "#60a5fa", momentum: -0.7, anchor: 0.25, lossAv: 1.2 },
  { name: "Ravi", archetype: "Loss averse", color: "#f87171", momentum: 0.25, anchor: 0.4, lossAv: 3.2 },
  { name: "Isha", archetype: "Balanced", color: "#5ee6a8", momentum: 0.35, anchor: 0.3, lossAv: 1.7 },
];
