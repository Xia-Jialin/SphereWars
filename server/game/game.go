package game

import (
	"encoding/json"
	"fmt"
	"log"
	"math"
	"math/rand"
	"sync"
	"time"
)

const (
	// 游戏配置常量
	FPS             = 60
	TICK_RATE       = 30
	MAX_PLAYERS     = 100
	START_MASS      = 10
	MIN_MASS        = 5
	MAX_MASS        = 10000
	FOOD_SIZE       = 5
	VIRUS_SIZE      = 20
	VIRUS_COUNT     = 10
	MAP_SIZE        = 10000
	UPDATE_INTERVAL = 50 // 毫秒
)

// 实体接口
type Entity interface {
	GetID() string
	GetX() float64
	GetY() float64
	GetMass() float64
	GetRadius() float64
}

// 玩家实体
type Player struct {
	ID        string  `json:"id"`
	Name      string  `json:"name"`
	X         float64 `json:"x"`
	Y         float64 `json:"y"`
	Mass      float64 `json:"mass"`
	Direction struct {
		X float64 `json:"x"`
		Y float64 `json:"y"`
	} `json:"direction"`
	Color      string  `json:"color"`
	Radius     float64 `json:"radius"`
	LastUpdate time.Time
}

func (p *Player) GetID() string {
	return p.ID
}

func (p *Player) GetX() float64 {
	return p.X
}

func (p *Player) GetY() float64 {
	return p.Y
}

func (p *Player) GetMass() float64 {
	return p.Mass
}

func (p *Player) GetRadius() float64 {
	return p.Radius
}

// 食物实体
type Food struct {
	ID     string  `json:"id"`
	X      float64 `json:"x"`
	Y      float64 `json:"y"`
	Mass   float64 `json:"mass"`
	Color  string  `json:"color"`
	Radius float64 `json:"radius"`
}

func (f *Food) GetID() string {
	return f.ID
}

func (f *Food) GetX() float64 {
	return f.X
}

func (f *Food) GetY() float64 {
	return f.Y
}

func (f *Food) GetMass() float64 {
	return f.Mass
}

func (f *Food) GetRadius() float64 {
	return f.Radius
}

// 病毒实体
type Virus struct {
	ID     string  `json:"id"`
	X      float64 `json:"x"`
	Y      float64 `json:"y"`
	Mass   float64 `json:"mass"`
	Color  string  `json:"color"`
	Radius float64 `json:"radius"`
}

func (v *Virus) GetID() string {
	return v.ID
}

func (v *Virus) GetX() float64 {
	return v.X
}

func (v *Virus) GetY() float64 {
	return v.Y
}

func (v *Virus) GetMass() float64 {
	return v.Mass
}

func (v *Virus) GetRadius() float64 {
	return v.Radius
}

// 游戏状态
type GameState struct {
	Players []Player `json:"players"`
	Foods   []Food   `json:"foods"`
	Viruses []Virus  `json:"viruses"`
}

// 游戏管理器
type GameManager struct {
	Clients    map[*Client]bool
	Players    map[string]*Player
	Foods      map[string]*Food
	Viruses    map[string]*Virus
	Broadcast  chan []byte
	Register   chan *Client
	Unregister chan *Client
	mutex      sync.RWMutex
	lastTick   time.Time
}

// 客户端连接
type Client struct {
	GameManager *GameManager
	PlayerID    string
	Send        chan []byte
	ConnMutex   *sync.Mutex
}

// 创建新的游戏管理器
func NewGameManager() *GameManager {
	rand.Seed(time.Now().UnixNano())

	gm := &GameManager{
		Clients:    make(map[*Client]bool),
		Players:    make(map[string]*Player),
		Foods:      make(map[string]*Food),
		Viruses:    make(map[string]*Virus),
		Broadcast:  make(chan []byte, 1000),
		Register:   make(chan *Client, 1000),
		Unregister: make(chan *Client, 1000),
		lastTick:   time.Now(),
	}

	// 初始化食物
	gm.initializeFood(200)

	// 初始化病毒
	gm.initializeViruses(VIRUS_COUNT)

	return gm
}

// 初始化食物
func (gm *GameManager) initializeFood(count int) {
	for i := 0; i < count; i++ {
		food := &Food{
			ID:     generateID(),
			X:      rand.Float64() * MAP_SIZE,
			Y:      rand.Float64() * MAP_SIZE,
			Mass:   FOOD_SIZE,
			Color:  getRandomFoodColor(),
			Radius: massToRadius(FOOD_SIZE),
		}
		gm.Foods[food.ID] = food
	}
}

// 初始化病毒
func (gm *GameManager) initializeViruses(count int) {
	for i := 0; i < count; i++ {
		virus := &Virus{
			ID:     generateID(),
			X:      rand.Float64() * MAP_SIZE,
			Y:      rand.Float64() * MAP_SIZE,
			Mass:   VIRUS_SIZE,
			Color:  "#32cd32", // 病毒绿色
			Radius: massToRadius(VIRUS_SIZE),
		}
		gm.Viruses[virus.ID] = virus
	}
}

// 启动游戏循环
func (gm *GameManager) Run() {
	ticker := time.NewTicker(time.Millisecond * UPDATE_INTERVAL)
	defer ticker.Stop()

	for {
		select {
		case client := <-gm.Register:
			gm.handleRegister(client)
		case client := <-gm.Unregister:
			gm.handleUnregister(client)
		case message := <-gm.Broadcast:
			for client := range gm.Clients {
				select {
				case client.Send <- message:
				default:
					close(client.Send)
					delete(gm.Clients, client)
				}
			}
		case <-ticker.C:
			gm.update()
		}
	}
}

// 处理新客户端注册
func (gm *GameManager) handleRegister(client *Client) {
	log.Println("开始处理客户端注册:", client.PlayerID)
	gm.mutex.Lock()
	log.Println("获取锁成功")
	gm.Clients[client] = true
	gm.mutex.Unlock()
	log.Println("客户端注册完成:", client.PlayerID)

	// 创建新玩家
	player := &Player{
		ID:         generateID(),
		Name:       "Player " + client.PlayerID,
		X:          rand.Float64() * MAP_SIZE,
		Y:          rand.Float64() * MAP_SIZE,
		Mass:       START_MASS,
		Color:      getRandomPlayerColor(),
		Radius:     massToRadius(START_MASS),
		LastUpdate: time.Now(),
	}

	client.PlayerID = player.ID

	gm.mutex.Lock()
	gm.Players[player.ID] = player
	gm.mutex.Unlock()

	// 发送初始化消息
	initMsg := struct {
		Type     string     `json:"type"`
		PlayerID string     `json:"playerId"`
		State    *GameState `json:"state"`
	}{
		Type:     "INIT",
		PlayerID: player.ID,
		State:    gm.getGameState(),
	}

	jsonMsg, err := json.Marshal(initMsg)
	if err != nil {
		log.Println("初始化消息序列化错误:", err)
		return
	}

	log.Printf("准备发送INIT消息给客户端 %s, 消息大小: %d bytes", client.PlayerID, len(jsonMsg))
	// 检查Send channel状态
	if cap(client.Send) == 0 {
		log.Printf("客户端 %s 的Send channel未初始化", client.PlayerID)
		return
	}
	
	// 尝试发送消息
	select {
	case client.Send <- jsonMsg:
		log.Printf("成功发送INIT消息给客户端 %s, 消息大小: %d bytes", client.PlayerID, len(jsonMsg))
	case <-time.After(5 * time.Second):
		log.Printf("发送INIT消息给客户端 %s 超时, Send channel状态: len=%d/%d",
			client.PlayerID, len(client.Send), cap(client.Send))
		// 尝试清理阻塞的channel
		select {
		case <-client.Send: // 尝试读取一个消息腾出空间
			log.Printf("从客户端 %s 的Send channel清理了一个阻塞消息", client.PlayerID)
			client.Send <- jsonMsg // 重试发送
			log.Printf("重试发送INIT消息成功")
		default:
			log.Printf("无法清理客户端 %s 的Send channel", client.PlayerID)
		}
	}

	// 通知其他玩家有新玩家加入
	joinMsg := struct {
		Type   string  `json:"type"`
		Player *Player `json:"player"`
	}{
		Type:   "PLAYER_JOINED",
		Player: player,
	}

	jsonJoinMsg, err := json.Marshal(joinMsg)
	if err != nil {
		log.Println("玩家加入消息序列化错误:", err)
		return
	}

	gm.Broadcast <- jsonJoinMsg
}

// 处理客户端离开
func (gm *GameManager) handleUnregister(client *Client) {
	gm.mutex.Lock()
	if _, ok := gm.Clients[client]; ok {
		delete(gm.Clients, client)
		close(client.Send)
	}

	// 移除玩家
	if client.PlayerID != "" {
		delete(gm.Players, client.PlayerID)

		// 通知其他玩家有玩家离开
		leaveMsg := struct {
			Type     string `json:"type"`
			PlayerID string `json:"playerId"`
		}{
			Type:     "PLAYER_LEFT",
			PlayerID: client.PlayerID,
		}

		jsonLeaveMsg, err := json.Marshal(leaveMsg)
		if err != nil {
			log.Println("玩家离开消息序列化错误:", err)
			return
		}

		gm.Broadcast <- jsonLeaveMsg
	}
	gm.mutex.Unlock()
}

// 游戏更新
func (gm *GameManager) update() {
	now := time.Now()
	// 记录时间差，暂时不使用
	_ = now.Sub(gm.lastTick).Seconds()
	gm.lastTick = now

	gm.mutex.Lock()

	// 检查食物数量，如果低于阈值则补充
	if len(gm.Foods) < 100 {
		for i := 0; i < 10; i++ {
			food := &Food{
				ID:     generateID(),
				X:      rand.Float64() * MAP_SIZE,
				Y:      rand.Float64() * MAP_SIZE,
				Mass:   FOOD_SIZE,
				Color:  getRandomFoodColor(),
				Radius: massToRadius(FOOD_SIZE),
			}
			gm.Foods[food.ID] = food
		}
	}

	// 检查病毒数量
	if len(gm.Viruses) < VIRUS_COUNT {
		virus := &Virus{
			ID:     generateID(),
			X:      rand.Float64() * MAP_SIZE,
			Y:      rand.Float64() * MAP_SIZE,
			Mass:   VIRUS_SIZE,
			Color:  "#32cd32",
			Radius: massToRadius(VIRUS_SIZE),
		}
		gm.Viruses[virus.ID] = virus
	}

	// 更新玩家位置
	for _, player := range gm.Players {
		// 更新玩家位置逻辑
		// 根据上次更新时间计算玩家位置
		timeSinceUpdate := time.Since(player.LastUpdate).Seconds()
		if timeSinceUpdate > 0 {
			// 根据方向更新位置
			speed := calculateSpeed(player.Mass)
			player.X += player.Direction.X * speed * timeSinceUpdate
			player.Y += player.Direction.Y * speed * timeSinceUpdate

			// 确保玩家不会离开地图边界
			player.X = math.Max(player.Radius, math.Min(MAP_SIZE-player.Radius, player.X))
			player.Y = math.Max(player.Radius, math.Min(MAP_SIZE-player.Radius, player.Y))
		}

		// 检测玩家是否吃到食物
		for foodID, food := range gm.Foods {
			if canEat(player, food) {
				player.Mass += food.Mass
				player.Radius = massToRadius(player.Mass)
				delete(gm.Foods, foodID)
			}
		}

		// 检测玩家之间的吞噬
		for otherID, other := range gm.Players {
			if player.ID != otherID && canEat(player, other) {
				player.Mass += other.Mass
				player.Radius = massToRadius(player.Mass)
				// Bug修复: 将 gm.players 替换为 gm.Players，因为 GameManager 结构体中定义的是 Players 字段
				delete(gm.Players, otherID)

				// 通知被吞噬的玩家
				leftMsg := struct {
					Type     string `json:"type"`
					PlayerID string `json:"playerId"`
				}{
					Type:     "PLAYER_LEFT",
					PlayerID: otherID,
				}

				jsonLeftMsg, _ := json.Marshal(leftMsg)
				gm.Broadcast <- jsonLeftMsg
				break
			}
		}
	}
	gm.mutex.Unlock()

	// 发送游戏状态更新
	gm.sendStateUpdate()
}

// 判断是否可以吃掉目标
func canEat(eater, target Entity) bool {
	dx := eater.GetX() - target.GetX()
	dy := eater.GetY() - target.GetY()
	distance := math.Sqrt(dx*dx + dy*dy)

	// 如果两个实体的距离小于吞噬者的半径，并且吞噬者质量大于目标的1.2倍，则可以吞噬
	return distance < eater.GetRadius() && eater.GetMass() > target.GetMass()*1.2
}

// 获取当前游戏状态
func (gm *GameManager) getGameState() *GameState {
	gm.mutex.RLock()
	defer gm.mutex.RUnlock()

	state := &GameState{
		Players: make([]Player, 0, len(gm.Players)),
		Foods:   make([]Food, 0, len(gm.Foods)),
		Viruses: make([]Virus, 0, len(gm.Viruses)),
	}

	for _, player := range gm.Players {
		state.Players = append(state.Players, *player)
	}

	for _, food := range gm.Foods {
		state.Foods = append(state.Foods, *food)
	}

	for _, virus := range gm.Viruses {
		state.Viruses = append(state.Viruses, *virus)
	}

	return state
}

// 发送游戏状态更新
func (gm *GameManager) sendStateUpdate() {
	state := gm.getGameState()

	updateMsg := struct {
		Type  string     `json:"type"`
		State *GameState `json:"state"`
	}{
		Type:  "UPDATE",
		State: state,
	}

	jsonMsg, err := json.Marshal(updateMsg)
	if err != nil {
		log.Println("状态更新消息序列化错误:", err)
		return
	}

	gm.Broadcast <- jsonMsg
}

// 处理玩家更新消息
func (gm *GameManager) HandlePlayerUpdate(playerID string, data map[string]interface{}) {
	gm.mutex.Lock()
	defer gm.mutex.Unlock()

	player, ok := gm.Players[playerID]
	if !ok {
		return
	}

	// 更新玩家位置和方向
	if x, ok := data["x"].(float64); ok {
		player.X = x
	}

	if y, ok := data["y"].(float64); ok {
		player.Y = y
	}

	if mass, ok := data["mass"].(float64); ok {
		player.Mass = mass
		player.Radius = massToRadius(mass)
	}

	if direction, ok := data["direction"].(map[string]interface{}); ok {
		if dx, ok := direction["x"].(float64); ok {
			player.Direction.X = dx
		}
		if dy, ok := direction["y"].(float64); ok {
			player.Direction.Y = dy
		}
	}

	player.LastUpdate = time.Now()
}

// 生成唯一ID
func generateID() string {
	return fmt.Sprintf("%d", time.Now().UnixNano()+rand.Int63())
}

// 根据质量计算半径
func massToRadius(mass float64) float64 {
	return math.Sqrt(mass * 100 / math.Pi)
}

// 根据质量计算速度
func calculateSpeed(mass float64) float64 {
	return 5 * math.Pow(mass, -0.2)
}

// 获取随机玩家颜色
func getRandomPlayerColor() string {
	colors := []string{
		"#ff7f50", "#87cefa", "#da70d6", "#32cd32",
		"#6495ed", "#ff69b4", "#9acd32", "#ffa07a",
		"#f08080", "#7b68ee",
	}
	return colors[rand.Intn(len(colors))]
}

// 获取随机食物颜色
func getRandomFoodColor() string {
	return "#ffcccb"
}
