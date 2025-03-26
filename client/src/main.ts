import { Game } from './game/Game';
import { WebSocketManager } from './network/WebSocketManager';

// 创建玩家名称输入对话框
function createNameInput(): Promise<string> {
  return new Promise((resolve) => {
    const div = document.createElement('div');
    div.style.position = 'fixed';
    div.style.top = '0';
    div.style.left = '0';
    div.style.width = '100%';
    div.style.height = '100%';
    div.style.backgroundColor = 'rgba(0,0,0,0.7)';
    div.style.display = 'flex';
    div.style.justifyContent = 'center';
    div.style.alignItems = 'center';
    div.style.zIndex = '1000';

    const form = document.createElement('div');
    form.style.backgroundColor = '#333';
    form.style.padding = '20px';
    form.style.borderRadius = '10px';

    const title = document.createElement('h2');
    title.textContent = '请输入玩家名称';
    title.style.color = 'white';
    title.style.marginTop = '0';
    form.appendChild(title);

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = '3-12个字符';
    input.style.padding = '10px';
    input.style.fontSize = '16px';
    input.style.width = '100%';
    input.style.marginBottom = '10px';
    form.appendChild(input);

    const button = document.createElement('button');
    button.textContent = '开始游戏';
    button.style.padding = '10px 20px';
    button.style.backgroundColor = '#4CAF50';
    button.style.color = 'white';
    button.style.border = 'none';
    button.style.borderRadius = '5px';
    button.style.cursor = 'pointer';

    button.onclick = () => {
      const name = input.value.trim();
      if (name.length >= 3 && name.length <= 12) {
        div.remove();
        resolve(name);
      } else {
        alert('名称需3-12个字符');
      }
    };
    form.appendChild(button);

    div.appendChild(form);
    document.body.appendChild(div);
    input.focus();
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  const canvas = document.createElement('canvas');
  document.body.appendChild(canvas);

  // 设置Canvas全屏
  const resizeCanvas = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  };
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  try {
    // 获取玩家名称
    const playerName = await createNameInput();
    
    // 初始化网络连接
    const wsManager = new WebSocketManager('ws://localhost:8080/ws');
    const playerId = await wsManager.register(playerName);

    // 初始化游戏
    const game = new Game(canvas, playerId, wsManager);
    game.start();

  } catch (error) {
    console.error('游戏初始化失败:', error);
    alert(`连接失败: ${error instanceof Error ? error.message : error}`);
    location.reload(); // 失败时重新加载页面
  }
});