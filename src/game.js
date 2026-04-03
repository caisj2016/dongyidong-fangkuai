import { GAME_CONFIG } from "./config.js";

const TETROMINOS = [
  { color: "#2962ff", shape: [[1, 1, 1, 1]] },
  { color: "#ef6c00", shape: [[1, 1], [1, 1]] },
  { color: "#7b1fa2", shape: [[0, 1, 0], [1, 1, 1]] },
  { color: "#2e7d32", shape: [[0, 1, 1], [1, 1, 0]] },
  { color: "#c62828", shape: [[1, 1, 0], [0, 1, 1]] },
  { color: "#00838f", shape: [[1, 0, 0], [1, 1, 1]] },
  { color: "#f9a825", shape: [[0, 0, 1], [1, 1, 1]] },
];

function createMatrix(rows, cols) {
  return Array.from({ length: rows }, () => Array(cols).fill(null));
}

function cloneShape(shape) {
  return shape.map((row) => [...row]);
}

function rotateMatrix(shape) {
  return shape[0].map((_, index) => shape.map((row) => row[index]).reverse());
}

function randomPiece(cols) {
  const template = TETROMINOS[Math.floor(Math.random() * TETROMINOS.length)];
  return {
    color: template.color,
    shape: cloneShape(template.shape),
    x: Math.floor((cols - template.shape[0].length) / 2),
    y: 0,
  };
}

export class TetrisGame {
  constructor(canvas, callbacks = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.callbacks = callbacks;
    this.config = GAME_CONFIG;
    this.resizeCanvas();
    this.reset();
  }

  resizeCanvas() {
    this.canvas.width = this.config.cols * this.config.cellSize;
    this.canvas.height = this.config.rows * this.config.cellSize;
  }

  reset() {
    this.board = createMatrix(this.config.rows, this.config.cols);
    this.score = 0;
    this.timeLeft = this.config.roundSeconds;
    this.currentPiece = randomPiece(this.config.cols);
    this.lastDropAt = 0;
    this.remainingMs = this.config.roundSeconds * 1000;
    this.running = false;
    this.softDrop = false;
    this.finished = false;
    this.lastTimestamp = 0;
    this.draw();
  }

  start() {
    this.reset();
    this.running = true;
    this.callbacks.onScore?.(this.score);
    this.callbacks.onTime?.(this.timeLeft);
  }

  stop() {
    this.running = false;
  }

  setSoftDrop(active) {
    this.softDrop = Boolean(active);
  }

  handleAction(action) {
    if (!this.running || !action) return;
    if (action === "left") this.tryMove(-1);
    if (action === "right") this.tryMove(1);
    if (action === "rotate") this.tryRotate();
  }

  handleKeyboard(key, isPressed) {
    if (key === "ArrowDown") {
      this.setSoftDrop(isPressed);
      return;
    }

    if (!isPressed || !this.running) return;
    if (key === "ArrowLeft") this.tryMove(-1);
    if (key === "ArrowRight") this.tryMove(1);
    if (key === "ArrowUp") this.tryRotate();
  }

  update(timestamp) {
    if (!this.running || this.finished) return;

    if (!this.lastTimestamp) {
      this.lastTimestamp = timestamp;
      this.lastDropAt = timestamp;
    }

    const delta = timestamp - this.lastTimestamp;
    this.lastTimestamp = timestamp;
    this.remainingMs = Math.max(0, this.remainingMs - delta);
    const nextTimeLeft = Math.ceil(this.remainingMs / 1000);
    if (nextTimeLeft !== this.timeLeft) {
      this.timeLeft = nextTimeLeft;
      this.callbacks.onTime?.(this.timeLeft);
    }

    if (this.remainingMs <= 0) {
      this.finishGame();
      return;
    }

    const interval = this.softDrop
      ? this.config.softDropInterval
      : this.config.normalDropInterval;

    if (timestamp - this.lastDropAt >= interval) {
      this.dropPiece();
      this.lastDropAt = timestamp;
    }

    this.draw();
  }

  tryMove(direction) {
    this.currentPiece.x += direction;
    if (this.collides(this.currentPiece)) {
      this.currentPiece.x -= direction;
    }
  }

  tryRotate() {
    const rotated = rotateMatrix(this.currentPiece.shape);
    const original = this.currentPiece.shape;
    this.currentPiece.shape = rotated;
    if (this.collides(this.currentPiece)) {
      this.currentPiece.x += 1;
      if (this.collides(this.currentPiece)) {
        this.currentPiece.x -= 2;
        if (this.collides(this.currentPiece)) {
          this.currentPiece.x += 1;
          this.currentPiece.shape = original;
        }
      }
    }
  }

  dropPiece() {
    this.currentPiece.y += 1;
    if (this.collides(this.currentPiece)) {
      this.currentPiece.y -= 1;
      this.mergePiece();
      const cleared = this.clearLines();
      if (cleared > 0) {
        this.score += cleared * this.config.lineScore;
        this.callbacks.onScore?.(this.score);
      }
      this.spawnNextPiece();
      this.softDrop = false;
    }
  }

  spawnNextPiece() {
    this.currentPiece = randomPiece(this.config.cols);
    this.lastDropAt = this.lastTimestamp;

    if (this.collides(this.currentPiece)) {
      this.draw();
      this.finishGame();
    }
  }

  finishGame() {
    if (this.finished) return;
    this.finished = true;
    this.running = false;
    this.softDrop = false;
    this.callbacks.onGameOver?.(this.score);
  }

  mergePiece() {
    this.currentPiece.shape.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value) {
          this.board[this.currentPiece.y + y][this.currentPiece.x + x] = this.currentPiece.color;
        }
      });
    });
  }

  clearLines() {
    let cleared = 0;
    for (let y = this.board.length - 1; y >= 0; y -= 1) {
      if (this.board[y].every(Boolean)) {
        this.board.splice(y, 1);
        this.board.unshift(Array(this.config.cols).fill(null));
        cleared += 1;
        y += 1;
      }
    }
    return cleared;
  }

  collides(piece) {
    return piece.shape.some((row, y) =>
      row.some((value, x) => {
        if (!value) return false;
        const boardX = piece.x + x;
        const boardY = piece.y + y;
        return (
          boardX < 0 ||
          boardX >= this.config.cols ||
          boardY >= this.config.rows ||
          (boardY >= 0 && this.board[boardY][boardX])
        );
      })
    );
  }

  draw() {
    const ctx = this.ctx;
    const size = this.config.cellSize;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.fillStyle = "#f6f8fb";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    for (let row = 0; row < this.config.rows; row += 1) {
      for (let col = 0; col < this.config.cols; col += 1) {
        const color = this.board[row][col];
        this.drawCell(col, row, color || "#ffffff", color ? 1 : 0.12);
      }
    }

    this.currentPiece.shape.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value) {
          this.drawCell(this.currentPiece.x + x, this.currentPiece.y + y, this.currentPiece.color, 1);
        }
      });
    });
  }

  drawCell(col, row, color, alpha) {
    const size = this.config.cellSize;
    const padding = 2;
    this.ctx.save();
    this.ctx.globalAlpha = alpha;
    this.ctx.fillStyle = color;
    this.ctx.fillRect(col * size + padding, row * size + padding, size - padding * 2, size - padding * 2);
    this.ctx.strokeStyle = "#c8d2df";
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(col * size + padding, row * size + padding, size - padding * 2, size - padding * 2);
    this.ctx.restore();
  }
}
