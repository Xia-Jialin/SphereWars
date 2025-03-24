import { Game } from './game/Game';
import { WebSocketManager } from './network/WebSocketManager';

document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.createElement('canvas');
  document.body.appendChild(canvas);

  // 设置Canvas全屏
  const resizeCanvas = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  };
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // 初始化游戏
  const game = new Game(canvas);
  const wsManager = new WebSocketManager('ws://localhost:8080/ws');

  // 启动游戏循环
  game.start();
});