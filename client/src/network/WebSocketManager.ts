type GameMessage = {
  type: string;
  data: any;
};

export class WebSocketManager {
  private ws: WebSocket;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000;

  constructor(url: string) {
    this.ws = this.connect(url);
  }

  private connect(url: string): WebSocket {
    const ws = new WebSocket(url);

    ws.onopen = () => {
      console.log('WebSocket连接已建立');
      this.reconnectAttempts = 0;
    };

    ws.onclose = () => {
      console.log('WebSocket连接已关闭');
      this.tryReconnect(url);
    };

    ws.onerror = (error) => {
      console.error('WebSocket错误:', error);
    };

    ws.onmessage = this.handleMessage.bind(this);

    return ws;
  }

  private tryReconnect(url: string) {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('达到最大重连次数');
      return;
    }

    this.reconnectAttempts++;
    console.log(`尝试重连 (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    setTimeout(() => {
      this.ws = this.connect(url);
    }, this.reconnectDelay * this.reconnectAttempts);
  }

  private handleMessage(event: MessageEvent) {
    try {
      const message: GameMessage = JSON.parse(event.data);
      switch (message.type) {
        case 'gameState':
          this.handleGameState(message.data);
          break;
        case 'playerJoined':
          this.handlePlayerJoined(message.data);
          break;
        case 'playerLeft':
          this.handlePlayerLeft(message.data);
          break;
        default:
          console.log('未知消息类型:', message);
      }
    } catch (error) {
      console.error('消息处理错误:', error);
    }
  }

  private handleGameState(data: any) {
    // TODO: 更新游戏状态
    console.log('游戏状态更新:', data);
  }

  private handlePlayerJoined(data: any) {
    console.log('新玩家加入:', data);
  }

  private handlePlayerLeft(data: any) {
    console.log('玩家离开:', data);
  }

  sendMessage(type: string, data: any) {
    if (this.ws.readyState === WebSocket.OPEN) {
      const message: GameMessage = { type, data };
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket未连接，无法发送消息');
    }
  }
}