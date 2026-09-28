import test from "node:test";
import assert from "node:assert/strict";
import { advance, availableMoves, goalDirectedMoves, newGame } from "./public/game.mjs";
import { chooseMove } from "./server.mjs";

test("snake grows on food and cannot reverse into its body", () => {
  const game = { ...newGame(), food: { x: 9, y: 9 } };
  assert.deepEqual(availableMoves(game), ["up", "right", "down"]);
  const next = advance(game, "right", () => 0);
  assert.equal(next.score, 1);
  assert.equal(next.snake.length, 4);
  assert.deepEqual(next.snake[0], { x: 9, y: 9 });
  assert.ok(!next.snake.some((cell) => cell.x === next.food.x && cell.y === next.food.y));
});

test("Jev gets a constrained choice and its answer controls the move", async () => {
  let request;
  const fetcher = async (_url, options) => {
    request = options;
    return { ok: true, json: async () => ({ answers: { next_move: { type: "choice", choice: "up", confidence: 0.8 } } }) };
  };
  const move = await chooseMove({ snake: [{ x: 8, y: 9 }], food: { x: 2, y: 2 }, moves: ["up", "left"] }, "test-key", fetcher);
  assert.deepEqual(move, { direction: "up", confidence: 0.8 });
  const body = JSON.parse(request.body);
  assert.equal(body.model, "jev-latest");
  assert.deepEqual(Object.keys(body.questions.next_move.criteria), ["up", "left"]);
  assert.equal(request.headers.Authorization, "Bearer test-key");
});

test("goal-directed choices keep reaching apples across 300 turns", () => {
  let seed = 7;
  const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  let game = newGame(random);
  for (let turn = 0; turn < 300 && game.food; turn += 1) {
    const moves = goalDirectedMoves(game);
    if (!moves.length) break;
    game = advance(game, moves[0], random);
  }
  assert.equal(game.turns, 300);
  assert.ok(game.score >= 10);
});
