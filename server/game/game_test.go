package game

import (
	"testing"
	"time"
	"sync"
	"github.com/stretchr/testify/assert"
)

// 测试GameManager初始化
func TestNewGameManager(t *testing.T) {
	gm := NewGameManager()
	
	assert.NotNil(t, gm.Clients)
	assert.NotNil(t, gm.Players)
	assert.NotNil(t, gm.Foods)
	assert.NotNil(t, gm.Viruses)
	assert.Equal(t, 200, len(gm.Foods))
	assert.Equal(t, VIRUS_COUNT, len(gm.Viruses))
}

// 测试玩家注册
func TestHandleRegister(t *testing.T) {
	gm := NewGameManager()
	client := &Client{
		GameManager: gm,
		PlayerID:    "test-player",
		Send:        make(chan []byte, 256),
		ConnMutex:   &sync.Mutex{},
	}

	gm.handleRegister(client)

	assert.Equal(t, 1, len(gm.Clients))
	assert.Equal(t, 1, len(gm.Players))
	assert.NotEmpty(t, gm.Players[client.PlayerID])
}

// 测试玩家注销 
func TestHandleUnregister(t *testing.T) {
	gm := NewGameManager()
	client := &Client{
		GameManager: gm,
		PlayerID:    "test-player",
		Send:        make(chan []byte, 256),
		ConnMutex:   &sync.Mutex{},
	}

	gm.handleRegister(client)
	gm.handleUnregister(client)

	assert.Equal(t, 0, len(gm.Clients))
	assert.Equal(t, 0, len(gm.Players))
}

// 测试吞噬逻辑
func TestCanEat(t *testing.T) {
	eater := &Player{
		Mass: 20,
		Radius: massToRadius(20),
	}

	target := &Player{
		Mass: 10,
		Radius: massToRadius(10),
	}

	// 测试可以吞噬的情况
	assert.True(t, canEat(eater, target))

	// 测试质量不足
	target.Mass = 20
	assert.False(t, canEat(eater, target))

	// 测试距离过远
	eater.X = 100
	eater.Y = 100
	target.X = 200
	target.Y = 200
	assert.False(t, canEat(eater, target))
}

// 测试质量转半径计算
func TestMassToRadius(t *testing.T) {
	assert.InDelta(t, 17.8412, massToRadius(10), 0.0001)
	assert.InDelta(t, 56.419, massToRadius(100), 0.001)
}

// 测试玩家移动计算
func TestPlayerMovement(t *testing.T) {
	player := &Player{
		ID:   "test-move",
		X:    100,
		Y:    100,
		Mass: START_MASS,
		Direction: struct {
			X float64 `json:"x"`
			Y float64 `json:"y"`
		}{X: 1, Y: 0},
		Radius:     massToRadius(START_MASS),
		LastUpdate: time.Now().Add(-time.Second), // 1秒前
	}

	gm := NewGameManager()
	gm.Players[player.ID] = player
	gm.update()

	// 计算预期移动距离
	expectedDistance := calculateSpeed(player.Mass) * 1.0
	assert.InDelta(t, 100+expectedDistance, player.X, 0.001, "玩家移动距离不正确")
	assert.Equal(t, 100.0, player.Y, "Y坐标不应改变")
}

// 测试边界移动
func TestBoundaryMovement(t *testing.T) {
	player := &Player{
		ID:   "test-boundary",
		X:    MAP_SIZE - massToRadius(START_MASS) - 1,
		Y:    massToRadius(START_MASS) + 1,
		Mass: START_MASS,
		Direction: struct {
			X float64 `json:"x"`
			Y float64 `json:"y"`
		}{X: 1, Y: 1},
		Radius:     massToRadius(START_MASS),
		LastUpdate: time.Now().Add(-time.Second),
	}

	gm := NewGameManager()
	gm.Players[player.ID] = player
	gm.update()

	// 应该不会超出地图边界
	assert.LessOrEqual(t, player.X, MAP_SIZE-player.Radius, "X坐标超出地图边界")
	assert.GreaterOrEqual(t, player.Y, player.Radius, "Y坐标超出地图边界")
}

// 测试游戏更新逻辑
func TestUpdate(t *testing.T) {
	gm := NewGameManager()
	
	// 创建玩家并确保可以吃到食物
	player := &Player{
		ID: "test-player",
		X: 100,
		Y: 100,
		Mass: START_MASS,
		Direction: struct{
			X float64 `json:"x"`
			Y float64 `json:"y"`
		}{X: 0, Y: 0}, // 不移动
		Radius: massToRadius(START_MASS),
		LastUpdate: time.Now(),
	}
	gm.Players[player.ID] = player

	// 将食物放在玩家可吞噬范围内
	food := &Food{
		ID: "test-food",
		X: player.X + player.Radius/2, // 确保在吞噬范围内
		Y: player.Y,
		Mass: FOOD_SIZE,
		Radius: massToRadius(FOOD_SIZE),
	}
	gm.Foods[food.ID] = food

	// 清空自动补充的食物
	gm.Foods = make(map[string]*Food)
	gm.Foods[food.ID] = food

	gm.update()

	// 检查玩家是否吃到食物
	assert.Equal(t, float64(START_MASS + FOOD_SIZE), player.Mass)
	// 接受自动补充后的食物数量(10个)
	assert.Equal(t, 10, len(gm.Foods))
}
