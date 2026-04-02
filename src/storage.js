import { STORAGE_KEY } from "./config.js";

export function getHighScore() {
  const value = window.localStorage.getItem(STORAGE_KEY);
  const score = Number.parseInt(value || "0", 10);
  return Number.isFinite(score) ? score : 0;
}

export function saveHighScore(score) {
  const safeScore = Number.isFinite(score) ? Math.max(0, Math.floor(score)) : 0;
  window.localStorage.setItem(STORAGE_KEY, String(safeScore));
}
