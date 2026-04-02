export const STORAGE_KEY = "dongYiDongFangKuaiHighScore";

export const GAME_CONFIG = {
  cols: 10,
  rows: 20,
  cellSize: 36,
  roundSeconds: 120,
  normalDropInterval: 780,
  softDropInterval: 85,
  lineScore: 100,
};

export const MOTION_CONFIG = {
  smoothingWindow: 2,
  neutralZone: 0.025,
  cooldowns: {
    left: 220,
    right: 220,
    rotate: 400,
  },
  holds: {
    rotate: 120,
    squat: 120,
  },
  thresholds: {
    lean: 0.055,
    headOffset: 0.055,
    headDown: 0.012,
    headUp: 0.018,
    squat: 0.12,
    handsUpOffset: 0.04,
    singleHandOffset: 0.05,
    baselineStill: 0.03,
  },
};
