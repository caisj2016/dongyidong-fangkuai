export const STORAGE_KEY = "dongYiDongFangKuaiHighScore";

export const GAME_CONFIG = {
  cols: 10,
  rows: 20,
  cellSize: 36,
  roundSeconds: 120,
  normalDropInterval: 650,
  softDropInterval: 100,
  lineScore: 100,
};

export const MOTION_CONFIG = {
  smoothingWindow: 2,
  neutralZone: 0.03,
  cooldowns: {
    left: 220,
    right: 220,
    rotate: 400,
  },
  holds: {
    rotate: 90,
    squat: 120,
    squatMobile: 280,
  },
  thresholds: {
    lean: 0.055,
    headOffset: 0.065,
    rearmThreshold: 0.03,
    headDown: 0.012,
    headDownMobile: 0.025,
    headUp: 0.015,
    squat: 0.12,
    handsUpOffset: 0.04,
    singleHandOffset: 0.05,
    baselineStill: 0.03,
  },
};
