import { MOTION_CONFIG } from "./config.js";

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getPoint(landmarks, index) {
  return landmarks[index] || { x: 0, y: 0, visibility: 0 };
}

function getCalibrationSteps(layoutMode) {
  return [
    {
      key: "baseline",
      text: "站在画面中间保持不动",
      tip: "头和肩膀保持自然放松，系统会记录你的基础姿势。",
    },
    {
      key: "headLeft",
      text: "头部向左侧偏一次",
      tip: "像活动颈椎一样，把头明显偏向屏幕左侧，再回到中间。",
    },
    {
      key: "headRight",
      text: "头部向右侧偏一次",
      tip: "像活动颈椎一样，把头明显偏向屏幕右侧，再回到中间。",
    },
    {
      key: "headDown",
      text: "低头一次",
      tip: "像放松颈椎一样轻轻低头，游戏里会用来快速下降。",
    },
    {
      key: "headUp",
      text: "抬头一次",
      tip: "把下巴轻轻抬起一点，游戏里会用来变形旋转。",
    },
  ];
}

export function getPoseMetrics(landmarks) {
  if (!landmarks || !landmarks.length) return null;

  const nose = getPoint(landmarks, 0);
  const leftShoulder = getPoint(landmarks, 11);
  const rightShoulder = getPoint(landmarks, 12);
  const leftHip = getPoint(landmarks, 23);
  const rightHip = getPoint(landmarks, 24);
  const leftWrist = getPoint(landmarks, 15);
  const rightWrist = getPoint(landmarks, 16);
  const leftElbow = getPoint(landmarks, 13);
  const rightElbow = getPoint(landmarks, 14);

  const shoulderCenterX = average([leftShoulder.x, rightShoulder.x]);
  const hipCenterX = average([leftHip.x, rightHip.x]);
  const shoulderCenterY = average([leftShoulder.y, rightShoulder.y]);
  const hipCenterY = average([leftHip.y, rightHip.y]);

  return {
    noseX: nose.x,
    noseY: nose.y,
    shoulderCenterX,
    hipCenterX,
    shoulderCenterY,
    hipCenterY,
    leftWristY: leftWrist.y,
    rightWristY: rightWrist.y,
    leftElbowY: leftElbow.y,
    rightElbowY: rightElbow.y,
    leftShoulderY: leftShoulder.y,
    rightShoulderY: rightShoulder.y,
  };
}

export function getLeanDelta(metrics) {
  const displayShoulderCenterX = 1 - metrics.shoulderCenterX;
  const displayHipCenterX = 1 - metrics.hipCenterX;
  return displayShoulderCenterX - displayHipCenterX;
}

export function getHeadOffset(metrics) {
  const displayNoseX = 1 - metrics.noseX;
  const displayShoulderCenterX = 1 - metrics.shoulderCenterX;
  return displayNoseX - displayShoulderCenterX;
}

export function getHeadVerticalOffset(metrics) {
  return metrics.noseY - metrics.shoulderCenterY;
}

export function isSingleHandRaised(side, metrics, offset) {
  if (side === "left") {
    return (
      metrics.leftWristY < metrics.leftShoulderY - offset ||
      (metrics.leftWristY < metrics.leftShoulderY + offset &&
        metrics.leftElbowY < metrics.leftShoulderY + offset * 1.5)
    );
  }

  return (
    metrics.rightWristY < metrics.rightShoulderY - offset ||
    (metrics.rightWristY < metrics.rightShoulderY + offset &&
      metrics.rightElbowY < metrics.rightShoulderY + offset * 1.5)
  );
}

export function isHandsRaised(metrics, offset) {
  return (
    isSingleHandRaised("left", metrics, offset) &&
    isSingleHandRaised("right", metrics, offset)
  );
}

export class CalibrationController {
  constructor() {
    this.layoutMode = "desktop";
    this.steps = getCalibrationSteps(this.layoutMode);
    this.reset();
  }

  setLayoutMode(layoutMode) {
    const nextMode = layoutMode === "mobile" ? "mobile" : "desktop";
    if (nextMode === this.layoutMode) return;
    this.layoutMode = nextMode;
    this.steps = getCalibrationSteps(this.layoutMode);
    this.reset();
  }

  reset() {
    this.currentStepIndex = 0;
    this.stepRecognized = false;
    this.samples = [];
    this.baseline = null;
  }

  getCurrentStep() {
    return this.steps[this.currentStepIndex];
  }

  getState() {
    const step = this.getCurrentStep();
    return {
      index: this.currentStepIndex,
      total: this.steps.length,
      text: step.text,
      tip: step.tip,
      recognized: this.stepRecognized,
      isLast: this.currentStepIndex === this.steps.length - 1,
    };
  }

  processLandmarks(landmarks) {
    if (this.stepRecognized) {
      return this.getState();
    }

    const metrics = getPoseMetrics(landmarks);
    if (!metrics) {
      this.samples = [];
      this.stepRecognized = false;
      return this.getState();
    }

    const step = this.getCurrentStep().key;
    if (step === "baseline") {
      this.collectBaseline(metrics);
    } else if (this.baseline) {
      this.evaluateStep(step, metrics);
    }

    return this.getState();
  }

  collectBaseline(metrics) {
    this.samples.push(metrics);
    if (this.samples.length > 25) {
      this.samples.shift();
    }

    const isMobile = this.layoutMode === "mobile";
    const requiredSamples = isMobile ? 10 : 20;

    if (this.samples.length < requiredSamples) {
      this.stepRecognized = false;
      return;
    }

    const shoulders = this.samples.map((item) => item.shoulderCenterY);
    const nosesY = this.samples.map((item) => item.noseY);
    const headOffsets = this.samples.map((item) => getHeadOffset(item));
    const shoulderRange = Math.max(...shoulders) - Math.min(...shoulders);
    const noseRange = Math.max(...nosesY) - Math.min(...nosesY);
    const headRange = Math.max(...headOffsets) - Math.min(...headOffsets);
    const shoulderStillThreshold = isMobile
      ? MOTION_CONFIG.thresholds.baselineStill * 2
      : MOTION_CONFIG.thresholds.baselineStill;
    const headStillThreshold = isMobile
      ? MOTION_CONFIG.neutralZone * 1.5
      : MOTION_CONFIG.neutralZone;
    const noseStillThreshold = isMobile ? 0.05 : MOTION_CONFIG.thresholds.baselineStill;
    const isStable = isMobile
      ? noseRange < noseStillThreshold && headRange < headStillThreshold
      : shoulderRange < shoulderStillThreshold && headRange < headStillThreshold;

    if (isStable) {
      this.baseline = {
        noseY: average(nosesY),
        shoulderCenterY: average(shoulders),
        headOffset: average(headOffsets),
        headVerticalOffset: average(this.samples.map((item) => getHeadVerticalOffset(item))),
      };
      this.stepRecognized = true;
    } else {
      this.stepRecognized = false;
    }
  }

  evaluateStep(step, metrics) {
    this.samples.push(metrics);
    const maxSamples =
      step === "headLeft" ||
      step === "headRight" ||
      step === "headDown" ||
      step === "headUp"
        ? 3
        : 8;
    if (this.samples.length > maxSamples) {
      this.samples.shift();
    }

    const smoothed = {
      noseX: average(this.samples.map((item) => item.noseX)),
      noseY: average(this.samples.map((item) => item.noseY)),
      shoulderCenterX: average(this.samples.map((item) => item.shoulderCenterX)),
      hipCenterX: average(this.samples.map((item) => item.hipCenterX)),
      shoulderCenterY: average(this.samples.map((item) => item.shoulderCenterY)),
      leftWristY: average(this.samples.map((item) => item.leftWristY)),
      rightWristY: average(this.samples.map((item) => item.rightWristY)),
      leftElbowY: average(this.samples.map((item) => item.leftElbowY)),
      rightElbowY: average(this.samples.map((item) => item.rightElbowY)),
      leftShoulderY: average(this.samples.map((item) => item.leftShoulderY)),
      rightShoulderY: average(this.samples.map((item) => item.rightShoulderY)),
    };

    const headOffset = getHeadOffset(smoothed) - (this.baseline?.headOffset || 0);

    if (step === "headLeft") {
      this.stepRecognized = headOffset < -MOTION_CONFIG.thresholds.headOffset;
      return;
    }

    if (step === "headRight") {
      this.stepRecognized = headOffset > MOTION_CONFIG.thresholds.headOffset;
      return;
    }

    const headVerticalOffset =
      getHeadVerticalOffset(smoothed) - (this.baseline.headVerticalOffset || 0);
    const headDownDelta = headVerticalOffset;
    const headUpDelta = -headVerticalOffset;
    const shoulderDropDelta = smoothed.shoulderCenterY - this.baseline.shoulderCenterY;
    const firstSample = this.samples[0];
    const lastSample = this.samples[this.samples.length - 1];
    const noseDropTrend = firstSample && lastSample ? lastSample.noseY - firstSample.noseY : 0;
    const shoulderDropTrend =
      firstSample && lastSample ? lastSample.shoulderCenterY - firstSample.shoulderCenterY : 0;

    if (step === "headDown") {
      this.stepRecognized =
        headDownDelta > MOTION_CONFIG.thresholds.headDown ||
        shoulderDropDelta > MOTION_CONFIG.thresholds.headDown * 0.8 ||
        noseDropTrend > MOTION_CONFIG.thresholds.headDown * 0.75 ||
        shoulderDropTrend > MOTION_CONFIG.thresholds.headDown * 0.5 ||
        smoothed.noseY > smoothed.leftShoulderY - 0.01 ||
        smoothed.noseY > smoothed.rightShoulderY - 0.01;
      return;
    }

    if (step === "headUp") {
      this.stepRecognized = headUpDelta > MOTION_CONFIG.thresholds.headUp;
      return;
    }

  }

  goToNextStep() {
    if (!this.stepRecognized) return this.getState();
    this.currentStepIndex = Math.min(this.currentStepIndex + 1, this.steps.length - 1);
    this.stepRecognized = false;
    this.samples = [];
    return this.getState();
  }

  isComplete() {
    return this.currentStepIndex === this.steps.length - 1 && this.stepRecognized;
  }

  getBaseline() {
    return this.baseline;
  }
}
