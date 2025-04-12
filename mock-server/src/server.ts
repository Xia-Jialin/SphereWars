import { WebSocketServer } from 'ws';
import fs from 'fs';
import path from 'path';

interface GameState {
  players: Array<{
    id: string;
    name: string;
    x: number;
    y: number;
    mass: number;
    color: string;
  }>;
  foods: Array<{
    id: string;
    x: number;
    y: number;
    mass: number;
  }>;
  viruses: Array<any>;
}

interface InitResponse {
  player: {
    id: string;
    name: string;
    x: number;
    y: number;
    mass: number;
    color: string;
  };
  foods: Array<{
    id: string;
    x: number;
    y: number;
    mass: number;
  }>;
  viruses: Array<any>;
}

const PORT = 8080;
const configPath = path.join(__dirname, '../config/init-response.json');

function loadConfig(): InitResponse {
  const rawData = fs.readFileSync(configPath, 'utf-8');
  return JSON.parse(rawData);
}

const wss = new WebSocketServer({ port: PORT });

// Game state tracking
let gameState: GameState = {
  players: [],
  foods: [],
  viruses: []
};

// Update simulation
function simulateUpdate() {
  if (gameState.players.length === 0) return;

  // Simulate player movement
  gameState.players.forEach(player => {
    player.x += (Math.random() - 0.5) * 5;
    player.y += (Math.random() - 0.5) * 5;
  });

  // Simulate food changes (10% chance)
  if (Math.random() < 0.1) {
    if (gameState.foods.length > 0 && Math.random() < 0.5) {
      // Remove random food
      gameState.foods.splice(Math.floor(Math.random() * gameState.foods.length), 1);
    } else {
      // Add new food
      gameState.foods.push({
        id: `f${Date.now()}`,
        x: Math.random() * 1000,
        y: Math.random() * 800,
        mass: 5
      });
    }
  }
}

// Send updates to all connected clients
function sendUpdates() {
  simulateUpdate();
  
  wss.clients.forEach(client => {
    if (client.readyState === client.OPEN) {
      client.send(JSON.stringify({
        type: 'UPDATE',
        state: {
          players: gameState.players,
          foods: gameState.foods
        }
      }));
    }
  });
}

// Start update loop (100ms interval)
const updateInterval = setInterval(sendUpdates, 100);

wss.on('connection', (ws) => {
  console.log('New client connected');

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      
      if (message.type === 'REGISTER') {
        const config = loadConfig();
        gameState = {
          players: [config.player],
          foods: config.foods,
          viruses: config.viruses
        };
        const initResponse = {
          type: 'INIT',
          playerId: config.player.id,
          state: gameState
        };
        ws.send(JSON.stringify(initResponse));
      }
    } catch (err) {
      console.error('Error processing message:', err);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    // Clear interval if no clients left
    if (wss.clients.size === 0) {
      clearInterval(updateInterval);
    }
  });
});

console.log(`Mock server running on ws://localhost:${PORT}`);
