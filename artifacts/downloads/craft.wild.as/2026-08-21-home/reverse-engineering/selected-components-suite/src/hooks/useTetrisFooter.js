import { useCallback, useEffect, useRef, useState } from "react";

const palette = ["#1c2541", "#3b5bd9", "#f5c518", "#e0492a", "#d8ff00"];
const ambientPieces = [
  [[0, 0], [1, 0], [2, 0], [3, 0]],
  [[0, 0], [1, 0], [0, 1], [1, 1]],
  [[0, 0], [1, 0], [2, 0], [1, 1]],
  [[0, 0], [0, 1], [1, 1], [2, 1]],
  [[0, 0], [1, 0], [2, 0], [2, 1]],
  [[0, 0], [1, 0], [1, 1], [2, 1]],
];
const playablePieces = [
  { color: 1, matrix: [[1, 1, 1, 1]] },
  { color: 2, matrix: [[1, 1], [1, 1]] },
  { color: 4, matrix: [[0, 1, 0], [1, 1, 1]] },
  { color: 3, matrix: [[0, 1, 1], [1, 1, 0]] },
  { color: 0, matrix: [[1, 1, 0], [0, 1, 1]] },
  { color: 1, matrix: [[1, 0, 0], [1, 1, 1]] },
  { color: 2, matrix: [[0, 0, 1], [1, 1, 1]] },
];

function hash(value) {
  const result = Math.sin(value * 12.9898) * 43758.5453;
  return result - Math.floor(result);
}

function rotateMatrix(matrix) {
  const rows = matrix.length;
  const columns = matrix[0].length;
  return Array.from({ length: columns }, (_, column) => (
    Array.from({ length: rows }, (_, row) => matrix[rows - 1 - row][column])
  ));
}

export function useTetrisFooter(canvasRef) {
  const engineRef = useRef(null);
  const [phase, setPhase] = useState("idle");
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return undefined;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cell = 9;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let width = 0;
    let height = 0;
    let columns = 0;
    let rows = 0;
    let visible = true;
    let currentPhase = "idle";
    let grid = new Int8Array();
    let ambientPiece = null;
    let ambientTick = 0;
    let ambientFade = 0;
    let flick = 0;
    let activePieces = [];
    let over = false;
    let spawnTick = 0;
    let currentScore = 0;
    let gravityTimer = 0;
    let transitionTimer = 0;
    let animationFrame = 0;

    const updatePhase = (nextPhase) => {
      currentPhase = nextPhase;
      setPhase(nextPhase);
    };

    const updateGameOver = (value) => {
      over = value;
      setGameOver(value);
    };

    const updateScore = (value) => {
      currentScore = value;
      setScore(value);
    };

    const colorIndex = (seed) => 1 + Math.min(4, Math.floor(hash(seed) * 5));

    const seedSkyline = () => {
      for (let column = 0; column < columns; column += 1) {
        if (hash(column * 2.3 + 1.1) < 0.3) continue;
        const towerHeight = 1 + Math.floor(hash(column * 4.7 + 0.5) * (rows * 0.58));
        for (let row = rows - 1; row >= rows - towerHeight && row >= 0; row -= 1) {
          grid[row * columns + column] = colorIndex(column * 9.1 + row * 3.7);
        }
      }
    };

    const spawnAmbient = () => {
      if (!columns) return;
      const matrix = ambientPieces[Math.floor(Math.random() * ambientPieces.length)];
      const pieceWidth = Math.max(...matrix.map(([x]) => x));
      ambientPiece = {
        matrix,
        x: Math.floor(Math.random() * Math.max(1, columns - pieceWidth)),
        y: -2,
        color: 1 + Math.min(4, Math.floor(Math.random() * 5)),
      };
    };

    const ambientHits = (matrix, x, y) => matrix.some(([localX, localY]) => {
      const gridX = x + localX;
      const gridY = y + localY;
      return gridY >= rows || (gridY >= 0 && (gridX < 0 || gridX >= columns || grid[gridY * columns + gridX]));
    });

    const stepAmbient = () => {
      if (ambientFade > 0) return;
      if (!ambientPiece) {
        spawnAmbient();
        return;
      }
      if (!ambientHits(ambientPiece.matrix, ambientPiece.x, ambientPiece.y + 1)) {
        ambientPiece.y += 1;
        return;
      }
      let top = rows;
      ambientPiece.matrix.forEach(([localX, localY]) => {
        const gridX = ambientPiece.x + localX;
        const gridY = ambientPiece.y + localY;
        if (gridY < 0 || gridY >= rows) return;
        grid[gridY * columns + gridX] = ambientPiece.color;
        top = Math.min(top, gridY);
      });
      if (top <= 1) ambientFade = 0.001;
      ambientPiece = null;
    };

    const drawAmbient = () => {
      context.clearRect(0, 0, width, height);
      const alpha = ambientFade > 0 ? Math.max(0, 1 - ambientFade) : 1;
      const flickFrame = Math.floor(flick * 30);
      for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
          const value = grid[row * columns + column];
          if (!value || (flick > 0 && hash(column * 7.1 + row * 3.3 + flickFrame * 2.7) < flick)) continue;
          context.globalAlpha = alpha;
          context.fillStyle = palette[value - 1];
          context.fillRect(column * cell, row * cell, cell - 1, cell - 1);
        }
      }
      if (ambientPiece && flick <= 0) {
        context.globalAlpha = 1;
        context.fillStyle = palette[ambientPiece.color - 1];
        ambientPiece.matrix.forEach(([localX, localY]) => {
          const gridX = ambientPiece.x + localX;
          const gridY = ambientPiece.y + localY;
          if (gridY >= 0) context.fillRect(gridX * cell, gridY * cell, cell - 1, cell - 1);
        });
      }
      context.globalAlpha = 1;
    };

    const hits = (matrix, x, y) => matrix.some((row, localY) => row.some((value, localX) => {
      if (!value) return false;
      const gridX = x + localX;
      const gridY = y + localY;
      return gridX < 0 || gridX >= columns || gridY >= rows || (gridY >= 0 && grid[gridY * columns + gridX]);
    }));

    const spawnPlayable = () => {
      const capacity = Math.max(2, Math.round(columns / 38));
      if (activePieces.length >= capacity) return;
      const piece = playablePieces[Math.floor(Math.random() * playablePieces.length)];
      const pieceWidth = piece.matrix[0].length;
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const x = Math.floor(Math.random() * Math.max(1, columns - pieceWidth + 1));
        if (hits(piece.matrix, x, 0)) continue;
        activePieces.push({
          matrix: piece.matrix.map((row) => [...row]),
          color: piece.color,
          x,
          y: -piece.matrix.length,
        });
        return;
      }
    };

    const mergePiece = (piece) => {
      piece.matrix.forEach((row, localY) => row.forEach((value, localX) => {
        if (!value) return;
        const gridY = piece.y + localY;
        if (gridY >= 0 && gridY < rows) grid[gridY * columns + piece.x + localX] = piece.color + 1;
      }));
    };

    const clearLines = () => {
      let cleared = 0;
      for (let row = rows - 1; row >= 0; row -= 1) {
        let full = true;
        for (let column = 0; column < columns; column += 1) {
          if (!grid[row * columns + column]) {
            full = false;
            break;
          }
        }
        if (!full) continue;
        for (let targetRow = row; targetRow > 0; targetRow -= 1) {
          for (let column = 0; column < columns; column += 1) {
            grid[targetRow * columns + column] = grid[(targetRow - 1) * columns + column];
          }
        }
        for (let column = 0; column < columns; column += 1) grid[column] = 0;
        cleared += 1;
        row += 1;
      }
      if (cleared) updateScore(currentScore + [0, 100, 300, 600, 1000][Math.min(4, cleared)]);
    };

    const drawPlayable = () => {
      context.clearRect(0, 0, width, height);
      for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
          const value = grid[row * columns + column];
          if (!value) continue;
          context.fillStyle = palette[value - 1];
          context.fillRect(column * cell, row * cell, cell - 1, cell - 1);
        }
      }
      activePieces.forEach((piece) => {
        context.fillStyle = palette[piece.color];
        piece.matrix.forEach((row, localY) => row.forEach((value, localX) => {
          const canvasY = piece.y + localY;
          if (value && canvasY >= 0) context.fillRect((piece.x + localX) * cell, canvasY * cell, cell - 1, cell - 1);
        }));
      });
    };

    const stepPlayable = () => {
      if (over) return;
      const falling = [];
      activePieces.forEach((piece) => {
        if (hits(piece.matrix, piece.x, piece.y + 1)) {
          mergePiece(piece);
          if (piece.y <= 0) updateGameOver(true);
        } else {
          piece.y += 1;
          falling.push(piece);
        }
      });
      activePieces = falling;
      spawnTick -= 1;
      if (spawnTick <= 0) {
        spawnPlayable();
        spawnTick = 1 + Math.floor(Math.random() * 4);
      }
      clearLines();
      drawPlayable();
    };

    const gravity = () => {
      if (currentPhase !== "play" || over) return;
      stepPlayable();
      gravityTimer = window.setTimeout(gravity, 300);
    };

    const size = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width < 2) return;
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      columns = Math.ceil(width / cell);
      rows = Math.floor(height / cell);
      grid = new Int8Array(columns * rows);
      if (currentPhase === "idle") seedSkyline();
    };

    const beginPlay = () => {
      updatePhase("play");
      size();
      grid.fill(0);
      updateGameOver(false);
      updateScore(0);
      activePieces = [];
      spawnTick = 0;
      spawnPlayable();
      spawnPlayable();
      drawPlayable();
      window.clearTimeout(gravityTimer);
      gravityTimer = window.setTimeout(gravity, 300);
    };

    const glideToFooter = () => {
      const startY = window.pageYOffset || 0;
      const start = performance.now();
      const glide = (now) => {
        const progress = Math.min(1, (now - start) / 560);
        const eased = 1 - (1 - progress) ** 3;
        const maxScroll = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) - window.innerHeight;
        window.scrollTo(0, startY + (maxScroll - startY) * eased);
        if (progress < 1) window.requestAnimationFrame(glide);
      };
      window.requestAnimationFrame(glide);
    };

    const start = () => {
      if (currentPhase !== "idle") return;
      updatePhase("flick");
      flick = 0.001;
    };

    const close = () => {
      updatePhase("idle");
      window.clearTimeout(gravityTimer);
      window.clearTimeout(transitionTimer);
      flick = 0;
      updateGameOver(false);
      activePieces = [];
      size();
      drawAmbient();
    };

    const move = (direction) => {
      if (over) return;
      let moved = false;
      activePieces.forEach((piece) => {
        if (hits(piece.matrix, piece.x + direction, piece.y)) return;
        piece.x += direction;
        moved = true;
      });
      if (moved) drawPlayable();
    };

    const softDrop = () => {
      if (over) return;
      activePieces.forEach((piece) => {
        if (!hits(piece.matrix, piece.x, piece.y + 1)) piece.y += 1;
      });
      drawPlayable();
    };

    const rotatePieces = () => {
      if (over) return;
      activePieces.forEach((piece) => {
        const nextMatrix = rotateMatrix(piece.matrix);
        const kicks = [0, -1, 1, -2, 2];
        const kick = kicks.find((offset) => !hits(nextMatrix, piece.x + offset, piece.y));
        if (kick === undefined) return;
        piece.matrix = nextMatrix;
        piece.x += kick;
      });
      drawPlayable();
    };

    const hardDrop = () => {
      if (over) return;
      activePieces.forEach((piece) => {
        while (!hits(piece.matrix, piece.x, piece.y + 1)) piece.y += 1;
        mergePiece(piece);
        if (piece.y <= 0) updateGameOver(true);
      });
      activePieces = [];
      clearLines();
      drawPlayable();
    };

    const replay = () => beginPlay();

    engineRef.current = { start, close, move, softDrop, rotate: rotatePieces, hardDrop, replay };

    const handleKey = (event) => {
      if (currentPhase !== "play") return;
      if (event.key === "Escape") {
        close();
        return;
      }
      if (over) {
        if (event.key === "Enter") replay();
        return;
      }
      if (event.key === "ArrowLeft") move(-1);
      else if (event.key === "ArrowRight") move(1);
      else if (event.key === "ArrowDown") softDrop();
      else if (event.key === "ArrowUp" || event.key.toLowerCase() === "x") rotatePieces();
      else if (event.key === " ") hardDrop();
      else return;
      event.preventDefault();
    };

    const loop = () => {
      if (visible && !reduceMotion) {
        if (currentPhase === "idle") {
          ambientTick += 1;
          if (ambientTick % 5 === 0) stepAmbient();
          if (ambientFade > 0) {
            ambientFade += 0.05;
            if (ambientFade >= 1) {
              grid = new Int8Array(columns * rows);
              seedSkyline();
              ambientFade = 0;
            }
          }
          drawAmbient();
        } else if (currentPhase === "flick") {
          flick += 0.06;
          drawAmbient();
          if (flick >= 1) {
            updatePhase("expand");
            glideToFooter();
            transitionTimer = window.setTimeout(beginPlay, 580);
          }
        }
      }
      animationFrame = window.requestAnimationFrame(loop);
    };

    const resizeObserver = new ResizeObserver(() => {
      const wasPlaying = currentPhase === "play";
      size();
      if (wasPlaying) {
        updateGameOver(false);
        activePieces = [];
        spawnTick = 0;
        drawPlayable();
      }
    });
    resizeObserver.observe(canvas);
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    });
    intersectionObserver.observe(canvas);
    document.addEventListener("keydown", handleKey);
    size();
    drawAmbient();
    animationFrame = window.requestAnimationFrame(loop);

    return () => {
      engineRef.current = null;
      window.cancelAnimationFrame(animationFrame);
      window.clearTimeout(gravityTimer);
      window.clearTimeout(transitionTimer);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener("keydown", handleKey);
    };
  }, [canvasRef]);

  const start = useCallback(() => engineRef.current?.start(), []);
  const close = useCallback(() => engineRef.current?.close(), []);
  const moveLeft = useCallback(() => engineRef.current?.move(-1), []);
  const moveRight = useCallback(() => engineRef.current?.move(1), []);
  const rotate = useCallback(() => engineRef.current?.rotate(), []);
  const hardDrop = useCallback(() => engineRef.current?.hardDrop(), []);
  const replay = useCallback(() => engineRef.current?.replay(), []);

  return { phase, score, gameOver, start, close, moveLeft, moveRight, rotate, hardDrop, replay };
}

const teaserColors = ["#3b5bd9", "#f5c518", "#e0492a", "#d8ff00"];
const teaserPieces = [
  [[0, 0], [1, 0], [2, 0], [3, 0]],
  [[0, 0], [1, 0], [0, 1], [1, 1]],
  [[0, 0], [1, 0], [2, 0], [1, 1]],
  [[1, 0], [2, 0], [0, 1], [1, 1]],
  [[0, 0], [1, 0], [2, 0], [0, 1]],
  [[0, 0], [1, 0], [2, 0], [2, 1]],
];

export function useTeaserPieces(canvasRef) {
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return undefined;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const unit = 4;
    const width = 5 * unit;
    const height = 4 * unit;
    let index = 0;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);

    const draw = () => {
      context.clearRect(0, 0, width, height);
      const piece = teaserPieces[index % teaserPieces.length];
      const maxX = Math.max(...piece.map(([x]) => x));
      const maxY = Math.max(...piece.map(([, y]) => y));
      const offsetX = (width - (maxX + 1) * unit) / 2;
      const offsetY = (height - (maxY + 1) * unit) / 2;
      context.fillStyle = teaserColors[index % teaserColors.length];
      piece.forEach(([x, y]) => context.fillRect(offsetX + x * unit, offsetY + y * unit, unit - 1, unit - 1));
    };

    draw();
    const timer = window.setInterval(() => {
      index += 1;
      draw();
    }, 520);
    return () => window.clearInterval(timer);
  }, [canvasRef]);
}
