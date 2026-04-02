export class PoseDetector {
  constructor({ video, overlay, onPose }) {
    this.video = video;
    this.overlay = overlay;
    this.overlayCtx = overlay.getContext("2d");
    this.onPose = onPose;
    this.pose = null;
    this.stream = null;
    this.running = false;
    this.processing = false;
  }

  isPortraitViewport() {
    return window.matchMedia("(max-width: 768px), (orientation: portrait)").matches;
  }

  async init() {
    if (this.pose) return;

    this.pose = new Pose({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
    });

    this.pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      enableSegmentation: false,
      minDetectionConfidence: 0.35,
      minTrackingConfidence: 0.35,
    });

    this.pose.onResults((results) => {
      this.drawResults(results);
      this.onPose?.(results.poseLandmarks || null);
      this.processing = false;
    });
  }

  async startCamera() {
    await this.init();
    if (this.stream) return;

    const isPortrait = this.isPortraitViewport();
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "user",
        width: { ideal: isPortrait ? 720 : 1280 },
        height: { ideal: isPortrait ? 1280 : 720 },
        aspectRatio: { ideal: isPortrait ? 9 / 16 : 4 / 3 },
      },
      audio: false,
    });

    this.video.srcObject = this.stream;
    await this.video.play();
    this.syncOverlaySize();
    this.running = true;
    this.loop();
  }

  refreshLayout() {
    this.syncOverlaySize();
  }

  stopCamera() {
    this.running = false;
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    this.video.srcObject = null;
    this.clearOverlay();
  }

  async loop() {
    if (!this.running) return;
    if (!this.processing && this.video.readyState >= 2) {
      this.processing = true;
      this.syncOverlaySize();
      await this.pose.send({ image: this.video });
    }
    requestAnimationFrame(() => this.loop());
  }

  syncOverlaySize() {
    const width = this.video.videoWidth || this.video.clientWidth || 960;
    const height = this.video.videoHeight || this.video.clientHeight || 720;
    if (this.overlay.width !== width || this.overlay.height !== height) {
      this.overlay.width = width;
      this.overlay.height = height;
    }
  }

  clearOverlay() {
    this.overlayCtx.clearRect(0, 0, this.overlay.width, this.overlay.height);
  }

  drawResults(results) {
    this.clearOverlay();
    if (!results.poseLandmarks) return;

    drawConnectors(this.overlayCtx, results.poseLandmarks, POSE_CONNECTIONS, {
      color: "#7fd3ff",
      lineWidth: 4,
    });
    drawLandmarks(this.overlayCtx, results.poseLandmarks, {
      color: "#184e9e",
      lineWidth: 2,
      radius: 4,
    });
  }
}
