package main

import (
	"encoding/json"
	"log"
	"net/http"
	"qiuqiu/server/game"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // 允许所有跨域请求
	},
}

// 处理WebSocket连接
func handleWebSocket(gameManager *game.GameManager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Println("WebSocket升级失败:", err)
			return
		}

		// 记录新连接
		clientIP := r.RemoteAddr
		log.Printf("新客户端连接: %s", clientIP)

		defer func() {
			log.Printf("客户端断开连接: %s", clientIP)
			conn.Close()
		}()

		// 创建新客户端
		client := &game.Client{
			GameManager: gameManager,
			PlayerID:    "",
			Send:        make(chan []byte, 256),
			ConnMutex:   &sync.Mutex{},
		}

		// 延迟注销客户端
		defer func() {
			log.Println("准备注销客户端")
			gameManager.Unregister <- client
			log.Println("客户端已发送到注销通道")
		}()

		// 启动写循环
		go func() {
			for message := range client.Send {
				client.ConnMutex.Lock()
				if err := conn.WriteMessage(websocket.TextMessage, message); err != nil {
					client.ConnMutex.Unlock()
					return
				}
				client.ConnMutex.Unlock()
			}
		}()

		// 心跳机制
		go func() {
			ticker := time.NewTicker(10 * time.Second)
			defer ticker.Stop()
			for {
				<-ticker.C
				client.ConnMutex.Lock()
				if err := conn.WriteMessage(websocket.PingMessage, nil); err != nil {
					client.ConnMutex.Unlock()
					return
				}
				client.ConnMutex.Unlock()
			}
		}()

		// 消息处理循环
		log.Println("开始消息处理循环")
		for i := 0; ; i++ {
			if i%10 == 0 {
				log.Println("消息处理循环运行中...")
			}
			messageType, message, err := conn.ReadMessage()
			if err != nil {
				log.Println("读取消息错误:", err)
				break
			}
			log.Printf("收到WebSocket消息类型: %d", messageType)
			log.Printf("收到WebSocket消息内容: %s", string(message))

			// 解析客户端消息
			var msg map[string]interface{}
			if err := json.Unmarshal(message, &msg); err != nil {
				log.Println("消息解析错误:", err)
				continue
			}
			log.Printf("收到原始消息: %s", string(message))
			log.Printf("解析后消息: %+v", msg)

			// 根据消息类型处理
			if msgType, ok := msg["type"].(string); ok {
				switch msgType {
				case "REGISTER":
					log.Println("收到客户端注册消息")
					// 避免重复注册
					if client.PlayerID == "" {
						client.PlayerID = msg["name"].(string)
						gameManager.Register <- client
					}
				case "PLAYER_UPDATE":
					if data, ok := msg["data"].(map[string]interface{}); ok && client.PlayerID != "" {
						gameManager.HandlePlayerUpdate(client.PlayerID, data)
					}
				default:
					log.Printf("未处理的消息类型: %s", msgType)
				}
			}
		}
	}
}

func main() {
	// 创建游戏管理器
	gameManager := game.NewGameManager()
	go gameManager.Run()

	// 设置WebSocket处理
	http.HandleFunc("/ws", handleWebSocket(gameManager))

	// 启动HTTP服务器
	log.Println("服务器启动在 :8080")

	// 添加CORS中间件
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		// 处理WebSocket路径
		if r.URL.Path == "/ws" {
			handleWebSocket(gameManager)(w, r)
			return
		}

		http.DefaultServeMux.ServeHTTP(w, r)
	})

	log.Fatal(http.ListenAndServe(":8080", handler))
}
