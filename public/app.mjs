import { advance, availableMoves, goalDirectedMoves, height, newGame, width } from "./game.mjs";

const board = document.querySelector("#board");
const score = document.querySelector("#score");
const turns = document.querySelector("#turns");
const status = document.querySelector("#status");
const playButton = document.querySelector("#play");
const stepButton = document.querySelector("#step");
const resetButton = document.querySelector("#reset");
const speed = document.querySelector("#speed");
const speedValue = document.querySelector("#speed-value");
const cells = Array.from({ length: width * height }, () => {
  const cell = document.createElement("div");
  cell.className = "cell";
  board.append(cell);
  return cell;
});

let game = newGame();
let running = false;
let busy = false;
let timer;
let generation = 0;

function render() {
  cells.forEach((cell) => { cell.className = "cell"; });
  game.snake.forEach(({ x, y }, index) => {
    cells[y * width + x].classList.add(index ? "snake" : "head");
  });
  if (game.food) cells[game.food.y * width + game.food.x].classList.add("food");
  score.textContent = game.score;
  turns.textContent = game.turns;
  board.setAttribute("aria-label", `Snake game board. ${game.score} apples, ${game.turns} moves. Snake head at ${game.snake[0].x}, ${game.snake[0].y}.`);
}

function setRunning(value) {
  running = value;
  clearTimeout(timer);
  playButton.textContent = value ? "Pause Jev" : "Start Jev";
  stepButton.disabled = value || busy;
  if (!value) generation += 1;
}

async function takeTurn() {
  if (busy) return;
  const moves = goalDirectedMoves(game);
  if (!moves.length) {
    setRunning(false);
    status.textContent = `Game over. Jev collected ${game.score} ${game.score === 1 ? "apple" : "apples"}.`;
    return;
  }

  busy = true;
  stepButton.disabled = true;
  const turnGeneration = generation;
  status.textContent = "Jev is choosing…";
  try {
    const response = await fetch("/api/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ snake: game.snake, food: game.food, moves }),
    });
    const decision = await response.json();
    if (!response.ok) throw new Error(decision.error || "Jev could not respond.");
    if (turnGeneration !== generation) return;
    game = advance(game, decision.direction);
    render();
    const icons = { up: "↑", right: "→", down: "↓", left: "←" };
    document.querySelector("#direction-icon").textContent = icons[decision.direction];
    document.querySelector("#direction").textContent = decision.direction[0].toUpperCase() + decision.direction.slice(1);
    const confidence = Number(decision.confidence);
    document.querySelector("#confidence").textContent = Number.isFinite(confidence) ? `${Math.round(confidence * 100)}%` : "–";
    document.querySelector("#confidence-fill").style.width = Number.isFinite(confidence) ? `${Math.max(0, Math.min(100, confidence * 100))}%` : "0%";
    status.textContent = game.food ? "Watching the next move." : "Board cleared. Jev wins!";
    if (!game.food) setRunning(false);
  } catch (error) {
    if (turnGeneration === generation) {
      setRunning(false);
      status.textContent = error.message;
    }
  } finally {
    busy = false;
    stepButton.disabled = running;
    if (running) timer = setTimeout(takeTurn, Number(speed.value));
  }
}

playButton.addEventListener("click", () => {
  if (running) {
    setRunning(false);
    status.textContent = "Paused.";
  } else {
    if (!game.food || !availableMoves(game).length) {
      game = newGame();
      render();
    }
    setRunning(true);
    status.textContent = "Jev is choosing…";
    if (!busy) takeTurn();
  }
});

stepButton.addEventListener("click", takeTurn);
resetButton.addEventListener("click", () => {
  setRunning(false);
  game = newGame();
  render();
  status.textContent = "Ready when you are.";
  document.querySelector("#direction-icon").textContent = "–";
  document.querySelector("#direction").textContent = "No move yet";
  document.querySelector("#confidence").textContent = "–";
  document.querySelector("#confidence-fill").style.width = "0%";
});
speed.addEventListener("input", () => {
  speedValue.value = `${(Number(speed.value) / 1000).toFixed(2).replace(/0$/, "")} s`;
});

render();
