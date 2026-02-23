const { parentPort, workerData } = require("worker_threads");
const _ = require("lodash");

const {
  iterations,
  mode,
  deckText,
  basicPokemon,
  searchCards,
  supporters,
  energyCards,
} = workerData;

function parseDeck(text) {
  const lines = text.trim().split("\n");
  const deck = [];
  lines.forEach((line) => {
    const trimmedLine = line.trim();
    // 略過空行或 PTCGL 分類標題 (如 Pokémon: 18)
    if (!trimmedLine || trimmedLine.match(/^[A-Za-z-é]+:\s*\d+/)) return;

    const match = trimmedLine.match(/^(\d+)\s+(.+?)\s+([A-Z0-9]{2,4}\s+\d+)/);
    if (match) {
      const count = parseInt(match[1]);
      const name = match[2];
      for (let i = 0; i < count; i++) deck.push(name);
    }
  });
  return deck;
}

const masterDeck = parseDeck(deckText);
// 新增 prizeStats 物件來統計
let successCount = 0,
  mulliganCount = 0,
  energyVelocityCount = 0,
  handStats = {},
  prizeStats = {},
  topDeckStats = {};

for (let i = 0; i < iterations; i++) {
  let currentDeck = [...masterDeck],
    hand = [],
    hasBasic = false;

  while (!hasBasic) {
    currentDeck = _.shuffle([...masterDeck]);
    hand = currentDeck.slice(0, 7);
    hasBasic = hand.some((card) => basicPokemon.some((b) => card.includes(b)));
    if (!hasBasic) mulliganCount++;
  }

  hand.forEach((card) => {
    handStats[card] = (handStats[card] || 0) + 1;
  });

  const remainingDeck = currentDeck.slice(7);
  const prizes = remainingDeck.slice(0, 6);
  const topDeck = remainingDeck[6] || "";
  const available = [...hand, topDeck];

  // 下一抽
  if (topDeck) {
    topDeckStats[topDeck] = (topDeckStats[topDeck] || 0) + 1;
  }

  // --- 新增：紀錄這局的獎賞卡 ---
  prizes.forEach((card) => {
    if (card) prizeStats[card] = (prizeStats[card] || 0) + 1;
  });

  const canGetCoreBasic = available.some(
    (c) => c && searchCards.some((s) => c.includes(s)),
  );
  const hasEnergy = available.some(
    (c) => c && energyCards.some((s) => c.includes(s)),
  );
  const hasSupporter = available.some(
    (c) => c && supporters.some((s) => c.includes(s)),
  );

  let turnEnergy = 0;
  if (available.some((c) => c && c.includes("Energy"))) turnEnergy += 1;
  if (
    available.some((c) => c && c.includes("Teal Mask Ogerpon ex")) &&
    available.some((c) => c && c.includes("Grass Energy"))
  )
    turnEnergy += 1;
  energyVelocityCount += turnEnergy;

  let success = false;
  if (mode === "first") {
    success = canGetCoreBasic && hasEnergy;
  } else {
    success = (canGetCoreBasic || hasSupporter) && hasEnergy;
  }
  if (success) successCount++;
}

parentPort.postMessage({
  success: successCount,
  mulligans: mulliganCount,
  energyVelocity: energyVelocityCount,
  stats: handStats,
  prizeStats: prizeStats,
  topDeckStats: topDeckStats,
});
