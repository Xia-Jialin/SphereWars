import { WebSocketServer } from 'ws';
import fs from 'fs';
import path from 'path';

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

wss.on('connection', (ws) => {
  console.log('New client connected');

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      
      if (message.type === 'REGISTER') {
        const config = loadConfig();
        const initResponse = {
          type: 'INIT',
          playerId: config.player.id,
          state: {
            players: [config.player],
            foods: config.foods,
            viruses: config.viruses
          }
        };
        ws.send(JSON.stringify(initResponse));
      }
    } catch (err) {
      console.error('Error processing message:', err);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

console.log(`Mock server running on ws://localhost:${PORT}`);
