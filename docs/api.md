# 球球大作战 API 文档

## 概述

本文档描述了球球大作战游戏客户端和服务器之间的通信接口。通信基于WebSocket协议，数据格式为JSON。

## 连接建立

客户端通过WebSocket连接到服务器：

```
ws://[server-address]:[port]/game
```

## 消息格式

所有消息都遵循以下JSON格式：

```json
{
  "type": "消息类型",
  "data": {
    // 消息数据，根据消息类型不同而不同
  }
}
```

## 客户端到服务器的消息

### 1. 玩家加入游戏

**消息类型**: `join`

**数据格式**:
```json
{
  "type": "join",
  "data": {
    "name": "玩家名称"
  }
}
```

### 2. 玩家移动

**消息类型**: `move`

**数据格式**:
```json
{
  "type": "move",
  "data": {
    "angle": 45.0,  // 移动角度，0-360度
    "timestamp": 1647834567890  // 客户端时间戳，用于同步
  }
}
```

### 3. 玩家分裂

**消息类型**: `split`

**数据格式**:
```json
{
  "type": "split",
  "data": {
    "timestamp": 1647834567890  // 客户端时间戳
  }
}
```

### 4. 玩家弹射质量

**消息类型**: `eject`

**数据格式**:
```json
{
  "type": "eject",
  "data": {
    "timestamp": 1647834567890  // 客户端时间戳
  }
}
```

### 5. 玩家离开游戏

**消息类型**: `leave`

**数据格式**:
```json
{
  "type": "leave",
  "data": {}
}
```

## 服务器到客户端的消息

### 1. 游戏初始化

**消息类型**: `init`

**数据格式**:
```json
{
  "type": "init",
  "data": {
    "playerId": "唯一玩家ID",
    "map": {
      "width": 5000,
      "height": 5000
    },
    "players": [
      {
        "id": "玩家ID",
        "name": "玩家名称",
        "cells": [
          {
            "id": "细胞ID",
            "x": 100,
            "y": 200,
            "radius": 20,
            "color": "#FF0000"
          }
        ]
      }
    ],
    "food": [
      {
        "id": "食物ID",
        "x": 300,
        "y": 400,
        "radius": 5,
        "color": "#00FF00"
      }
    ],
    "viruses": [
      {
        "id": "病毒ID",
        "x": 500,
        "y": 600,
        "radius": 30
      }
    ]
  }
}
```

### 2. 游戏状态更新

**消息类型**: `update`

**数据格式**:
```json
{
  "type": "update",
  "data": {
    "timestamp": 1647834567890,  // 服务器时间戳
    "players": [
      {
        "id": "玩家ID",
        "cells": [
          {
            "id": "细胞ID",
            "x": 110,
            "y": 210,
            "radius": 22
          }
        ]
      }
    ],
    "food": [
      {
        "id": "食物ID",
        "x": 300,
        "y": 400,
        "radius": 5,
        "color": "#00FF00"
      }
    ],
    "newFood": [
      {
        "id": "新食物ID",
        "x": 350,
        "y": 450,
        "radius": 5,
        "color": "#0000FF"
      }
    ],
    "deletedEntities": ["实体ID1", "实体ID2"]  // 被删除的实体ID列表
  }
}
```

### 3. 玩家加入通知

**消息类型**: `playerJoin`

**数据格式**:
```json
{
  "type": "playerJoin",
  "data": {
    "id": "玩家ID",
    "name": "玩家名称",
    "cells": [
      {
        "id": "细胞ID",
        "x": 100,
        "y": 200,
        "radius": 20,
        "color": "#FF0000"
      }
    ]
  }
}
```

### 4. 玩家离开通知

**消息类型**: `playerLeave`

**数据格式**:
```json
{
  "type": "playerLeave",
  "data": {
    "id": "玩家ID"
  }
}
```

### 5. 排行榜更新

**消息类型**: `leaderboard`

**数据格式**:
```json
{
  "type": "leaderboard",
  "data": {
    "leaders": [
      {
        "id": "玩家ID",
        "name": "玩家名称",
        "score": 1000
      }
    ]
  }
}
```

### 6. 游戏结束（玩家死亡）

**消息类型**: `gameOver`

**数据格式**:
```json
{
  "type": "gameOver",
  "data": {
    "score": 1500,  // 最终得分
    "rank": 5,      // 最终排名
    "timeAlive": 300  // 存活时间（秒）
  }
}
```

### 7. 错误消息

**消息类型**: `error`

**数据格式**:
```json
{
  "type": "error",
  "data": {
    "code": 1001,
    "message": "错误描述"
  }
}
```

## 错误代码

| 代码 | 描述 |
|------|------|
| 1001 | 无效的消息格式 |
| 1002 | 无效的操作 |
| 1003 | 服务器内部错误 |
| 1004 | 连接超时 |
| 1005 | 服务器已满 |

## 数据同步策略

1. 客户端以固定间隔（如50ms）发送移动指令
2. 服务器以固定间隔（如100ms）广播游戏状态更新
3. 客户端使用插值和预测技术平滑显示其他玩家的移动
4. 时间戳用于处理网络延迟和包丢失

## 安全考虑

1. 所有游戏逻辑在服务器端执行，客户端仅负责显示和输入
2. 服务器对所有客户端输入进行验证，防止作弊
3. 使用限流措施防止DOS攻击
4. 考虑使用TLS加密WebSocket连接（wss://）
