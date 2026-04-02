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
    tip: "请正对镜头站稳 2 秒，系统会记录你的基础站姿。",
  },
  {
    key: "leanLeft",
    text: "身体明显向左倾一次",
    tip: "肩膀整体向屏幕左侧倾斜一下，再回到中间。",
  },
  {
    key: "leanRight",
    text: "身体明显向右倾一次",
    tip: "肩膀整体向屏幕右侧倾斜一下，再回到中间。",
  },
  {
    key: "squat",
    text: "下蹲一次",
    tip: "做一个明显下蹲动作并保持一下，用来验证加速下落。",
  },
  {
    key: "handsUp",
    text: "双手举起",
    tip: "双手同时举过肩膀并保持一下，用来验证旋转动作。",
  },
];

export const MOTION_CONFIG = {
  smoothingWindow: 3,
  neutralZone: 0.04,
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
    lean: 0.1,
    squat: 0.12,
    handsUpOffset: 0.04,
    singleHandOffset: 0.05,
    baselineStill: 0.03,
  },
};
