"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ws_1 = require("ws");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const PORT = 8080;
const configPath = path_1.default.join(__dirname, '../config/init-response.json');
function loadConfig() {
    const rawData = fs_1.default.readFileSync(configPath, 'utf-8');
    return JSON.parse(rawData);
}
const wss = new ws_1.WebSocketServer({ port: PORT });
// Game state tracking
let gameState = {
    players: [],
    foods: [],
    viruses: []
};
// Update simulation
function simulateUpdate() {
    if (gameState.players.length === 0)
        return;
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
        }
        else {
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
        }
        catch (err) {
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
