# 球球大作战 WebSocket API 文档 (v2.0)

## 基础信息
- **协议**: WebSocket (`ws://`)
- **地址**: `ws://[server]:8080/ws`
- **数据格式**: JSON
- **帧率**: 服务端20fps (50ms/update)

## 消息结构
```json
{
  "type": "消息类型",
  "data": {}  // 类型相关数据
}
```

## 客户端→服务端

### 1. 玩家注册 (REGISTER)
```json
{
  "type": "REGISTER",
  "name": "玩家名"
}
```

### 2. 玩家状态更新 (PLAYER_UPDATE)
```json
{
  "type": "PLAYER_UPDATE",
  "data": {
    "x": 100.5,       // X坐标
    "y": 200.3,       // Y坐标
    "mass": 15.2,     // 当前质量
    "direction": {    // 移动方向向量
      "x": 0.8,
      "y": -0.6
    }
  }
}
```

## 服务端→客户端

### 1. 初始化消息 (INIT)
```json
{
  "type": "INIT",
  "playerId": "p123",
  "state": {
    "players": [
      {
        "id": "p123",
        "name": "玩家1",
        "x": 100.0,
        "y": 200.0,
        "mass": 10.0,
        "radius": 17.8,
        "color": "#ff7f50"
      }
    ],
    "foods": [
      {"id": "f1", "x": 300.0, "y": 400.0, "mass": 5.0, "radius": 12.6}
    ],
    "viruses": [
      {"id": "v1", "x": 500.0, "y": 600.0, "mass": 20.0, "radius": 25.2}
    ]
  }
}
```

### 2. 游戏状态更新 (UPDATE)
```json
{
  "type": "UPDATE",
  "state": {
    "players": [...],  // 全量玩家列表
    "foods": [...],    // 全量食物列表
    "viruses": [...]   // 全量病毒列表
  }
}
```

### 3. 玩家加入 (PLAYER_JOINED)
```json
{
  "type": "PLAYER_JOINED",
  "player": {
    "id": "p124",
    "name": "玩家2",
    "x": 150.0,
    "y": 250.0,
    "mass": 10.0,
    "radius": 17.8,
    "color": "#87cefa"
  }
}
```

### 4. 玩家离开 (PLAYER_LEFT)
```json
{
  "type": "PLAYER_LEFT",
  "playerId": "p123"
}
```

## 实体属性说明
| 字段    | 类型   | 说明                          |
|---------|--------|-----------------------------|
| id      | string | 唯一标识符                     |
| x,y     | float  | 坐标位置 (范围: 0-10000)       |
| mass    | float  | 质量 (5-10000)               |
| radius  | float  | 计算值: √(mass*100/π)         |
| color   | string | HEX颜色码                     |

## 游戏规则
1. **移动速度**: `speed = 5 * mass^(-0.2)`
2. **吞噬条件**: 
   - 距离 < 吞噬者半径
   - 质量 > 目标质量×1.2
3. **地图边界**: 坐标强制约束在 [半径, 10000-半径]

## 错误处理
```json
{
  "type": "ERROR",
  "code": 4001,
  "message": "无效的消息格式"
}
```
| 代码 | 说明                 |
|------|---------------------|
| 4001 | 消息解析失败          |
| 4002 | 玩家未注册           |
| 4003 | 服务端内部错误        |

## 变更说明 (v2.0)
1. 简化消息结构，移除冗余字段
2. 统一使用全量状态更新
3. 明确物理计算规则
4. 增加错误代码规范