import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const files = {
  "/": ["./public/index.html", "text/html; charset=utf-8"],
  "/style.css": ["./public/style.css", "text/css; charset=utf-8"],
  "/game.mjs": ["./public/game.mjs", "text/javascript; charset=utf-8"],
  "/app.mjs": ["./public/app.mjs", "text/javascript; charset=utf-8"],
};
const directions = new Set(["up", "right", "down", "left"]);

export async function chooseMove(state, apiKey, fetcher = fetch) {
  if (!apiKey) throw new Error("Set TYPESAFE_API_KEY before starting the game.");
  if (!Array.isArray(state.moves) || !state.moves.length ||
      state.moves.some((move) => !directions.has(move)) ||
      !Array.isArray(state.snake) || state.snake.length > 324 ||
      !state.food || !Number.isInteger(state.food.x) || !Number.isInteger(state.food.y)) {
    throw new Error("Invalid board state.");
  }

  const criteria = Object.fromEntries(state.moves.map((move) => [move, `Move ${move} one cell.`]));
  const body = {
    model: "jev-latest",
    state: {
      board: { width: 18, height: 18 },
      snake: state.snake,
      food: state.food,
      legal_moves: state.moves,
    },
    questions: {
      next_move: {
        type: "choice",
        instructions: "Choose the snake's next move. The first snake cell is its head. Coordinates start at the top left; x increases right, y increases down. Eat the food while avoiding traps. Every listed move is legal now. Which direction is best?",
        criteria,
      },
    },
  };

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetcher("https://api.typesafe.ai/v1/systemone", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(12000),
    });
    if ([429, 529].includes(response.status) && attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
      continue;
    }
    if (!response.ok) throw new Error(`Jev request failed (${response.status}).`);
    const answer = (await response.json()).answers?.next_move;
    if (answer?.type !== "choice" || !state.moves.includes(answer.choice)) {
      throw new Error("Jev returned an invalid move.");
    }
    return { direction: answer.choice, confidence: answer.confidence };
  }
}

export function startServer(port = Number(process.env.PORT || 4173)) {
  return createServer(async (request, response) => {
    const path = new URL(request.url, "http://localhost").pathname;
    try {
      if (request.method === "POST" && path === "/api/move") {
        let raw = "";
        for await (const chunk of request) {
          raw += chunk;
          if (raw.length > 12000) throw new Error("Board state is too large.");
        }
        const move = await chooseMove(JSON.parse(raw), process.env.TYPESAFE_API_KEY);
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(JSON.stringify(move));
      } else if (request.method === "GET" && files[path]) {
        const [file, type] = files[path];
        response.writeHead(200, { "Content-Type": type });
        response.end(await readFile(new URL(file, import.meta.url)));
      } else {
        response.writeHead(404).end();
      }
    } catch (error) {
      response.writeHead(400, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: error.message }));
    }
  }).listen(port, "127.0.0.1");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const server = startServer();
  server.on("listening", () => {
    console.log(`Jev Snake is ready at http://127.0.0.1:${server.address().port}`);
  });
}
