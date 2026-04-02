import { MOTION_CONFIG } from "./config.js";
import { getPoseMetrics, isHandsRaised, isSingleHandRaised } from "./calibration.js";

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
    this.raisedState = { left: false, right: false, both: false };
    this.rearmState = { left: true, right: true, rotate: true };
    this.currentAction = "无动作";
  }

  setBaseline(baseline) {
    this.baseline = baseline;
    this.history = [];
    this.confirmCounts = { left: 0, right: 0, squat: 0, rotate: 0 };
    this.cooldowns = { left: 0, right: 0, rotate: 0 };
    this.raisedState = { left: false, right: false, both: false };
    this.rearmState = { left: true, right: true, rotate: true };
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
      this.raisedState = { left: false, right: false, both: false };
      this.rearmState = { left: true, right: true, rotate: true };
      return { action: null, softDrop: false, currentAction: this.currentAction };
    }

    this.history.push(metrics);
    if (this.history.length > this.config.smoothingWindow) {
      this.history.shift();
    }

    const smoothed = {
      hipCenterY: average(this.history.map((item) => item.hipCenterY)),
      leftWristY: average(this.history.map((item) => item.leftWristY)),
      rightWristY: average(this.history.map((item) => item.rightWristY)),
      leftElbowY: average(this.history.map((item) => item.leftElbowY)),
      rightElbowY: average(this.history.map((item) => item.rightElbowY)),
      leftShoulderY: average(this.history.map((item) => item.leftShoulderY)),
      rightShoulderY: average(this.history.map((item) => item.rightShoulderY)),
    };

    const leftRaised = isSingleHandRaised("left", smoothed, this.config.thresholds.singleHandOffset);
    const rightRaised = isSingleHandRaised(
      "right",
      smoothed,
      this.config.thresholds.singleHandOffset
    );
    const bothRaised = isHandsRaised(smoothed, this.config.thresholds.handsUpOffset);
    const squatDelta = (smoothed.hipCenterY - this.baseline.hipCenterY) / this.baseline.torsoHeight;

    const dominantLeft =
      smoothed.leftWristY <= smoothed.rightWristY - this.config.thresholds.singleHandOffset / 3;
    const dominantRight =
      smoothed.rightWristY <= smoothed.leftWristY - this.config.thresholds.singleHandOffset / 3;

    const leftLowered =
      smoothed.leftWristY > smoothed.leftShoulderY + this.config.thresholds.singleHandOffset * 0.5;
    const rightLowered =
      smoothed.rightWristY > smoothed.rightShoulderY + this.config.thresholds.singleHandOffset * 0.5;
    const bothLowered = leftLowered && rightLowered;

    if (leftLowered) {
      this.rearmState.left = true;
    }
    if (rightLowered) {
      this.rearmState.right = true;
    }
    if (bothLowered) {
      this.rearmState.rotate = true;
    }

    const leftEdge =
      leftRaised &&
      !bothRaised &&
      (dominantLeft || !rightRaised || this.raisedState.right) &&
      this.rearmState.left;
    const rightEdge =
      rightRaised &&
      !bothRaised &&
      (dominantRight || !leftRaised || this.raisedState.left) &&
      this.rearmState.right;
    const rotateDetected = bothRaised && this.rearmState.rotate;

    this.updateConfirm("left", leftEdge);
    this.updateConfirm("right", rightEdge);
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

    this.raisedState = {
      left: leftRaised,
      right: rightRaised,
      both: bothRaised,
    };

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
