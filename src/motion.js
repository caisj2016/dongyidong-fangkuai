import { MOTION_CONFIG } from "./config.js";
import {
  getPoseMetrics,
  getScreenSideHands,
  isHandsRaised,
  isScreenSideHandRaised,
} from "./calibration.js";

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
    this.confirmCounts = { left: 0, right: 0, squat: 0, rotate: 0 };
    this.cooldowns = { left: 0, right: 0, rotate: 0 };
    this.rearmState = { left: true, right: true, rotate: true };
    this.lastSmoothed = null;
    this.currentAction = "无动作";
  }

  setBaseline(baseline) {
    this.baseline = baseline;
    this.history = [];
    this.confirmCounts = { left: 0, right: 0, squat: 0, rotate: 0 };
    this.cooldowns = { left: 0, right: 0, rotate: 0 };
    this.rearmState = { left: true, right: true, rotate: true };
    this.lastSmoothed = null;
    this.currentAction = "无动作";
  }

  update(landmarks, now = performance.now()) {
    if (!this.baseline) {
      this.currentAction = "无动作";
      return { action: null, softDrop: false, currentAction: this.currentAction };
    }

    const metrics = getPoseMetrics(landmarks);
    if (!metrics) {
      this.currentAction = "无动作";
      this.rearmState = { left: true, right: true, rotate: true };
      this.lastSmoothed = null;
      return { action: null, softDrop: false, currentAction: this.currentAction };
    }

    this.history.push(metrics);
    if (this.history.length > this.config.smoothingWindow) {
      this.history.shift();
    }

    const smoothed = {
      hipCenterY: average(this.history.map((item) => item.hipCenterY)),
      leftWristX: average(this.history.map((item) => item.leftWristX)),
      rightWristX: average(this.history.map((item) => item.rightWristX)),
      leftWristY: average(this.history.map((item) => item.leftWristY)),
      rightWristY: average(this.history.map((item) => item.rightWristY)),
      leftElbowX: average(this.history.map((item) => item.leftElbowX)),
      rightElbowX: average(this.history.map((item) => item.rightElbowX)),
      leftElbowY: average(this.history.map((item) => item.leftElbowY)),
      rightElbowY: average(this.history.map((item) => item.rightElbowY)),
      leftShoulderX: average(this.history.map((item) => item.leftShoulderX)),
      rightShoulderX: average(this.history.map((item) => item.rightShoulderX)),
      leftShoulderY: average(this.history.map((item) => item.leftShoulderY)),
      rightShoulderY: average(this.history.map((item) => item.rightShoulderY)),
    };

    const leftRaised = isScreenSideHandRaised("left", smoothed, this.config.thresholds.singleHandOffset);
    const rightRaised = isScreenSideHandRaised(
      "right",
      smoothed,
      this.config.thresholds.singleHandOffset
    );
    const bothRaised = isHandsRaised(smoothed, this.config.thresholds.handsUpOffset);
    const squatDelta = (smoothed.hipCenterY - this.baseline.hipCenterY) / this.baseline.torsoHeight;

    const last = this.lastSmoothed || smoothed;
    const currentScreenHands = getScreenSideHands(smoothed);
    const lastScreenHands = getScreenSideHands(last);
    const leftRise = lastScreenHands.left.wristY - currentScreenHands.left.wristY;
    const rightRise = lastScreenHands.right.wristY - currentScreenHands.right.wristY;

    const leftLowered =
      currentScreenHands.left.wristY >
      currentScreenHands.left.shoulderY + this.config.thresholds.singleHandOffset * 2;
    const rightLowered =
      currentScreenHands.right.wristY >
      currentScreenHands.right.shoulderY + this.config.thresholds.singleHandOffset * 2;

    if (leftLowered) {
      this.rearmState.left = true;
    }
    if (rightLowered) {
      this.rearmState.right = true;
    }
    if (leftLowered && rightLowered) {
      this.rearmState.rotate = true;
    }

    const leftWaveDetected =
      leftRaised &&
      !bothRaised &&
      this.rearmState.left &&
      leftRise > this.config.thresholds.waveRiseDelta &&
      leftRise >= rightRise;
    const rightWaveDetected =
      rightRaised &&
      !bothRaised &&
      this.rearmState.right &&
      rightRise > this.config.thresholds.waveRiseDelta &&
      rightRise >= leftRise;
    const rotateDetected = bothRaised && this.rearmState.rotate;

    this.updateConfirm("left", leftWaveDetected);
    this.updateConfirm("right", rightWaveDetected);
    this.updateConfirm("rotate", rotateDetected);
    this.updateConfirm("squat", squatDelta > this.config.thresholds.squat);

    const singleAction = this.consumeSingleAction(now);
    const softDrop = this.confirmCounts.squat >= this.config.confirmFrames.squat;

    if (singleAction) {
      this.currentAction = this.label(singleAction);
      if (singleAction === "left") {
        this.rearmState.left = false;
      } else if (singleAction === "right") {
        this.rearmState.right = false;
      } else if (singleAction === "rotate") {
        this.rearmState.rotate = false;
      }
    } else if (softDrop) {
      this.currentAction = "下蹲";
    } else {
      this.currentAction = "无动作";
    }

    this.lastSmoothed = smoothed;

    return {
      action: singleAction,
      softDrop,
      currentAction: this.currentAction,
    };
  }

  updateConfirm(key, detected) {
    this.confirmCounts[key] = detected ? this.confirmCounts[key] + 1 : 0;
  }

  consumeSingleAction(now) {
    const candidates = [
      { key: "rotate", label: "rotate" },
      { key: "left", label: "left" },
      { key: "right", label: "right" },
    ];

    for (const candidate of candidates) {
      const confirmFrame = this.config.confirmFrames[candidate.key];
      const cooldown = this.cooldowns[candidate.key] || 0;
      if (this.confirmCounts[candidate.key] >= confirmFrame && now >= cooldown) {
        this.cooldowns[candidate.key] = now + this.config.cooldowns[candidate.key];
        this.confirmCounts[candidate.key] = 0;
        return candidate.label;
      }
    }

    return null;
  }

  label(action) {
    return {
      left: "左移",
      right: "右移",
      rotate: "旋转",
    }[action] || "无动作";
  }
}
