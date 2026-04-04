import { MOTION_CONFIG } from "./config.js";
import {
  getFacePitch,
  getHeadMotionMetrics,
  getHeadOffset,
  getHeadVerticalOffset,
  getLeanDelta,
  getPersonalizedHeadDownThresholds,
  getPersonalizedHeadUpThresholds,
  getPoseMetrics,
  isHeadUpDetected,
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
    this.currentAction = "无动作";
    this.resetMotionState();
  }

  setBaseline(baseline) {
    this.baseline = baseline;
    this.history = [];
    this.currentAction = "无动作";
    this.resetMotionState();
  }

  resetMotionState() {
    this.moveArmed = true;
    this.moveDirection = null;
    this.lastMoveAction = null;
    this.moveHoldStartedAt = 0;
    this.moveNextRepeatAt = 0;
    this.directionLockUntil = 0;

    this.rotateActive = false;
    this.rotateHoldStartedAt = 0;
    this.rotateNextRepeatAt = 0;
    this.rotateLockedUntil = 0;
    this.rotateReleaseStartedAt = 0;

    this.dropActive = false;
    this.dropHoldStartedAt = 0;
    this.dropNextRepeatAt = 0;
    this.dropLockedUntil = 0;
  }

  update(landmarks, now = performance.now()) {
    if (!this.baseline) {
      this.currentAction = "无动作";
      return { action: null, softDrop: false, currentAction: this.currentAction };
    }

    const metrics = getPoseMetrics(landmarks);
    if (!metrics) {
      this.history = [];
      this.currentAction = "无动作";
      this.resetMotionState();
      return { action: null, softDrop: false, currentAction: this.currentAction };
    }

    this.history.push(metrics);
    if (this.history.length > this.config.smoothingWindow) {
      this.history.shift();
    }

    const smoothed = {
      noseX: average(this.history.map((item) => item.noseX)),
      noseY: average(this.history.map((item) => item.noseY)),
      upperFaceY: average(this.history.map((item) => item.upperFaceY)),
      mouthCenterY: average(this.history.map((item) => item.mouthCenterY)),
      shoulderCenterX: average(this.history.map((item) => item.shoulderCenterX)),
      hipCenterX: average(this.history.map((item) => item.hipCenterX)),
      shoulderCenterY: average(this.history.map((item) => item.shoulderCenterY)),
      hipCenterY: average(this.history.map((item) => item.hipCenterY)),
      leftWristY: average(this.history.map((item) => item.leftWristY)),
      rightWristY: average(this.history.map((item) => item.rightWristY)),
      leftElbowY: average(this.history.map((item) => item.leftElbowY)),
      rightElbowY: average(this.history.map((item) => item.rightElbowY)),
      leftShoulderY: average(this.history.map((item) => item.leftShoulderY)),
      rightShoulderY: average(this.history.map((item) => item.rightShoulderY)),
    };

    const action =
      this.getMoveAction(smoothed, now) ||
      this.getRotateAction(smoothed, now) ||
      this.getDropAction(smoothed, now);

    this.currentAction = this.describeAction(action, smoothed);

    return {
      action,
      softDrop: false,
      currentAction: this.currentAction,
    };
  }

  getMoveAction(smoothed, now) {
    const lateralOffset = getHeadOffset(smoothed) - (this.baseline.headOffset || 0);
    const lean = getLeanDelta(smoothed);
    const moveThreshold = this.config.thresholds.headOffset;
    const rearmThreshold = this.config.thresholds.rearmThreshold;
    const { moveInitialDelay, moveRepeatInterval } = this.config.repeatDelays;

    if (Math.abs(lean) < rearmThreshold) {
      this.moveArmed = true;
      this.moveDirection = null;
      this.moveHoldStartedAt = 0;
      this.moveNextRepeatAt = 0;
      return null;
    }

    const requestedDirection =
      lateralOffset > moveThreshold ? "right" : lateralOffset < -moveThreshold ? "left" : null;

    if (!requestedDirection) {
      this.moveDirection = null;
      this.moveHoldStartedAt = 0;
      this.moveNextRepeatAt = 0;
      return null;
    }

    const oppositeDirection =
      requestedDirection === "left" ? "right" : requestedDirection === "right" ? "left" : null;
    const oppositeLocked =
      oppositeDirection && this.lastMoveAction === oppositeDirection && now < this.directionLockUntil;

    if (oppositeLocked) {
      return null;
    }

    if (this.moveDirection !== requestedDirection) {
      if (!this.moveArmed) {
        return null;
      }

      this.moveDirection = requestedDirection;
      this.lastMoveAction = requestedDirection;
      this.moveArmed = false;
      this.moveHoldStartedAt = now;
      this.moveNextRepeatAt = now + moveInitialDelay;
      this.directionLockUntil = now + this.config.lockDelays.direction;
      return requestedDirection;
    }

    if (this.moveNextRepeatAt > 0 && now >= this.moveNextRepeatAt) {
      this.lastMoveAction = requestedDirection;
      this.directionLockUntil = now + this.config.lockDelays.direction;
      this.moveNextRepeatAt = now + moveRepeatInterval;
      return requestedDirection;
    }

    return null;
  }

  getRotateAction(smoothed, now) {
    const personalizedThresholds = getPersonalizedHeadUpThresholds(
      this.baseline,
      this.config.thresholds.headUp,
      this.config.thresholds.facePitchUp
    );
    const headUpActive = isHeadUpDetected(
      smoothed,
      this.baseline,
      this.history,
      personalizedThresholds.headThreshold,
      personalizedThresholds.faceThreshold
    );
    const { rotateInitialDelay } = this.config.repeatDelays;

    if (!headUpActive) {
      if (this.rotateActive) {
        if (!this.rotateReleaseStartedAt) {
          this.rotateReleaseStartedAt = now;
        }

        if (now - this.rotateReleaseStartedAt < 140) {
          return null;
        }
      }

      this.rotateActive = false;
      this.rotateHoldStartedAt = 0;
      this.rotateNextRepeatAt = 0;
      this.rotateReleaseStartedAt = 0;
      return null;
    }

    this.rotateReleaseStartedAt = 0;

    if (now < this.rotateLockedUntil) {
      return null;
    }

    if (!this.rotateActive) {
      if (!this.rotateHoldStartedAt) {
        this.rotateHoldStartedAt = now;
        return null;
      }

      if (now - this.rotateHoldStartedAt < this.config.holds.rotate) {
        return null;
      }

      this.rotateActive = true;
      this.rotateNextRepeatAt = now + rotateInitialDelay;
      this.rotateLockedUntil = now + this.config.lockDelays.rotate;
      this.dropLockedUntil = now + this.config.lockDelays.rotateToDrop;
      return "rotate";
    }

    return null;
  }

  getDropAction(smoothed, now) {
    const headVerticalOffset =
      getHeadVerticalOffset(smoothed) - (this.baseline.headVerticalOffset || 0);
    const facePitchDownDelta = getFacePitch(smoothed) - (this.baseline.facePitch || 0);
    const isMobile = this.layoutMode === "mobile";
    const personalizedThresholds = getPersonalizedHeadDownThresholds(
      this.baseline,
      isMobile ? this.config.thresholds.headDownMobile : this.config.thresholds.headDown,
      isMobile ? this.config.thresholds.facePitchDownMobile : this.config.thresholds.facePitchDown
    );
    const headDownThreshold = personalizedThresholds.headThreshold;
    const facePitchDownThreshold = personalizedThresholds.faceThreshold;
    const dropHoldDuration = isMobile ? this.config.holds.squatMobile : this.config.holds.squat;
    const headDownActive =
      facePitchDownDelta > facePitchDownThreshold &&
      headVerticalOffset > headDownThreshold;

    if (!headDownActive || now < this.dropLockedUntil) {
      this.dropActive = false;
      this.dropHoldStartedAt = 0;
      this.dropNextRepeatAt = 0;
      return null;
    }

    if (!this.dropActive) {
      if (!this.dropHoldStartedAt) {
        this.dropHoldStartedAt = now;
        return null;
      }

      if (now - this.dropHoldStartedAt < dropHoldDuration) {
        return null;
      }

      this.dropActive = true;
      this.dropNextRepeatAt = now + this.config.repeatDelays.dropRepeatInterval;
      return "down";
    }

    if (this.dropNextRepeatAt > 0 && now >= this.dropNextRepeatAt) {
      this.dropNextRepeatAt = now + this.config.repeatDelays.dropRepeatInterval;
      return "down";
    }

    return null;
  }

  describeAction(action, smoothed) {
    if (action) {
      return this.label(action);
    }

    const lateralOffset = getHeadOffset(smoothed) - (this.baseline.headOffset || 0);
    const lean = getLeanDelta(smoothed);
    const { headVerticalOffset, facePitchDownDelta } = getHeadMotionMetrics(
      smoothed,
      this.baseline,
      this.history
    );
    const isMobile = this.layoutMode === "mobile";
    const personalizedDownThresholds = getPersonalizedHeadDownThresholds(
      this.baseline,
      isMobile ? this.config.thresholds.headDownMobile : this.config.thresholds.headDown,
      isMobile ? this.config.thresholds.facePitchDownMobile : this.config.thresholds.facePitchDown
    );
    const personalizedUpThresholds = getPersonalizedHeadUpThresholds(
      this.baseline,
      this.config.thresholds.headUp,
      this.config.thresholds.facePitchUp
    );
    const headDownThreshold = personalizedDownThresholds.headThreshold;
    const facePitchDownThreshold = personalizedDownThresholds.faceThreshold;

    if (Math.abs(lean) >= this.config.thresholds.rearmThreshold) {
      if (lateralOffset > this.config.thresholds.headOffset) {
        return "向右偏头";
      }
      if (lateralOffset < -this.config.thresholds.headOffset) {
        return "向左偏头";
      }
    }

    if (
      isHeadUpDetected(
        smoothed,
        this.baseline,
        this.history,
        personalizedUpThresholds.headThreshold,
        personalizedUpThresholds.faceThreshold
      )
    ) {
      return "抬头蓄力";
    }

    if (
      facePitchDownDelta > facePitchDownThreshold &&
      headVerticalOffset > headDownThreshold
    ) {
      return "低头蓄力";
    }

    return "无动作";
  }

  label(action) {
    return {
      left: "左移",
      right: "右移",
      rotate: "旋转",
      down: "下移",
    }[action] || "无动作";
  }
}
