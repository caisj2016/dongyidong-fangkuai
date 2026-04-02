import { MOTION_CONFIG } from "./config.js";
import { getLeanDelta, getPoseMetrics, isHandsRaised } from "./calibration.js";

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export class MotionMapper {
  constructor() {
    this.config = MOTION_CONFIG;
    this.reset();
  }

  reset() {
    this.baseline = null;
    this.history = [];
    this.cooldowns = { left: 0, right: 0, rotate: 0 };
    this.moveState = "neutral";
    this.rotateHoldStartedAt = 0;
    this.rotateArmed = true;
    this.squatHoldStartedAt = 0;
    this.currentAction = "无动作";
  }

  setBaseline(baseline) {
    this.baseline = baseline;
    this.history = [];
    this.cooldowns = { left: 0, right: 0, rotate: 0 };
    this.moveState = "neutral";
    this.rotateHoldStartedAt = 0;
    this.rotateArmed = true;
    this.squatHoldStartedAt = 0;
    this.currentAction = "无动作";
  }

  update(landmarks, now = performance.now()) {
    if (!this.baseline) {
      this.currentAction = "无动作";
      return { action: null, softDrop: false, currentAction: this.currentAction };
    }

    const metrics = getPoseMetrics(landmarks);
    if (!metrics) {
      this.history = [];
      this.moveState = "neutral";
      this.rotateHoldStartedAt = 0;
      this.rotateArmed = true;
      this.squatHoldStartedAt = 0;
      this.currentAction = "无动作";
      return { action: null, softDrop: false, currentAction: this.currentAction };
    }

    this.history.push(metrics);
    if (this.history.length > this.config.smoothingWindow) {
      this.history.shift();
    }

    const smoothed = {
      shoulderCenterX: average(this.history.map((item) => item.shoulderCenterX)),
      hipCenterX: average(this.history.map((item) => item.hipCenterX)),
      shoulderCenterY: average(this.history.map((item) => item.shoulderCenterY)),
      hipCenterY: average(this.history.map((item) => item.hipCenterY)),
      torsoHeight: average(this.history.map((item) => item.torsoHeight)),
      leftWristY: average(this.history.map((item) => item.leftWristY)),
      rightWristY: average(this.history.map((item) => item.rightWristY)),
      leftElbowY: average(this.history.map((item) => item.leftElbowY)),
      rightElbowY: average(this.history.map((item) => item.rightElbowY)),
      leftShoulderY: average(this.history.map((item) => item.leftShoulderY)),
      rightShoulderY: average(this.history.map((item) => item.rightShoulderY)),
    };

    const lean = getLeanDelta(smoothed);
    let action = null;

    if (Math.abs(lean) < this.config.neutralZone) {
      this.moveState = "neutral";
    } else if (
      lean > this.config.thresholds.lean &&
      this.moveState === "neutral" &&
      now >= this.cooldowns.right
    ) {
      action = "right";
      this.moveState = "right";
      this.cooldowns.right = now + this.config.cooldowns.right;
    } else if (
      lean < -this.config.thresholds.lean &&
      this.moveState === "neutral" &&
      now >= this.cooldowns.left
    ) {
      action = "left";
      this.moveState = "left";
      this.cooldowns.left = now + this.config.cooldowns.left;
    }

    const bothHandsUp = isHandsRaised(smoothed, this.config.thresholds.handsUpOffset);
    if (bothHandsUp) {
      if (!this.rotateHoldStartedAt) {
        this.rotateHoldStartedAt = now;
      }
    } else {
      this.rotateHoldStartedAt = 0;
      this.rotateArmed = true;
    }

    if (
      !action &&
      bothHandsUp &&
      this.rotateArmed &&
      now >= this.cooldowns.rotate &&
      now - this.rotateHoldStartedAt >= this.config.holds.rotate
    ) {
      action = "rotate";
      this.rotateArmed = false;
      this.cooldowns.rotate = now + this.config.cooldowns.rotate;
    }

    const squatDelta =
      (smoothed.shoulderCenterY - this.baseline.shoulderCenterY) / this.baseline.torsoHeight;
    if (squatDelta > this.config.thresholds.squat) {
      if (!this.squatHoldStartedAt) {
        this.squatHoldStartedAt = now;
      }
    } else {
      this.squatHoldStartedAt = 0;
    }

    const softDrop =
      this.squatHoldStartedAt > 0 &&
      now - this.squatHoldStartedAt >= this.config.holds.squat;

    if (action) {
      this.currentAction = this.label(action);
    } else if (softDrop) {
      this.currentAction = "下蹲";
    } else if (Math.abs(lean) >= this.config.thresholds.lean) {
      this.currentAction = lean > 0 ? "右倾" : "左倾";
    } else {
      this.currentAction = "无动作";
    }

    return {
      action,
      softDrop,
      currentAction: this.currentAction,
    };
  }

  label(action) {
    return {
      left: "左移",
      right: "右移",
      rotate: "旋转",
    }[action] || "无动作";
  }
}
