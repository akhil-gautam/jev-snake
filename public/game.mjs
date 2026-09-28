export const width = 18;
export const height = 18;

const directions = {
  up: [0, -1],
  right: [1, 0],
  down: [0, 1],
  left: [-1, 0],
};

const sameCell = (a, b) => a.x === b.x && a.y === b.y;
const cellId = ({ x, y }) => y * width + x;

export function availableMoves(game) {
  return Object.entries(directions).filter(([, [dx, dy]]) => {
    const next = { x: game.snake[0].x + dx, y: game.snake[0].y + dy };
    const grows = sameCell(next, game.food);
    const body = grows ? game.snake : game.snake.slice(0, -1);
    return next.x >= 0 && next.x < width && next.y >= 0 && next.y < height &&
      !body.some((cell) => sameCell(cell, next));
  }).map(([direction]) => direction);
}

export function goalDirectedMoves(game) {
  const moves = availableMoves(game);
  const occupied = new Set(game.snake.slice(0, -1).map(cellId));
  const distances = new Map([[cellId(game.food), 0]]);
  const queue = [game.food];

  for (let index = 0; index < queue.length; index += 1) {
    const cell = queue[index];
    for (const [dx, dy] of Object.values(directions)) {
      const neighbor = { x: cell.x + dx, y: cell.y + dy };
      const id = cellId(neighbor);
      if (neighbor.x < 0 || neighbor.x >= width || neighbor.y < 0 || neighbor.y >= height ||
          occupied.has(id) || distances.has(id)) continue;
      distances.set(id, distances.get(cellId(cell)) + 1);
      queue.push(neighbor);
    }
  }

  const moveDistances = moves.map((move) => {
    const [dx, dy] = directions[move];
    return distances.get(cellId({ x: game.snake[0].x + dx, y: game.snake[0].y + dy })) ?? Infinity;
  });
  const shortest = Math.min(...moveDistances);
  return Number.isFinite(shortest) ? moves.filter((_, index) => moveDistances[index] === shortest) : moves;
}

export function placeFood(snake, random = Math.random) {
  const empty = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!snake.some((cell) => cell.x === x && cell.y === y)) empty.push({ x, y });
    }
  }
  return empty.length ? empty[Math.floor(random() * empty.length)] : null;
}

export function newGame(random = Math.random) {
  const snake = [{ x: 8, y: 9 }, { x: 7, y: 9 }, { x: 6, y: 9 }];
  return { snake, food: placeFood(snake, random), score: 0, turns: 0 };
}

export function advance(game, direction, random = Math.random) {
  if (!availableMoves(game).includes(direction)) throw new Error("Illegal move");
  const [dx, dy] = directions[direction];
  const head = { x: game.snake[0].x + dx, y: game.snake[0].y + dy };
  const eats = sameCell(head, game.food);
  const snake = [head, ...game.snake.slice(0, eats ? undefined : -1)];
  return {
    snake,
    food: eats ? placeFood(snake, random) : game.food,
    score: game.score + Number(eats),
    turns: game.turns + 1,
  };
}
