type PlayerState = {
  id: string;
  name: string;
  x: number;
  y: number;
  mass: number;
  radius: number;
  color: string;
};

type FoodState = {
  id: string;
  x: number;
  y: number;
  mass: number;
  radius: number;
};

type VirusState = {
  id: string;
  x: number;
  y: number;
  mass: number;
  radius: number;
};

type GameState = {
  players: PlayerState[];
  foods: FoodState[];
  viruses: VirusState[];
};

type InitMessage = {
  type: 'INIT';
  playerId: string;
  state: GameState;
};

type UpdateMessage = {
  type: 'UPDATE';
  state: Partial<GameState>;
};

export class WebSocketManager {
  private ws!: WebSocket; // 使用明确赋值断言
  private playerId: string = '';
  public onGameStateUpdate?: (state: Partial<GameState>) => void;
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
        const message = JSON.parse(event.data);
        const handler = this.messageHandlers.get(message.type);
        
        // 类型化消息处理
        switch (message.type) {
          case 'INIT':
            handler?.(message as InitMessage);
            break;
          case 'UPDATE':
            if (!message.state) {
              throw new Error('UPDATE消息缺少state字段');
            }
            handler?.(message as UpdateMessage);
            break;
          default:
            handler?.(message.data || message);
        }
      } catch (error) {
        const errorInfo = {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          rawData: event.data,
          readyState: this.ws.readyState
        };
        console.error('[WebSocket] 消息处理失败:', errorInfo);
      }
    };
  }

  // 注册默认消息处理器
  private registerDefaultHandlers() {
    this.on('UPDATE', (data: UpdateMessage) => {
      if (!data.state) {
        console.warn('[WebSocket] 收到空UPDATE消息');
        return;
      }
      
      // 强制初始化所有数组字段
      const safeState: Partial<GameState> = {
        players: Array.isArray(data.state.players) ? data.state.players : [],
        foods: Array.isArray(data.state.foods) ? data.state.foods : [],
        viruses: Array.isArray(data.state.viruses) ? data.state.viruses : []
      };
      
      console.debug('[WebSocket] 安全状态:', {
        players: safeState.players?.length ?? 0,
        foods: safeState.foods?.length ?? 0,
        viruses: safeState.viruses?.length ?? 0
      });
      
      if (this.onGameStateUpdate) {
        try {
          this.onGameStateUpdate(safeState);
        } catch (err) {
          console.error('[WebSocket] 状态更新失败:', {
            error: err instanceof Error ? err.message : String(err),
            state: safeState,
            rawData: data
          });
        }
      }
    });
    
    this.on('INIT', (data: InitMessage) => {
      console.debug('[WebSocket] 收到完整INIT消息:', JSON.stringify(data, null, 2));
      
      if (!data?.playerId || !data?.state) {
        console.error('[WebSocket] 无效的INIT消息', {
          missingFields: [
            ...(!data.playerId ? ['playerId'] : []),
            ...(!data.state ? ['state'] : [])
          ],
          rawData: data
        });
        return;
      }
      
      this.playerId = data.playerId;
      console.log(`[WebSocket] 玩家注册成功 ID: ${this.playerId}`, {
        players: data.state.players.length,
        foods: data.state.foods.length,
        viruses: data.state.viruses.length
      });
      
      // 触发游戏状态更新
      if (this.onGameStateUpdate) {
        this.onGameStateUpdate(data.state);
      }
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
  public send(type: string, data: any = {}) {
    if (this.ws.readyState !== WebSocket.OPEN) {
      console.warn(`[WebSocket] 连接未就绪，无法发送 ${type} 消息`);
      return false;
    }

    try {
      const message = { type, ...data };
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
          console.debug('[WebSocket] 注册流程收到INIT消息:', JSON.stringify(data, null, 2));
          if (!data?.playerId) {
            clearTimeout(timer);
            this.messageHandlers.delete('INIT');
            reject(`服务器返回无效的玩家ID，消息体: ${JSON.stringify(data)}`);
            return;
          }
          clearTimeout(timer);
          this.messageHandlers.delete('INIT');
          resolve(data.playerId);
        };
        
        this.on('INIT', handler);
        this.send('REGISTER', { name });
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