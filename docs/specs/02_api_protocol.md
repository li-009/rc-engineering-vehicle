# 02_API接口协议定义 (API Protocol)
> **Role**: Master Architect
> **Rule**: All Worker AIs must strictly follow this protocol. No ad-hoc formats allowed.

## 1. WebSocket 连接协议
**Endpoint**: `ws://<server_ip>:3000/ws`

### 1.1 握手认证 (Handshake)
连接建立后，客户端必须立即发送第一条 JSON 消息进行注册。

**工程车 (Vehicle) 发送**:
```json
{
  "type": "auth",
  "role": "vehicle",
  "id": "car-001",
  "secret": "123456"
}
```

**控制端 (User) 发送**:
```json
{
  "type": "auth",
  "role": "user",
  "token": "user-token-xyz"
}
```

## 2. 状态交换协议

### 2.1 车辆列表 (Server -> User)
当用户订阅列表更新时推送。
```json
{
  "type": "car_list",
  "data": [
    { "id": "car-001", "status": "online", "ping": 45 },
    { "id": "car-002", "status": "busy", "ping": 120 }
  ]
}
```

### 2.2 控制指令 (User -> Server -> Vehicle)
用户发送给服务器，服务器透明转发给车。
```json
{
  "type": "control",
  "target_id": "car-001",
  "payload": {
    "lx": 0.5,  // 左摇杆 X轴 (-1.0 ~ 1.0)
    "ly": 1.0,  // 左摇杆 Y轴
    "rx": 0,    // 右摇杆
    "ry": 0,
    "btn_bucket": 1 // 铲斗动作
  }
}
```

## 3. 视频流协议 (Binary)
*   **Format**: Binary Message (ArrayBuffer)
*   **Header**: 
    *   Byte 0: `0x01` (Magic Byte, 标识这是视频帧)
    *   Byte 1-N: MJPEG Data
*   **Flow**: Vehicle -> Server -> User
