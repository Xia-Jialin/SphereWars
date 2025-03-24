import WebSocket from 'ws';
import { v4 as uuid } from 'uuid';
import Config from '../client/js/game/config.js';

class GameServer {
    constructor() {
        this.players = new Map();
        this.foods = [];
        this.viruses = [];
        this.wss = new WebSocket.Server({ port: 8080 });
        
        this.init();
    }

    init() {
        // Initialize game objects
        this.spawnInitialFood();
        this.spawnInitialViruses();
        
        // Setup WebSocket server
        this.wss.on('connection', (ws) => {
            const playerId = uuid();
            this.players.set(playerId, {
                id: playerId,
                ws: ws,
                name: `Player ${this.players.size + 1}`,
                mass: Config.GAME.START_MASS,
                x: Math.random() * Config.GAME.MAP_SIZE,
                y: Math.random() * Config.GAME.MAP_SIZE,
                targetX: 0,
                targetY: 0,
                color: Config.RENDER.PLAYER_COLORS[
                    this.players.size % Config.RENDER.PLAYER_COLORS.length
                ]
            });

            // Send initial game state
            ws.send(JSON.stringify({
                type: 'init',
                playerId: playerId,
                players: Array.from(this.players.values()),
                foods: this.foods,
                viruses: this.viruses
            }));

            // Handle messages
            ws.on('message', (message) => {
                const data = JSON.parse(message);
                this.handleMessage(playerId, data);
            });

            // Handle disconnection
            ws.on('close', () => {
                this.players.delete(playerId);
                this.broadcastState();
            });
        });

        // Start game loop
        setInterval(() => this.gameLoop(), 1000 / Config.GAME.TICK_RATE);
    }

    spawnInitialFood() {
        for (let i = 0; i < Config.GAME.FOOD_SPAWN_AMOUNT; i++) {
            this.foods.push(this.createFood());
        }
    }

    spawnInitialViruses() {
        for (let i = 0; i < Config.GAME.VIRUS_COUNT; i++) {
            this.viruses.push(this.createVirus());
        }
    }

    createFood() {
        return {
            id: uuid(),
            x: Math.random() * Config.GAME.MAP_SIZE,
            y: Math.random() * Config.GAME.MAP_SIZE,
            size: Config.GAME.FOOD_SIZE,
            color: Config.RENDER.FOOD_COLOR
        };
    }

    createVirus() {
        return {
            id: uuid(),
            x: Math.random() * Config.GAME.MAP_SIZE,
            y: Math.random() * Config.GAME.MAP_SIZE,
            size: Config.GAME.VIRUS_SIZE,
            color: Config.RENDER.VIRUS_COLOR
        };
    }

    handleMessage(playerId, data) {
        const player = this.players.get(playerId);
        if (!player) return;

        switch (data.type) {
            case 'move':
                player.targetX = data.x;
                player.targetY = data.y;
                break;
                
            case 'split':
                this.handleSplit(player);
                break;
                
            case 'eject':
                this.handleEject(player);
                break;
        }
    }

    gameLoop() {
        this.updatePlayers();
        this.checkCollisions();
        this.broadcastState();
    }

    updatePlayers() {
        for (const player of this.players.values()) {
            // Update player position
            const dx = player.targetX - player.x;
            const dy = player.targetY - player.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist > 1) {
                const speed = Config.PHYSICS.PLAYER_SPEED / Math.sqrt(player.mass);
                player.x += (dx / dist) * speed;
                player.y += (dy / dist) * speed;
            }
        }
    }

    checkCollisions() {
        // Check player-food collisions
        for (const player of this.players.values()) {
            for (let i = this.foods.length - 1; i >= 0; i--) {
                const food = this.foods[i];
                const dx = player.x - food.x;
                const dy = player.y - food.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                if (dist < player.mass / 2) {
                    player.mass += 1;
                    this.foods.splice(i, 1);
                    this.foods.push(this.createFood());
                }
            }
        }
    }

    broadcastState() {
        const state = {
            type: 'update',
            players: Array.from(this.players.values()),
            foods: this.foods,
            viruses: this.viruses
        };

        for (const player of this.players.values()) {
            player.ws.send(JSON.stringify(state));
        }
    }
}

new GameServer();
