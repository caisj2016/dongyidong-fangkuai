import { MOTION_CONFIG } from "./config.js";

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getPoint(landmarks, index) {
  return landmarks[index] || { x: 0, y: 0, visibility: 0 };
}

function averageDefined(values) {
  const validValues = values.filter((value) => Number.isFinite(value) && value > 0 && value < 1);
  if (!validValues.length) return 0;
  return average(validValues);
}

function getRelativeThreshold(targetDelta, fallbackThreshold, ratio = 0.55, minRatio = 0.3) {
  if (!Number.isFinite(targetDelta) || targetDelta <= 0) {
    return fallbackThreshold;
  }

  return Math.min(fallbackThreshold, Math.max(fallbackThreshold * minRatio, targetDelta * ratio));
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
  const leftEye = getPoint(landmarks, 2);
  const rightEye = getPoint(landmarks, 5);
  const leftEar = getPoint(landmarks, 7);
  const rightEar = getPoint(landmarks, 8);
  const mouthLeft = getPoint(landmarks, 9);
  const mouthRight = getPoint(landmarks, 10);
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
  const upperFaceY = averageDefined([leftEye.y, rightEye.y, leftEar.y, rightEar.y]);
  const mouthCenterY = averageDefined([mouthLeft.y, mouthRight.y]);

  return {
    noseX: nose.x,
    noseY: nose.y,
    upperFaceY,
    mouthCenterY,
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

export function getFacePitch(metrics) {
  if (!metrics) return 0;

  const upperFaceY = metrics.upperFaceY;
  const mouthCenterY = metrics.mouthCenterY;

  if (
    !Number.isFinite(upperFaceY) ||
    !Number.isFinite(mouthCenterY) ||
    upperFaceY <= 0 ||
    mouthCenterY <= 0 ||
    mouthCenterY <= upperFaceY
  ) {
    return 0;
  }

  const faceHeight = Math.max(0.001, mouthCenterY - upperFaceY);
  return (metrics.noseY - upperFaceY) / faceHeight;
}

export function getHeadMotionMetrics(smoothed, baseline, samples = []) {
  const headVerticalOffset =
    getHeadVerticalOffset(smoothed) - (baseline?.headVerticalOffset || 0);
  const facePitchDelta = getFacePitch(smoothed) - (baseline?.facePitch || 0);
  const firstSample = samples[0];
  const lastSample = samples[samples.length - 1];
  const noseLiftTrend = firstSample && lastSample ? firstSample.noseY - lastSample.noseY : 0;
  const facePitchTrend =
    firstSample && lastSample ? getFacePitch(lastSample) - getFacePitch(firstSample) : 0;
  const shoulderLiftTrend =
    firstSample && lastSample ? firstSample.shoulderCenterY - lastSample.shoulderCenterY : 0;

  return {
    headVerticalOffset,
    headDownDelta: headVerticalOffset,
    headUpDelta: -headVerticalOffset,
    facePitchDelta,
    facePitchDownDelta: facePitchDelta,
    facePitchUpDelta: -facePitchDelta,
    facePitchTrend,
    noseLiftTrend,
    shoulderLiftTrend,
  };
}

export function isHeadUpDetected(
  smoothed,
  baseline,
  samples = [],
  threshold = MOTION_CONFIG.thresholds.headUp,
  faceThreshold = MOTION_CONFIG.thresholds.facePitchUp
) {
  const { headUpDelta, noseLiftTrend, facePitchUpDelta, facePitchTrend } = getHeadMotionMetrics(
    smoothed,
    baseline,
    samples
  );
  return (
    facePitchUpDelta > faceThreshold ||
    facePitchTrend < -faceThreshold * 0.7 ||
    (facePitchUpDelta > faceThreshold * 0.65 && noseLiftTrend > threshold * 0.2) ||
    headUpDelta > threshold ||
    noseLiftTrend > threshold * 0.6 ||
    (headUpDelta > threshold * 0.7 && noseLiftTrend > threshold * 0.35)
  );
}

export function getPersonalizedHeadUpThresholds(
  baseline,
  defaultThreshold = MOTION_CONFIG.thresholds.headUp,
  defaultFaceThreshold = MOTION_CONFIG.thresholds.facePitchUp
) {
  const headUpDelta = (baseline?.headVerticalOffset || 0) - (baseline?.headUpVerticalOffset || 0);
  const facePitchUpDelta = (baseline?.facePitch || 0) - (baseline?.headUpFacePitch || 0);

  return {
    headThreshold: getRelativeThreshold(headUpDelta, defaultThreshold, 0.45, 0.2),
    faceThreshold: getRelativeThreshold(facePitchUpDelta, defaultFaceThreshold, 0.45, 0.2),
  };
}

export function getPersonalizedHeadDownThresholds(
  baseline,
  defaultThreshold = MOTION_CONFIG.thresholds.headDown,
  defaultFaceThreshold = MOTION_CONFIG.thresholds.facePitchDown
) {
  const headDownDelta = (baseline?.headDownVerticalOffset || 0) - (baseline?.headVerticalOffset || 0);
  const facePitchDownDelta = (baseline?.headDownFacePitch || 0) - (baseline?.facePitch || 0);

  return {
    headThreshold: getRelativeThreshold(headDownDelta, defaultThreshold),
    faceThreshold: getRelativeThreshold(facePitchDownDelta, defaultFaceThreshold),
  };
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
    this.stepProfiles = {};
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
    const requiredSamples = isMobile ? 6 : 20;

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
    const hasBodyInFrame =
      Number.isFinite(metrics.noseX) &&
      Number.isFinite(metrics.noseY) &&
      Number.isFinite(metrics.shoulderCenterX) &&
      Number.isFinite(metrics.shoulderCenterY) &&
      metrics.noseY > 0 &&
      metrics.noseY < 1 &&
      metrics.shoulderCenterY > 0 &&
      metrics.shoulderCenterY < 1;
    const isStable = isMobile
      ? hasBodyInFrame
      : shoulderRange < shoulderStillThreshold && headRange < headStillThreshold;

    if (isStable) {
      this.baseline = {
        noseY: average(nosesY),
        shoulderCenterY: average(shoulders),
        headOffset: average(headOffsets),
        headVerticalOffset: average(this.samples.map((item) => getHeadVerticalOffset(item))),
        facePitch: average(this.samples.map((item) => getFacePitch(item))),
      };
      this.stepProfiles = {};
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
      upperFaceY: average(this.samples.map((item) => item.upperFaceY)),
      mouthCenterY: average(this.samples.map((item) => item.mouthCenterY)),
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

    const { headVerticalOffset, headDownDelta, facePitchDownDelta, facePitchTrend } = getHeadMotionMetrics(
      smoothed,
      this.baseline,
      this.samples
    );
    const shoulderDropDelta = smoothed.shoulderCenterY - this.baseline.shoulderCenterY;
    const firstSample = this.samples[0];
    const lastSample = this.samples[this.samples.length - 1];
    const noseDropTrend = firstSample && lastSample ? lastSample.noseY - firstSample.noseY : 0;
    const shoulderDropTrend =
      firstSample && lastSample ? lastSample.shoulderCenterY - firstSample.shoulderCenterY : 0;

    if (step === "headDown") {
      const facePitchDownThreshold =
        this.layoutMode === "mobile"
          ? MOTION_CONFIG.thresholds.facePitchDownMobile
          : MOTION_CONFIG.thresholds.facePitchDown;
      this.stepRecognized =
        facePitchDownDelta > facePitchDownThreshold ||
        facePitchTrend > facePitchDownThreshold * 0.6 ||
        headDownDelta > MOTION_CONFIG.thresholds.headDown ||
        shoulderDropDelta > MOTION_CONFIG.thresholds.headDown * 0.8 ||
        noseDropTrend > MOTION_CONFIG.thresholds.headDown * 0.75 ||
        shoulderDropTrend > MOTION_CONFIG.thresholds.headDown * 0.5 ||
        smoothed.noseY > smoothed.leftShoulderY - 0.01 ||
        smoothed.noseY > smoothed.rightShoulderY - 0.01;
      if (this.stepRecognized) {
        this.stepProfiles.headDown = {
          headVerticalOffset: getHeadVerticalOffset(smoothed),
          facePitch: getFacePitch(smoothed),
        };
      }
      return;
    }

    if (step === "headUp") {
      this.stepRecognized = isHeadUpDetected(
        smoothed,
        this.baseline,
        this.samples,
        MOTION_CONFIG.thresholds.headUp,
        MOTION_CONFIG.thresholds.facePitchUp
      );
      if (this.stepRecognized) {
        this.stepProfiles.headUp = {
          headVerticalOffset: getHeadVerticalOffset(smoothed),
          facePitch: getFacePitch(smoothed),
        };
      }
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
    if (!this.baseline) return null;

    return {
      ...this.baseline,
      headUpVerticalOffset: this.stepProfiles.headUp?.headVerticalOffset ?? this.baseline.headUpVerticalOffset,
      headUpFacePitch: this.stepProfiles.headUp?.facePitch ?? this.baseline.headUpFacePitch,
      headDownVerticalOffset:
        this.stepProfiles.headDown?.headVerticalOffset ?? this.baseline.headDownVerticalOffset,
      headDownFacePitch: this.stepProfiles.headDown?.facePitch ?? this.baseline.headDownFacePitch,
    };
  }
}
