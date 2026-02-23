// server.js
const express = require("express");
const { Worker } = require("worker_threads");
const os = require("os");
const path = require("path");
const cors = require("cors"); // 1. 引入 cors

const app = express();
app.use(cors()); // 2. 允許所有跨域請求 (之後可以設定只允許你的 Vercel 網址)
app.use(express.json());

app.post("/api/simulate", async (req, res) => {
  const {
    deckText,
    basicPokemon,
    searchCards,
    supporters,
    energyCards,
    iterations = 100000,
  } = req.body;
  const numCPUs = os.cpus().length;

  try {
    const runMode = (mode) => {
      return new Promise((resolve, reject) => {
        let completed = 0,
          totalSuccess = 0,
          totalMulligans = 0,
          totalEnergyVelocity = 0,
          combinedStats = {},
          combinedPrizeStats = {},
          combinedTopDeckStats = {};
        for (let i = 0; i < numCPUs; i++) {
          const worker = new Worker(path.join(__dirname, "worker.js"), {
            workerData: {
              iterations: Math.floor(iterations / numCPUs),
              mode,
              deckText,
              basicPokemon,
              searchCards,
              supporters,
              energyCards,
            },
          });
          worker.on("message", (d) => {
            totalSuccess += d.success;
            totalMulligans += d.mulligans;
            totalEnergyVelocity += d.energyVelocity;
            for (let key in d.stats)
              combinedStats[key] = (combinedStats[key] || 0) + d.stats[key];
            for (let key in d.prizeStats)
              combinedPrizeStats[key] =
                (combinedPrizeStats[key] || 0) + d.prizeStats[key];
            for (let key in d.topDeckStats)
              combinedTopDeckStats[key] =
                (combinedTopDeckStats[key] || 0) + d.topDeckStats[key];
            if (++completed === numCPUs) {
              resolve({
                success: totalSuccess,
                mulligans: totalMulligans,
                avgEnergy: totalEnergyVelocity / iterations,
                stats: combinedStats,
                prizeStats: combinedPrizeStats,
                topDeckStats: combinedTopDeckStats,
              });
            }
          });
          worker.on("error", reject);
        }
      });
    };

    const first = await runMode("first");
    const second = await runMode("second");

    res.json({
      status: "success",
      data: {
        first,
        second,
        iterations,
        usedBasicPokemon: basicPokemon, // 新增這行
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = 3000;
app.listen(PORT, () =>
  console.log(`🚀 模擬器已啟動: http://localhost:${PORT}`),
);
