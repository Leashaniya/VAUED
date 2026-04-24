/****************************
ESP32 Multi-Sensor Baby Monitor
Sensors: DHT11, Liquid/Wetness, Sound, LDR
Actuator: Servo motor
Backend: custom IoT API (JSON + X-API-Key)
****************************/

#include <WiFi.h>
#include <HTTPClient.h>
#include <DHT.h>
#include <ESP32Servo.h>

// --------------------- WiFi ---------------------
char ssid[] = "Galaxy A04s FB06";
char pass[] = "12345678";

// --------------------- IoT API ---------------------
#define API_HOST "192.168.8.199"
#define API_PORT 8888
#define API_KEY "81eRP7oVkkhOPtMyWHAQfzhGvSvid48z"

// Sensor IDs on server
#define SENSOR_TEMP "1"
#define SENSOR_HUMIDITY "2"
#define SENSOR_WETNESS "3"
#define SENSOR_SOUND "4"
#define SENSOR_LDR "5"  // New Sensor ID for Light Status

// --------------------- Sensor Pins ---------------------
#define DHTPIN 4
#define DHTTYPE DHT11

#define MOISTURE_PIN 35
#define SOUND_PIN 34
#define SERVO_PIN 13
#define LDR_PIN 32    // Pin for LDR 1
#define LDR_PIN_2 33  // Pin for LDR 2

#define SOUND_THRESHOLD 1000
#define WETNESS_THRESHOLD 700

// --------------------- Objects ---------------------
DHT dht(DHTPIN, DHTTYPE);
Servo myServo;

// --------------------- Timing Variables ---------------------
unsigned long lastDHTRead = 0;
unsigned long lastMoistureRead = 0;
unsigned long lastApiPush = 0;

const unsigned long DHT_INTERVAL = 2000;
const unsigned long MOISTURE_INTERVAL = 500;
const unsigned long API_POST_INTERVAL = 1000;

// Last values pushed or eligible for push
float lastTemp = NAN;
float lastHumidity = NAN;
int lastWetness = 0;
int lastSound = 0;
int lastLdrStatus = 1; // 1 for safe, 0 for unsafe
bool haveDht = false;

// --------------------- Servo Variables ---------------------
bool servoActive = false;
int servoPos = 90;
int servoDir = 1;

unsigned long lastServoMove = 0;
const unsigned long SERVO_STEP_DELAY = 0;

const int SERVO_MIN = 45;
const int SERVO_MAX = 135;

int swingCount = 0;
int maxSwings = 5;

// --------------------- Sound Variables ---------------------
int baseline = 0;

bool postReading(const char* sensorId, double value) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[API] WiFi not connected");
    return false;
  }

  HTTPClient http;
  String url = String("http://") + API_HOST + ":" + String(API_PORT) + "/api/readings/sensors/" + sensorId;

  if (!http.begin(url)) {
    Serial.println("[API] http.begin failed");
    return false;
  }

  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-API-Key", API_KEY);

  char body[64];
  snprintf(body, sizeof(body), "{\"reading\":%.4f}", value);

  int code = http.POST(body);
  Serial.printf("[API] POST /sensors/%s -> HTTP %d\n", sensorId, code);
  if (code < 200 || code >= 300) {
    String err = http.getString();
    if (err.length() > 0) Serial.println(err);
  }
  http.end();
  return code >= 200 && code < 300;
}

void pushReadingsToApi() {
  if (haveDht) {
    postReading(SENSOR_TEMP, lastTemp);
    postReading(SENSOR_HUMIDITY, lastHumidity);
  }
  postReading(SENSOR_WETNESS, (double)lastWetness);
  postReading(SENSOR_SOUND, (double)lastSound);
  postReading(SENSOR_LDR, (double)lastLdrStatus); // Push LDR status to API
}

void setup() {
  Serial.begin(115200);

  Serial.println("======================================");
  Serial.println("ESP32 Baby Monitor System Starting...");
  Serial.println("Sensors: DHT11 | Wetness | Sound | LDR");
  Serial.println("Servo: GPIO 13");
  Serial.println("======================================");

  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, pass);
  Serial.print("WiFi connecting");
  unsigned long wifiStart = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - wifiStart < 30000) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("WiFi OK, IP: ");
    Serial.println(WiFi.localIP());
  }

  dht.begin();
  myServo.attach(SERVO_PIN);
  myServo.write(servoPos);

  // Initialize LDR pins
  pinMode(LDR_PIN, INPUT);
  pinMode(LDR_PIN_2, INPUT);

  Serial.println("System Ready.");
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    WiFi.reconnect();
    delay(1000);
  }

  unsigned long currentMillis = millis();

  // --------- LDR Sensor Logic ----------
  int ldrValue = digitalRead(LDR_PIN);
  int ldrValue2 = digitalRead(LDR_PIN_2);

  if (ldrValue == HIGH || ldrValue2 == HIGH) {
    // If either sensor detects low light (assuming HIGH means dark for your sensor)
    if(lastLdrStatus != 0) Serial.println("Baby is unsafe (low light detected)");
    lastLdrStatus = 0; 
  } else {
    if(lastLdrStatus != 1) Serial.println("Baby is safe (light intact)");
    lastLdrStatus = 1;
  }

  // --------- DHT11 ----------
  if (currentMillis - lastDHTRead >= DHT_INTERVAL) {
    lastDHTRead = currentMillis;
    float humidity = dht.readHumidity();
    float temperature = dht.readTemperature();

    if (!isnan(humidity) && !isnan(temperature)) {
      haveDht = true;
      lastTemp = temperature;
      lastHumidity = humidity;
    }
  }

  // --------- Wetness Sensor ----------
  if (currentMillis - lastMoistureRead >= MOISTURE_INTERVAL) {
    lastMoistureRead = currentMillis;
    int rawValue = analogRead(MOISTURE_PIN);
    int wetness = (4095 - rawValue) / 4;
    lastWetness = wetness;

    if (wetness > WETNESS_THRESHOLD && !servoActive) {
      Serial.println("!!!!! Pee Detected !!!!!");
      servoActive = true;
      servoDir = 1;
      swingCount = 0;
      maxSwings = 2;
    }
  }

  // --------- Sound Sensor ----------
  int rawSound = analogRead(SOUND_PIN);
  baseline = (baseline * 9 + rawSound) / 10;
  int soundValue = max(0, (rawSound - baseline) * 5);
  lastSound = soundValue;

  if (soundValue >= SOUND_THRESHOLD && !servoActive) {
    Serial.println("!!!!! Cry Detected !!!!!");
    servoActive = true;
    servoDir = 1;
    swingCount = 0;
    maxSwings = 2;
  }

  // --------- Push to IoT API ----------
  if (currentMillis - lastApiPush >= API_POST_INTERVAL) {
    lastApiPush = currentMillis;
    pushReadingsToApi();
  }

  // --------- Servo Motion ----------
  if (servoActive) {
    if (currentMillis - lastServoMove >= SERVO_STEP_DELAY) {
      lastServoMove = currentMillis;
      servoPos += 5 * servoDir;

      if (servoPos >= SERVO_MAX) { servoPos = SERVO_MAX; servoDir = -1; swingCount++; }
      if (servoPos <= SERVO_MIN) { servoPos = SERVO_MIN; servoDir = 1; swingCount++; }

      myServo.write(servoPos);

      if (swingCount >= maxSwings * 2) {
        Serial.println("Servo swings completed");
        servoActive = false;
        servoPos = 90;
        myServo.write(servoPos);
      }
    }
  }
}