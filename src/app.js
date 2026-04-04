import { CalibrationController } from "./calibration.js";
import { TetrisGame } from "./game.js";
import { MotionMapper } from "./motion.js";
import { PoseDetector } from "./pose.js";
import { getHighScore, saveHighScore } from "./storage.js";
import { UIController } from "./ui.js";

const DEFAULT_ACTION_LABEL = "无动作";

const ui = new UIController();
const calibration = new CalibrationController();
const motionMapper = new MotionMapper();

const appState = {
  currentScreen: "start",
  cameraReady: false,
  highScore: getHighScore(),
  score: 0,
  calibrationAdvanceTimer: null,
  calibrationAdvanceStepKey: null,
  pendingStartAfterCamera: false,
  keyboardActionTimer: null,
};

ui.setHighScore(appState.highScore);
ui.setCameraReady(false);
ui.updateGameInfo({
  score: 0,
  highScore: appState.highScore,
  timeLeftSeconds: 120,
  currentAction: DEFAULT_ACTION_LABEL,
});
ui.updateCalibrationStep(calibration.getState());

const poseDetector = new PoseDetector({
  video: document.getElementById("camera-video"),
  overlay: document.getElementById("pose-overlay"),
  onPose: handlePoseFrame,
});

const game = new TetrisGame(document.getElementById("game-canvas"), {
  onScore(score) {
    appState.score = score;
    updateGamePanel(motionMapper.currentAction || DEFAULT_ACTION_LABEL);
  },
  onTime() {
    updateGamePanel(motionMapper.currentAction || DEFAULT_ACTION_LABEL);
  },
  onGameOver(finalScore) {
    finishRound(finalScore);
  },
});

const mobileLayoutQuery = window.matchMedia("(max-width: 768px), (orientation: portrait)");

function syncLayoutMode() {
  const layoutMode = mobileLayoutQuery.matches ? "mobile" : "desktop";
  document.body.dataset.layout = layoutMode;
  calibration.setLayoutMode(layoutMode);
  motionMapper.setLayoutMode(layoutMode);
  if (appState.cameraReady) {
    poseDetector.refreshLayout();
  }
}

function updateGamePanel(currentAction = DEFAULT_ACTION_LABEL) {
  ui.updateGameInfo({
    score: appState.score,
    highScore: appState.highScore,
    timeLeftSeconds: game.timeLeft,
    currentAction,
  });
}

function showScreen(screenName) {
  appState.currentScreen = screenName;
  ui.showScreen(screenName);
  if (appState.cameraReady) {
    poseDetector.refreshLayout();
  }
}

async function enableCamera() {
  try {
    await poseDetector.startCamera();
    appState.cameraReady = true;
    ui.setCameraReady(true);
    if (appState.pendingStartAfterCamera) {
      appState.pendingStartAfterCamera = false;
      beginCalibration();
    }
  } catch (error) {
    ui.refs.cameraHelpText.textContent = "无法打开摄像头，请确认浏览器权限已允许。";
    console.error(error);
  }
}

function beginCalibration() {
  if (!appState.cameraReady) {
    appState.pendingStartAfterCamera = true;
    enableCamera();
    return;
  }

  calibration.reset();
  clearCalibrationAdvanceTimer();
  ui.updateCalibrationStep(calibration.getState());
  showScreen("calibration");
}

function handlePoseFrame(landmarks) {
  if (appState.currentScreen === "calibration") {
    const state = calibration.processLandmarks(landmarks);
    ui.updateCalibrationStep(state);
    scheduleCalibrationAdvance(state);
    return;
  }

  if (appState.currentScreen === "game") {
    const motion = motionMapper.update(landmarks);
    game.setSoftDrop(motion.softDrop);
    if (motion.action) {
      game.handleAction(motion.action);
    }
    updateGamePanel(motion.currentAction || DEFAULT_ACTION_LABEL);
  }
}

function clearCalibrationAdvanceTimer() {
  if (appState.calibrationAdvanceTimer) {
    window.clearTimeout(appState.calibrationAdvanceTimer);
    appState.calibrationAdvanceTimer = null;
  }
  appState.calibrationAdvanceStepKey = null;
  ui.resetCalibrationProgress();
}

function advanceCalibrationStep() {
  if (appState.currentScreen !== "calibration") {
    return;
  }

  const state = calibration.getState();
  if (!state.recognized) {
    return;
  }

  clearCalibrationAdvanceTimer();
  if (calibration.isComplete()) {
    startInstructionCountdown();
    return;
  }

  ui.updateCalibrationStep(calibration.goToNextStep());
}

function scheduleCalibrationAdvance(state) {
  if (!state.recognized) {
    clearCalibrationAdvanceTimer();
    return;
  }

  const stepKey = `${state.index}:${state.text}`;
  if (appState.calibrationAdvanceTimer && appState.calibrationAdvanceStepKey === stepKey) {
    return;
  }

  clearCalibrationAdvanceTimer();
  appState.calibrationAdvanceStepKey = stepKey;
  const advanceDelay = document.body.dataset.layout === "mobile" ? 1200 : 900;
  ui.setCalibrationProgress(0, 0);

  appState.calibrationAdvanceTimer = window.setTimeout(() => {
    appState.calibrationAdvanceTimer = null;
    appState.calibrationAdvanceStepKey = null;
    ui.resetCalibrationProgress();
    if (appState.currentScreen !== "calibration") {
      return;
    }

    const latestState = calibration.getState();
    if (!latestState.recognized || latestState.index !== state.index) {
      return;
    }

    advanceCalibrationStep();
  }, advanceDelay);

  requestAnimationFrame(() => {
    if (
      appState.currentScreen === "calibration" &&
      appState.calibrationAdvanceStepKey === stepKey
    ) {
      ui.setCalibrationProgress(1, advanceDelay);
    }
  });
}

function startInstructionCountdown() {
  showScreen("instructions");
  ui.setCountdown("点击下方按钮");
}

function startGameRound() {
  motionMapper.reset();
  motionMapper.setBaseline(calibration.getBaseline());
  showScreen("game");
  game.start();
  appState.score = 0;
  updateGamePanel(DEFAULT_ACTION_LABEL);
  requestAnimationFrame(gameLoop);
}

function gameLoop(timestamp) {
  if (appState.currentScreen !== "game") {
    return;
  }

  game.update(timestamp);
  if (!game.finished && appState.currentScreen === "game") {
    requestAnimationFrame(gameLoop);
  }
}

function finishRound(finalScore) {
  clearCalibrationAdvanceTimer();
  game.stop();
  motionMapper.reset();

  const previousHigh = appState.highScore;
  const isNewHigh = finalScore > previousHigh;

  if (isNewHigh) {
    appState.highScore = finalScore;
    saveHighScore(finalScore);
    ui.setHighScore(finalScore);
  }

  ui.showResult({
    score: finalScore,
    highScore: Math.max(previousHigh, finalScore),
    isNewHigh,
  });
  showScreen("result");
}

function playAgain() {
  clearCalibrationAdvanceTimer();
  motionMapper.reset();

  if (calibration.getBaseline()) {
    startInstructionCountdown();
    return;
  }

  calibration.reset();
  ui.updateCalibrationStep(calibration.getState());
  beginCalibration();
}

function returnHome() {
  clearCalibrationAdvanceTimer();
  game.stop();
  motionMapper.reset();
  calibration.reset();
  ui.updateCalibrationStep(calibration.getState());
  updateGamePanel(DEFAULT_ACTION_LABEL);
  showScreen("start");
}

ui.refs.openCameraBtn.addEventListener("click", enableCamera);
ui.refs.startGameBtn.addEventListener("click", beginCalibration);
ui.refs.calibrationNextBtn.addEventListener("click", advanceCalibrationStep);
ui.refs.calibrationFinishBtn.addEventListener("click", advanceCalibrationStep);
ui.refs.calibrationBackBtn.addEventListener("click", returnHome);
ui.refs.instructionStartBtn.addEventListener("click", startGameRound);
ui.refs.instructionBackBtn.addEventListener("click", beginCalibration);
ui.refs.playAgainBtn.addEventListener("click", playAgain);
ui.refs.backHomeBtn.addEventListener("click", returnHome);

window.addEventListener("keydown", (event) => {
  if (appState.currentScreen !== "game") {
    return;
  }

  if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
    return;
  }

  event.preventDefault();
  game.handleKeyboard(event.key, true);

  const label =
    {
      ArrowLeft: "左移",
      ArrowRight: "右移",
      ArrowDown: "下蹲",
      ArrowUp: "旋转",
    }[event.key] || DEFAULT_ACTION_LABEL;
  updateGamePanel(label);

  if (event.key !== "ArrowDown") {
    window.clearTimeout(appState.keyboardActionTimer);
    appState.keyboardActionTimer = window.setTimeout(() => {
      if (appState.currentScreen === "game") {
        updateGamePanel(DEFAULT_ACTION_LABEL);
      }
    }, 220);
  }
});

window.addEventListener("keyup", (event) => {
  if (appState.currentScreen !== "game") {
    return;
  }

  if (event.key !== "ArrowDown") {
    return;
  }

  game.handleKeyboard(event.key, false);
  updateGamePanel(DEFAULT_ACTION_LABEL);
});

showScreen("start");
syncLayoutMode();
if (mobileLayoutQuery.addEventListener) {
  mobileLayoutQuery.addEventListener("change", syncLayoutMode);
} else if (mobileLayoutQuery.addListener) {
  mobileLayoutQuery.addListener(syncLayoutMode);
}
window.addEventListener("resize", syncLayoutMode);
