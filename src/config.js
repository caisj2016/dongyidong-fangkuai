export const STORAGE_KEY = "dongYiDongFangKuaiHighScore";

export const GAME_CONFIG = {
  cols: 10,
  rows: 20,
  cellSize: 36,
  roundSeconds: 120,
  baseDropInterval: 650,
  softDropInterval: 100,
  lineScore: 100,
};

export const MOTION_CONFIG = {
  smoothingWindow: 2,
  neutralZone: 0.03,
  repeatDelays: {
    moveInitialDelay: 200,
    moveRepeatInterval: 90,
    rotateInitialDelay: 420,
    rotateRepeatInterval: 420,
    dropRepeatInterval: 100,
  },
  lockDelays: {
    direction: 250,
    rotateToDrop: 450,
    rotate: 320,
  },
  holds: {
    rotate: 85,
    squat: 180,
    squatMobile: 220,
  },
  thresholds: {
    lean: 0.055,
    headOffset: 0.065,
    rearmThreshold: 0.03,
    headDown: 0.02,
    headDownMobile: 0.035,
    headUp: 0.01,
    facePitchDown: 0.11,
    facePitchDownMobile: 0.14,
    facePitchUp: 0.05,
    squat: 0.12,
    handsUpOffset: 0.04,
    singleHandOffset: 0.05,
    baselineStill: 0.03,
  },
};
