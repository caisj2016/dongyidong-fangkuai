import { CALIBRATION_STEPS, MOTION_CONFIG } from "./config.js";

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getPoint(landmarks, index) {
  return landmarks[index] || { x: 0, y: 0, visibility: 0 };
}

export function getPoseMetrics(landmarks) {
  if (!landmarks || !landmarks.length) return null;

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
  const torsoHeight = Math.max(0.05, hipCenterY - shoulderCenterY);

  return {
    shoulderCenterX,
    hipCenterX,
    shoulderCenterY,
    hipCenterY,
    torsoHeight,
    leftWristY: leftWrist.y,
    rightWristY: rightWrist.y,
    leftElbowY: leftElbow.y,
    rightElbowY: rightElbow.y,
    leftShoulderY: leftShoulder.y,
    rightShoulderY: rightShoulder.y,
  };
}

export function getLeanDelta(metrics) {
  return (metrics.shoulderCenterX - metrics.hipCenterX) / metrics.torsoHeight;
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
    this.steps = CALIBRATION_STEPS;
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

    if (this.samples.length < 20) {
      this.stepRecognized = false;
      return;
    }

    const hips = this.samples.map((item) => item.hipCenterY);
    const shoulders = this.samples.map((item) => item.shoulderCenterY);
    const leanValues = this.samples.map((item) => getLeanDelta(item));
    const hipRange = Math.max(...hips) - Math.min(...hips);
    const shoulderRange = Math.max(...shoulders) - Math.min(...shoulders);
    const leanRange = Math.max(...leanValues) - Math.min(...leanValues);

    if (
      hipRange < MOTION_CONFIG.thresholds.baselineStill &&
      shoulderRange < MOTION_CONFIG.thresholds.baselineStill &&
      leanRange < MOTION_CONFIG.neutralZone
    ) {
      this.baseline = {
        shoulderCenterY: average(shoulders),
        hipCenterY: average(hips),
        torsoHeight: average(this.samples.map((item) => item.torsoHeight)),
      };
      this.stepRecognized = true;
    } else {
      this.stepRecognized = false;
    }
  }

  evaluateStep(step, metrics) {
    this.samples.push(metrics);
    if (this.samples.length > 8) {
      this.samples.shift();
    }

    const smoothed = {
      shoulderCenterX: average(this.samples.map((item) => item.shoulderCenterX)),
      hipCenterX: average(this.samples.map((item) => item.hipCenterX)),
      shoulderCenterY: average(this.samples.map((item) => item.shoulderCenterY)),
      hipCenterY: average(this.samples.map((item) => item.hipCenterY)),
      torsoHeight: average(this.samples.map((item) => item.torsoHeight)),
      leftWristY: average(this.samples.map((item) => item.leftWristY)),
      rightWristY: average(this.samples.map((item) => item.rightWristY)),
      leftElbowY: average(this.samples.map((item) => item.leftElbowY)),
      rightElbowY: average(this.samples.map((item) => item.rightElbowY)),
      leftShoulderY: average(this.samples.map((item) => item.leftShoulderY)),
      rightShoulderY: average(this.samples.map((item) => item.rightShoulderY)),
    };

    const lean = getLeanDelta(smoothed);

    if (step === "leanLeft") {
      this.stepRecognized = lean < -MOTION_CONFIG.thresholds.lean;
      return;
    }

    if (step === "leanRight") {
      this.stepRecognized = lean > MOTION_CONFIG.thresholds.lean;
      return;
    }

    if (step === "squat") {
      const squatDelta =
        (smoothed.shoulderCenterY - this.baseline.shoulderCenterY) / this.baseline.torsoHeight;
      this.stepRecognized = squatDelta > MOTION_CONFIG.thresholds.squat;
      return;
    }

    if (step === "handsUp") {
      this.stepRecognized = isHandsRaised(smoothed, MOTION_CONFIG.thresholds.handsUpOffset);
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
