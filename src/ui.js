export class UIController {
  constructor() {
    this.screens = new Map(
      [...document.querySelectorAll("[data-screen]")].map((node) => [node.dataset.screen, node])
    );

    this.refs = {
      startHighScore: document.getElementById("start-high-score"),
      openCameraBtn: document.getElementById("open-camera-btn"),
      startGameBtn: document.getElementById("start-game-btn"),
      cameraHelpText: document.getElementById("camera-help-text"),
      calibrationStepCount: document.getElementById("calibration-step-count"),
      calibrationStepText: document.getElementById("calibration-step-text"),
      calibrationStatus: document.getElementById("calibration-status"),
      calibrationTip: document.getElementById("calibration-tip"),
      calibrationNextBtn: document.getElementById("calibration-next-btn"),
      calibrationFinishBtn: document.getElementById("calibration-finish-btn"),
      calibrationBackBtn: document.getElementById("calibration-back-btn"),
      countdownValue: document.getElementById("countdown-value"),
      currentScore: document.getElementById("current-score"),
      currentHighScore: document.getElementById("current-high-score"),
      timeLeft: document.getElementById("time-left"),
      currentAction: document.getElementById("current-action"),
      resultScore: document.getElementById("result-score"),
      resultHighScore: document.getElementById("result-high-score"),
      resultNewHigh: document.getElementById("result-new-high"),
      playAgainBtn: document.getElementById("play-again-btn"),
      backHomeBtn: document.getElementById("back-home-btn"),
      calibrationCameraSlot: document.getElementById("calibration-camera-slot"),
      calibrationVisualStatus: document.getElementById("calibration-visual-status"),
      gameCameraSlot: document.getElementById("game-camera-slot"),
      sharedCameraStage: document.getElementById("shared-camera-stage"),
    };
  }

  showScreen(screenName) {
    this.screens.forEach((screen, key) => {
      screen.classList.toggle("active", key === screenName);
    });

    if (screenName === "calibration") {
      this.refs.calibrationCameraSlot.prepend(this.refs.sharedCameraStage);
      this.refs.sharedCameraStage.classList.remove("hidden");
    } else if (screenName === "game") {
      this.refs.gameCameraSlot.prepend(this.refs.sharedCameraStage);
      this.refs.sharedCameraStage.classList.remove("hidden");
    } else {
      this.refs.sharedCameraStage.classList.add("hidden");
    }
  }

  setHighScore(score) {
    const text = this.formatScore(score);
    this.refs.startHighScore.textContent = text;
    this.refs.currentHighScore.textContent = text;
    this.refs.resultHighScore.textContent = text;
  }

  setCameraReady(isReady) {
    this.refs.startGameBtn.disabled = !isReady;
    this.refs.cameraHelpText.textContent = isReady
      ? "摄像头已开启，现在可以开始校准。"
      : "请先打开摄像头，并站在画面中间。";
  }

  updateCalibrationStep({ index, total, text, tip, recognized, isLast }) {
    this.refs.calibrationStepCount.textContent = `第 ${index + 1} 步 / 共 ${total} 步`;
    this.refs.calibrationStepText.textContent = text;
    this.refs.calibrationTip.textContent = tip;
    this.refs.calibrationStatus.textContent = recognized ? "已识别" : "等待中";
    this.refs.calibrationNextBtn.disabled = !recognized || isLast;
    this.refs.calibrationFinishBtn.disabled = !recognized || !isLast;
    this.refs.calibrationNextBtn.classList.toggle("hidden", !recognized || isLast);
    this.refs.calibrationFinishBtn.classList.toggle("hidden", !recognized || !isLast);
    this.refs.calibrationVisualStatus.classList.toggle("hidden", !recognized);
    this.refs.calibrationVisualStatus.textContent = recognized ? "动作识别成功" : "等待识别";
  }

  setCountdown(value) {
    this.refs.countdownValue.textContent = String(value);
  }

  updateGameInfo({ score, highScore, timeLeftSeconds, currentAction }) {
    this.refs.currentScore.textContent = this.formatScore(score);
    this.refs.currentHighScore.textContent = this.formatScore(highScore);
    this.refs.timeLeft.textContent = `${timeLeftSeconds}秒`;
    this.refs.currentAction.textContent = currentAction;
  }

  showResult({ score, highScore, isNewHigh }) {
    this.refs.resultScore.textContent = this.formatScore(score);
    this.refs.resultHighScore.textContent = this.formatScore(highScore);
    this.refs.resultNewHigh.classList.toggle("hidden", !isNewHigh);
  }

  formatScore(score) {
    return Number(score || 0).toLocaleString("zh-CN");
  }
}
