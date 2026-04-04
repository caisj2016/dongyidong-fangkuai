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
    rotateInitialDelay: 250,
    rotateRepeatInterval: 160,
    dropRepeatInterval: 100,
  },
  lockDelays: {
    direction: 250,
    rotateToDrop: 400,
  },
  holds: {
    rotate: 40,
    squat: 120,
    squatMobile: 120,
  },
  thresholds: {
    lean: 0.055,
    headOffset: 0.065,
    rearmThreshold: 0.03,
    headDown: 0.012,
    headDownMobile: 0.025,
    headUp: 0.01,
    facePitchDown: 0.08,
    facePitchDownMobile: 0.1,
    facePitchUp: 0.05,
    squat: 0.12,
    handsUpOffset: 0.04,
    singleHandOffset: 0.05,
    baselineStill: 0.03,
  },
};
