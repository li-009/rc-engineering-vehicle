#include <Arduino.h>
#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>
#include "esp_camera.h"

// --- CONFIG ---
const char* SSID = "YOUR_WIFI_SSID";
const char* PASS = "YOUR_WIFI_PASS";
const char* SERVER_HOST = "192.168.1.100"; // Replace with your Server IP
const int   SERVER_PORT = 3000;
const char* VEHICLE_ID  = "car-001";

WebSocketsClient webSocket;

// --- CAMERA CONFIG ---
#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27
#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22

void setupCamera() {
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sscb_sda = SIOD_GPIO_NUM;
  config.pin_sscb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;
  
  if(psramFound()){
    config.frame_size = FRAMESIZE_QVGA; // 320x240 for Speed
    config.jpeg_quality = 15; // 0-63, lower is better
    config.fb_count = 2;
  } else {
    config.frame_size = FRAMESIZE_QVGA;
    config.jpeg_quality = 12;
    config.fb_count = 1;
  }

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Camera init failed with error 0x%x", err);
    return;
  }
}

void onWebSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
    switch(type) {
        case WStype_DISCONNECTED:
            Serial.println("[WS] Disconnected!");
            break;
        case WStype_CONNECTED:
            Serial.println("[WS] Connected to Server");
            // Auth Handshake
            {
              DynamicJsonDocument doc(200);
              doc["type"] = "auth";
              doc["role"] = "vehicle";
              doc["id"] = VEHICLE_ID;
              String json;
              serializeJson(doc, json);
              webSocket.sendTXT(json);
            }
            break;
        case WStype_TEXT:
            // Handle Control Commands
            // Serial.printf("[WS] Cmd: %s\n", payload);
            {
              DynamicJsonDocument doc(512);
              deserializeJson(doc, payload);
              const char* type = doc["type"];
              if (strcmp(type, "control") == 0) {
                 float ly = doc["payload"]["ly"];
                 // TODO: Drive Motors based on ly
                 Serial.printf("Throttle: %.2f\n", ly);
              }
            }
            break;
    }
}

void setup() {
  Serial.begin(115200);
  setupCamera();

  WiFi.begin(SSID, PASS);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi Connected");

  webSocket.begin(SERVER_HOST, SERVER_PORT, "/ws");
  webSocket.onEvent(onWebSocketEvent);
  webSocket.setReconnectInterval(5000);
}

void loop() {
  webSocket.loop();

  // Stream Video (Simple Logic: Send every frame)
  if(webSocket.isConnected()) {
    camera_fb_t * fb = esp_camera_fb_get();
    if (fb) {
      // Send Binary Frame
      webSocket.sendBIN(fb->buf, fb->len);
      esp_camera_fb_return(fb);
    }
  }
}
