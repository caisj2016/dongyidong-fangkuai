export const STORAGE_KEY = "dongYiDongFangKuaiHighScore";

export const GAME_CONFIG = {
  cols: 10,
  rows: 20,
  cellSize: 36,
  roundSeconds: 120,
  normalDropInterval: 650,
  softDropInterval: 85,
  lineScore: 100,
};

export const CALIBRATION_STEPS = [
  {
    key: "baseline",
    text: "站在画面中间保持不动",
    tip: "保持稳定约 2 秒，系统会记录你的基准姿势。",
  },
  {
    key: "leftHand",
    text: "左手快速上举一次",
    tip: "左手抬到肩膀上方，动作明显一些。",
  },
  {
    key: "rightHand",
    text: "右手快速上举一次",
    tip: "右手抬到肩膀上方，动作明显一些。",
  },
  {
    key: "squat",
    text: "做一次下蹲",
    tip: "身体重心明显下降即可，不需要蹲得很深。",
  },
  {
    key: "handsUp",
    text: "双手举起",
    tip: "双手同时举过肩膀并保持约 1 秒。",
  },
];

export const MOTION_CONFIG = {
  smoothingWindow: 3,
  confirmFrames: {
    left: 1,
    right: 1,
    squat: 2,
    rotate: 2,
  },
  cooldowns: {
    left: 420,
    right: 420,
    rotate: 900,
  },
  thresholds: {
    squat: 0.045,
    handsUpOffset: 0.04,
    singleHandOffset: 0.005,
    baselineStill: 0.03,
  },
};
