import { MOTION_CONFIG } from "./config.js";
import {
  getHeadOffset,
  getHeadVerticalOffset,
  getLeanDelta,
  getPoseMetrics,
  isHandsRaised,
} from "./calibration.js";

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export class MotionMapper {
  constructor() {
    this.config = MOTION_CONFIG;
    this.layoutMode = "desktop";
    this.reset();
  }

  setLayoutMode(layoutMode) {
    this.layoutMode = layoutMode === "mobile" ? "mobile" : "desktop";
  }

  reset() {
    this.baseline = null;
    this.history = [];
    this.cooldowns = { left: 0, right: 0, rotate: 0 };
    this.moveState = "neutral";
    this.rotateHoldStartedAt = 0;
    this.rotateArmed = true;
    this.dropHoldStartedAt = 0;
    this.currentAction = "无动作";
  }

  setBaseline(baseline) {
    this.baseline = baseline;
    this.history = [];
    this.cooldowns = { left: 0, right: 0, rotate: 0 };
    this.moveState = "neutral";
    this.rotateHoldStartedAt = 0;
    this.rotateArmed = true;
    this.dropHoldStartedAt = 0;
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
      this.dropHoldStartedAt = 0;
      this.currentAction = "无动作";
      return { action: null, softDrop: false, currentAction: this.currentAction };
    }

    this.history.push(metrics);
    if (this.history.length > this.config.smoothingWindow) {
      this.history.shift();
    }

    const smoothed = {
      noseX: average(this.history.map((item) => item.noseX)),
      noseY: average(this.history.map((item) => item.noseY)),
      shoulderCenterX: average(this.history.map((item) => item.shoulderCenterX)),
      hipCenterX: average(this.history.map((item) => item.hipCenterX)),
      shoulderCenterY: average(this.history.map((item) => item.shoulderCenterY)),
      leftWristY: average(this.history.map((item) => item.leftWristY)),
      rightWristY: average(this.history.map((item) => item.rightWristY)),
      leftElbowY: average(this.history.map((item) => item.leftElbowY)),
      rightElbowY: average(this.history.map((item) => item.rightElbowY)),
      leftShoulderY: average(this.history.map((item) => item.leftShoulderY)),
      rightShoulderY: average(this.history.map((item) => item.rightShoulderY)),
    };

    const lateralOffset = getHeadOffset(smoothed) - (this.baseline.headOffset || 0);
    const moveThreshold = this.config.thresholds.headOffset;
    const rearmThreshold = Math.max(this.config.neutralZone, moveThreshold * 0.45);

    let action = null;

    if (Math.abs(lateralOffset) < rearmThreshold) {
      this.moveState = "neutral";
    }

    if (lateralOffset > moveThreshold && now >= this.cooldowns.right) {
      action = "right";
      this.moveState = "right";
      this.cooldowns.right = now + this.config.cooldowns.right;
    } else if (lateralOffset < -moveThreshold && now >= this.cooldowns.left) {
      action = "left";
      this.moveState = "left";
      this.cooldowns.left = now + this.config.cooldowns.left;
    }

    let softDrop = false;

    const headVerticalOffset =
      getHeadVerticalOffset(smoothed) - (this.baseline.headVerticalOffset || 0);
    const isMobile = this.layoutMode === "mobile";
    const headDownThreshold = isMobile
      ? this.config.thresholds.headDown * 1.75
      : this.config.thresholds.headDown;
    const dropHoldDuration = isMobile
      ? this.config.holds.squat + 100
      : this.config.holds.squat;
    const headDownDelta = headVerticalOffset;
    const headUpDelta = -headVerticalOffset;
    const headDownActive = headDownDelta > headDownThreshold;
    const headUpActive = headUpDelta > this.config.thresholds.headUp;

    if (headDownActive) {
      if (!this.dropHoldStartedAt) {
        this.dropHoldStartedAt = now;
      }
    } else {
      this.dropHoldStartedAt = 0;
    }

    softDrop =
      headDownActive &&
      this.dropHoldStartedAt > 0 &&
      now - this.dropHoldStartedAt >= dropHoldDuration;

    if (headUpActive) {
      if (!this.rotateHoldStartedAt) {
        this.rotateHoldStartedAt = now;
      }
    } else {
      this.rotateHoldStartedAt = 0;
      this.rotateArmed = true;
    }

    if (
      !action &&
      headUpActive &&
      this.rotateArmed &&
      now >= this.cooldowns.rotate &&
      now - this.rotateHoldStartedAt >= this.config.holds.rotate
    ) {
      action = "rotate";
      this.rotateArmed = false;
      this.cooldowns.rotate = now + this.config.cooldowns.rotate;
    }

    if (action) {
      this.currentAction = this.label(action);
    } else if (softDrop) {
      this.currentAction = "低头快降";
    } else if (Math.abs(lateralOffset) >= moveThreshold) {
      this.currentAction = lateralOffset > 0 ? "向右偏头" : "向左偏头";
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
