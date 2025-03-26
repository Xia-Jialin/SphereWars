import { Player } from './Player';
import { Camera } from './Camera';
import { InputManager } from './InputManager';
import { Food } from './Food';
import { WebSocketManager } from '../network/WebSocketManager';

export class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private camera: Camera;
  private inputManager: InputManager;
  private player: Player;
  private splitPlayers: Player[] = [];
  private foods: Food[] = [];
  private lastTime: number = 0;
  private running: boolean = false;
  private readonly mapSize: number = 10000;
  private readonly maxFoods: number = 1000;
  private remotePlayers: Map<string, Player> = new Map();
  private readonly playerId: string;
  private readonly wsManager: WebSocketManager;

  constructor(
    canvas: HTMLCanvasElement,
    playerId: string,
    wsManager: WebSocketManager
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.playerId = playerId;
    this.wsManager = wsManager;
    this.camera = new Camera(canvas.width / 2, canvas.height / 2);
    this.inputManager = new InputManager();
    this.player = new Player(
      playerId,
      `Player ${playerId.slice(0, 4)}`,
      this.mapSize / 2,
      this.mapSize / 2,
      10
    );

    // 监听网络更新
    this.wsManager.on('UPDATE', (state) => {
      this.handleNetworkUpdate(state);
    });
    this.generateFoods();

    // 监听空格键触发分裂
    window.addEventListener('keydown', (event) => {
      if (event.code === 'Space') {
        this.handleSplit();
      }
    });
  }

  start() {
    this.running = true;
    requestAnimationFrame(this.gameLoop.bind(this));
  }

  stop() {
    this.running = false;
  }

  private gameLoop(timestamp: number) {
    if (!this.running) return;

    const deltaTime = timestamp - this.lastTime;
    this.lastTime = timestamp;

    this.update(deltaTime);
    this.render();

    requestAnimationFrame(this.gameLoop.bind(this));
  }

  private handleNetworkUpdate(state: any) {
    // 参数验证
    if (!state || (state.type === 'UPDATE' && (!state.state || !Array.isArray(state.state.players) || !Array.isArray(state.state.foods)))) {
      console.warn('Invalid game state received:', state);
      return;
    }
    
    // 统一处理状态对象
    const gameState = state.type === 'UPDATE' ? state.state : state;

    // 更新其他玩家
    gameState.players.forEach((remotePlayer: any) => {
      if (remotePlayer.id === this.playerId) return;
      
      let player = this.remotePlayers.get(remotePlayer.id);
      if (!player) {
        player = new Player(
          remotePlayer.id,
          remotePlayer.name,
          remotePlayer.x,
          remotePlayer.y,
          remotePlayer.mass
        );
        this.remotePlayers.set(remotePlayer.id, player);
      }
      
      player.x = remotePlayer.x;
      player.y = remotePlayer.y;
      player.mass = remotePlayer.mass;
    });

    // 更新食物
    if (gameState.foods && Array.isArray(gameState.foods)) {
      this.foods = gameState.foods.map((food: any) =>
        new Food(food.x, food.y)
      );
    } else {
      console.warn('Invalid or missing foods array in game state:', gameState);
    }
  }

  private update(deltaTime: number) {
    // 发送玩家状态
    this.wsManager.send('PLAYER_UPDATE', {
      x: this.player.x,
      y: this.player.y,
      mass: this.player.mass,
      direction: this.inputManager.getDirection()
    });

    // 更新玩家位置
    const direction = this.inputManager.getDirection();
    this.player.move(direction.x, direction.y, deltaTime);
    this.splitPlayers.forEach(player => player.move(direction.x, direction.y, deltaTime));

    // 更新相机位置
    this.camera.follow(this.player);

    // 检测食物碰撞
    this.checkFoodCollisions();
    
    // 检测分裂球体的合并
    this.checkMerge();

    // 补充食物
    if (this.foods.length < this.maxFoods) {
      this.generateFoods(10);
    }
  }

  private render() {
    // 清空画布
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // 保存当前上下文状态
    this.ctx.save();

    // 应用相机变换
    this.ctx.translate(
      this.canvas.width / 2 - this.camera.position.x,
      this.canvas.height / 2 - this.camera.position.y
    );

    // 绘制网格背景
    this.renderGrid();

    // 绘制食物
    for (const food of this.foods) {
      food.render(this.ctx);
    }

    // 绘制所有玩家球体
    this.player.render(this.ctx);
    this.splitPlayers.forEach(player => player.render(this.ctx));
    this.remotePlayers.forEach(player => player.render(this.ctx));

    // 恢复上下文状态
    this.ctx.restore();
  }

  private renderGrid() {
    const gridSize = 50;

    this.ctx.strokeStyle = '#ddd';
    this.ctx.lineWidth = 1;

    // 计算视口范围内的网格线
    const startX = Math.floor((this.camera.position.x - this.canvas.width / 2) / gridSize) * gridSize;
    const startY = Math.floor((this.camera.position.y - this.canvas.height / 2) / gridSize) * gridSize;
    const endX = startX + this.canvas.width + gridSize;
    const endY = startY + this.canvas.height + gridSize;

    // 绘制垂直线
    for (let x = startX; x <= endX; x += gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, startY);
      this.ctx.lineTo(x, endY);
      this.ctx.stroke();
    }

    // 绘制水平线
    for (let y = startY; y <= endY; y += gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(startX, y);
      this.ctx.lineTo(endX, y);
      this.ctx.stroke();
    }
  }

  private generateFoods(count: number = 100) {
    for (let i = 0; i < count && this.foods.length < this.maxFoods; i++) {
      const x = Math.random() * this.mapSize;
      const y = Math.random() * this.mapSize;
      this.foods.push(new Food(x, y));
    }
  }

  private checkFoodCollisions() {
    this.foods = this.foods.filter(food => {
      // 检查主球体碰撞
      if (food.isColliding(this.player)) {
        this.player.mass += food.mass;
        return false;
      }

      // 检查分裂球体碰撞
      for (const splitPlayer of this.splitPlayers) {
        if (food.isColliding(splitPlayer)) {
          splitPlayer.mass += food.mass;
          return false;
        }
      }

      return true;
    });
  }

  private handleSplit() {
    const newPlayer = this.player.split();
    if (newPlayer) {
      this.splitPlayers.push(newPlayer);
    }

    // 对每个分裂球体尝试分裂
    const newSplitPlayers: Player[] = [];
    this.splitPlayers.forEach(player => {
      const split = player.split();
      if (split) {
        newSplitPlayers.push(split);
      }
    });
    this.splitPlayers.push(...newSplitPlayers);
  }

  private checkMerge() {
    // 检查分裂球体之间的合并
    for (let i = this.splitPlayers.length - 1; i >= 0; i--) {
      const player1 = this.splitPlayers[i];

      // 检查与主球体的合并
      if (player1.canMerge(this.player)) {
        this.player.merge(player1);
        this.splitPlayers.splice(i, 1);
        continue;
      }

      // 检查与其他分裂球体的合并
      for (let j = i - 1; j >= 0; j--) {
        const player2 = this.splitPlayers[j];
        if (player1.canMerge(player2)) {
          player2.merge(player1);
          this.splitPlayers.splice(i, 1);
          break;
        }
      }
    }
  }
}