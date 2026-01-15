# 车辆端接入指南 (Firmware Interface Guide)

**适用对象**: ESP32 固件开发人员
**协议类型**: WebSocket Client (Data-over-WS)
**服务器地址**: `ws://<SERVER_IP>:3000/ws`

## 1. 核心理念
*   **不要使用 RTSP**: 延迟太高且浏览器不兼容。
*   **不要使用 HTTP Server**: 无法实现内网穿透和主动连接。
*   **使用 WebSocket 纯流**: 
    *   **视频**: 直接发送 JPEG 二进制数据 (`sendBIN`)。
    *   **控制**: 接收 JSON 文本指令 (`onText`)。

## 2. 快速接入代码 (Arduino/PlatformIO)

请直接使用以下逻辑替换现有的 `loop()` 代码：

```cpp
#include <WebSocketsClient.h>

WebSocketsClient webSocket;

void setup() {
  Serial.begin(115200);
  // setupCamera()...
  // connectWiFi()...

  // 连接云控服务器
  // 注意：将其中的 IP 换成服务器电脑的 IP
  webSocket.begin("192.168.1.100", 3000, "/ws");
  webSocket.onEvent(onWebSocketEvent);
  webSocket.setReconnectInterval(5000); // 掉线自动重连
}

void loop() {
  webSocket.loop();

  // 视频推流逻辑
  if(webSocket.isConnected()) {
    camera_fb_t * fb = esp_camera_fb_get();
    if (fb) {
      // 【关键】直接发送二进制帧，不要 HTTP 头
      webSocket.sendBIN(fb->buf, fb->len);
      esp_camera_fb_return(fb);
    }
  }
}

// 事件回调
void onWebSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  if (type == WStype_CONNECTED) {
    // 注册身份
    webSocket.sendTXT("{\"type\":\"auth\",\"role\":\"vehicle\",\"id\":\"car-001\"}");
  } else if (type == WStype_TEXT) {
    // 处理 JSON 控制指令
    // 例如: {"type":"control", "payload":{"lx":1, "ly":0}}
    Serial.printf("[CMD] %s\n", payload);
  }
}

## 3. 性能优化 (Performance Tips)
*   **分辨率**: 请务必设置为 `FRAMESIZE_QVGA` (320x240)。这是保证 25fps 流畅度的关键。
*   **Quality**: 建议设置 `jpeg_quality = 12`。
*   详情请参考: [部署与性能优化指南](deployment_guide.md)
```
