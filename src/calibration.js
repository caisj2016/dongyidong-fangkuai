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

  const shoulderCenterY = average([leftShoulder.y, rightShoulder.y]);
  const hipCenterY = average([leftHip.y, rightHip.y]);
  const torsoHeight = Math.max(0.05, hipCenterY - shoulderCenterY);

  return {
    shoulderCenterY,
    hipCenterY,
    torsoHeight,
    leftShoulderX: leftShoulder.x,
    rightShoulderX: rightShoulder.x,
    leftWristY: leftWrist.y,
    rightWristY: rightWrist.y,
    leftWristX: leftWrist.x,
    rightWristX: rightWrist.x,
    leftElbowY: leftElbow.y,
    rightElbowY: rightElbow.y,
    leftElbowX: leftElbow.x,
    rightElbowX: rightElbow.x,
    leftShoulderY: leftShoulder.y,
    rightShoulderY: rightShoulder.y,
    leftHipY: leftHip.y,
    rightHipY: rightHip.y,
  };
}

export function getScreenSideHands(metrics) {
  const leftDisplayX = 1 - metrics.leftWristX;
  const rightDisplayX = 1 - metrics.rightWristX;
  const leftIsScreenRight = leftDisplayX >= rightDisplayX;

  if (leftIsScreenRight) {
    return {
      left: {
        wristY: metrics.rightWristY,
        elbowY: metrics.rightElbowY,
        shoulderY: metrics.rightShoulderY,
      },
      right: {
        wristY: metrics.leftWristY,
        elbowY: metrics.leftElbowY,
        shoulderY: metrics.leftShoulderY,
      },
    };
  }

  return {
    left: {
      wristY: metrics.leftWristY,
      elbowY: metrics.leftElbowY,
      shoulderY: metrics.leftShoulderY,
    },
    right: {
      wristY: metrics.rightWristY,
      elbowY: metrics.rightElbowY,
      shoulderY: metrics.rightShoulderY,
    },
  };
}

export function isSingleHandRaised(side, metrics, offset) {
  if (side === "left") {
    return (
      metrics.leftWristY < metrics.leftShoulderY - offset ||
      (metrics.leftWristY < metrics.leftShoulderY + offset &&
        metrics.leftElbowY < metrics.leftShoulderY + offset * 2)
    );
  }

  return (
    metrics.rightWristY < metrics.rightShoulderY - offset ||
    (metrics.rightWristY < metrics.rightShoulderY + offset &&
      metrics.rightElbowY < metrics.rightShoulderY + offset * 2)
  );
}

export function isHandsRaised(metrics, offset) {
  return (
    isSingleHandRaised("left", metrics, offset) &&
    isSingleHandRaised("right", metrics, offset)
  );
}

export function isScreenSideHandRaised(side, metrics, offset) {
  const screenHands = getScreenSideHands(metrics);
  const hand = side === "right" ? screenHands.right : screenHands.left;

  return (
    hand.wristY < hand.shoulderY - offset ||
    (hand.wristY < hand.shoulderY + offset && hand.elbowY < hand.shoulderY + offset * 2)
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
    const hipRange = Math.max(...hips) - Math.min(...hips);
    const shoulderRange = Math.max(...shoulders) - Math.min(...shoulders);

    if (
      hipRange < MOTION_CONFIG.thresholds.baselineStill &&
      shoulderRange < MOTION_CONFIG.thresholds.baselineStill
    ) {
      this.baseline = {
        hipCenterY: average(hips),
        shoulderCenterY: average(shoulders),
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

    const avgHipY = average(this.samples.map((item) => item.hipCenterY));
    const avgLeftWristY = average(this.samples.map((item) => item.leftWristY));
    const avgRightWristY = average(this.samples.map((item) => item.rightWristY));
    const avgLeftElbowY = average(this.samples.map((item) => item.leftElbowY));
    const avgRightElbowY = average(this.samples.map((item) => item.rightElbowY));
    const avgLeftShoulderY = average(this.samples.map((item) => item.leftShoulderY));
    const avgRightShoulderY = average(this.samples.map((item) => item.rightShoulderY));

    const handMetrics = {
      leftWristX: average(this.samples.map((item) => item.leftWristX)),
      rightWristX: average(this.samples.map((item) => item.rightWristX)),
      leftWristY: avgLeftWristY,
      rightWristY: avgRightWristY,
      leftElbowX: average(this.samples.map((item) => item.leftElbowX)),
      rightElbowX: average(this.samples.map((item) => item.rightElbowX)),
      leftElbowY: avgLeftElbowY,
      rightElbowY: avgRightElbowY,
      leftShoulderX: average(this.samples.map((item) => item.leftShoulderX)),
      rightShoulderX: average(this.samples.map((item) => item.rightShoulderX)),
      leftShoulderY: avgLeftShoulderY,
      rightShoulderY: avgRightShoulderY,
    };

    if (step === "leftHand") {
      this.stepRecognized = isScreenSideHandRaised(
        "left",
        handMetrics,
        MOTION_CONFIG.thresholds.singleHandOffset
      );
      return;
    }

    if (step === "rightHand") {
      this.stepRecognized = isScreenSideHandRaised(
        "right",
        handMetrics,
        MOTION_CONFIG.thresholds.singleHandOffset
      );
      return;
    }

    if (step === "squat") {
      const squatDelta = (avgHipY - this.baseline.hipCenterY) / this.baseline.torsoHeight;
      this.stepRecognized = squatDelta > MOTION_CONFIG.thresholds.squat;
      return;
    }

    if (step === "handsUp") {
      this.stepRecognized = isHandsRaised(handMetrics, MOTION_CONFIG.thresholds.handsUpOffset);
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
