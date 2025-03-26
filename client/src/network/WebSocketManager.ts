type GameMessage = {
  type: string;
  data: any;
};

export class WebSocketManager {
  private ws!: WebSocket; // 使用明确赋值断言
  private playerId: string = '';
  private messageHandlers: Map<string, (data: any) => void> = new Map();
  private reconnectAttempts: number = 0;
  private readonly maxReconnectAttempts: number = 5;
  private readonly reconnectDelay: number = 3000;

  constructor(private url: string) {
    this.connect();
    this.registerDefaultHandlers();
  }

  // 核心连接方法
  private connect() {
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      console.log('[WebSocket] 连接已建立');
      this.reconnectAttempts = 0;
    };

    this.ws.onclose = () => {
      console.log('[WebSocket] 连接已关闭');
      this.tryReconnect();
    };

    this.ws.onerror = (error) => {
      console.error('[WebSocket] 连接错误:', error);
    };

    this.ws.onmessage = (event) => {
      try {
        const message: GameMessage = JSON.parse(event.data);
        const handler = this.messageHandlers.get(message.type);
        handler?.(message.data);
      } catch (error) {
        console.error('[WebSocket] 消息解析失败:', error);
      }
    };
  }

  // 注册默认消息处理器
  private registerDefaultHandlers() {
    this.on('INIT', (data) => {
      this.playerId = data.playerId;
      console.log(`[WebSocket] 玩家注册成功 ID: ${this.playerId}`);
    });

    this.on('ERROR', (data) => {
      console.error(`[WebSocket] 服务器错误: ${data.code} - ${data.message}`);
    });
  }

  // 公开API ------------------------------------------------------

  /** 注册消息处理器 */
  public on(messageType: string, handler: (data: any) => void) {
    this.messageHandlers.set(messageType, handler);
  }

  /** 发送消息到服务器 */
  public send(type: string, name: string = "") {
    if (this.ws.readyState !== WebSocket.OPEN) {
      console.warn(`[WebSocket] 连接未就绪，无法发送 ${type} 消息`);
      return false;
    }

    try {
      const message = { type, name };
      this.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error(`[WebSocket] 消息发送失败:`, error);
      return false;
    }
  }

  /** 玩家注册 */
  public async register(name: string, timeout = 5000): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!name) reject("玩家名称不能为空");

      // 等待连接就绪
      const waitForConnection = () => {
        if (this.ws.readyState === WebSocket.OPEN) {
          doRegister();
        } else if (this.ws.readyState === WebSocket.CLOSED) {
          reject('连接已关闭');
        } else {
          setTimeout(waitForConnection, 100);
        }
      };

      const doRegister = () => {
        const timer = setTimeout(() => {
          this.messageHandlers.delete('INIT');
          reject('注册超时');
        }, timeout);

        // 使用一次性监听器
        const handler = (data: any) => {
          clearTimeout(timer);
          this.messageHandlers.delete('INIT');
          resolve(data.playerId);
        };
        
        this.on('INIT', handler);
        this.send('REGISTER', name);
      };

      waitForConnection();
    });
  }

  // 重连逻辑 ------------------------------------------------------

  private tryReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(`[WebSocket] 超过最大重试次数 (${this.maxReconnectAttempts})`);
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts);

    console.log(`[WebSocket] 将在 ${delay}ms 后尝试重连 (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    setTimeout(() => {
      this.connect();
      this.registerDefaultHandlers();
    }, delay);
  }

  // 状态检查 ------------------------------------------------------

  public isConnected(): boolean {
    return this.ws.readyState === WebSocket.OPEN;
  }

  public getPlayerId(): string {
    return this.playerId;
  }
}