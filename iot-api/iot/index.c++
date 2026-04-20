/****************************
ESP32 Multi-Sensor Baby Monitor
Sensors: DHT11, Liquid/Wetness, Sound
Actuator: Servo motor
Backend: custom IoT API (JSON + X-API-Key)
****************************/

#include <WiFi.h>
#include <HTTPClient.h>
#include <DHT.h>
#include <ESP32Servo.h>

// --------------------- WiFi ---------------------
char ssid[] = "Dialog 4G 290";
char pass[] = "FF0313cD";

// --------------------- IoT API ---------------------
#define API_HOST "192.168.8.199"
#define API_PORT 8888
#define API_KEY "81eRP7oVkkhOPtMyWHAQfzhGvSvid48z"

// Sensor IDs on server
#define SENSOR_TEMP "1"
#define SENSOR_HUMIDITY "2"
#define SENSOR_WETNESS "3"
#define SENSOR_SOUND "4"

// --------------------- Sensor Pins ---------------------
#define DHTPIN 4
#define DHTTYPE DHT11

#define MOISTURE_PIN 35
#define SOUND_PIN 34
#define SERVO_PIN 13
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
bool haveDht = false;

// --------------------- Servo Variables ---------------------
bool servoActive = false;
int servoPos = 90;
int servoDir = 1;

unsigned long lastServoMove = 0;
const unsigned long SERVO_STEP_DELAY = 0;

// --------------------- Servo range ---------------------
const int SERVO_MIN = 45;
const int SERVO_MAX = 135;

// --------------------- Swing control ---------------------
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
  String url =
      String("http://") + API_HOST + ":" + String(API_PORT) + "/api/readings/sensors/" + sensorId;

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
}

void setup() {

  Serial.begin(115200);

  Serial.println("======================================");
  Serial.println("ESP32 Baby Monitor System Starting...");
  Serial.println("Sensors: DHT11 | Wetness | Sound");
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
  } else {
    Serial.println("WiFi failed — will retry in loop");
  }

  dht.begin();

  myServo.attach(SERVO_PIN);
  myServo.write(servoPos);

  Serial.println("System Ready.");
}

void loop() {

  if (WiFi.status() != WL_CONNECTED) {
    WiFi.reconnect();
    delay(1000);
  }

  unsigned long currentMillis = millis();

  // --------- DHT11 ----------
  if (currentMillis - lastDHTRead >= DHT_INTERVAL) {

    lastDHTRead = currentMillis;

    float humidity = dht.readHumidity();
    float temperature = dht.readTemperature();

    if (!isnan(humidity) && !isnan(temperature)) {

      haveDht = true;
      lastTemp = temperature;
      lastHumidity = humidity;

      Serial.println("---- Environment Data ----");
      Serial.print("Temperature: ");
      Serial.print(temperature);
      Serial.println(" C");

      Serial.print("Humidity: ");
      Serial.print(humidity);
      Serial.println(" %");

      Serial.println("---------------------------");
    }
  }

  // --------- Wetness Sensor ----------
  if (currentMillis - lastMoistureRead >= MOISTURE_INTERVAL) {

    lastMoistureRead = currentMillis;

    int rawValue = analogRead(MOISTURE_PIN);

    int wetness = 4095 - rawValue;
    wetness = wetness / 4;
    lastWetness = wetness;

    Serial.print("Wetness Level: ");
    Serial.println(wetness);

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

  int soundValue = rawSound - baseline;

  if (soundValue < 0) soundValue = 0;

  soundValue = soundValue * 5;
  lastSound = soundValue;

  Serial.print("Sound Level: ");
  Serial.println(soundValue);

  if (soundValue >= SOUND_THRESHOLD && !servoActive) {

    Serial.println("!!!!! Cry Detected !!!!!");

    servoActive = true;
    servoDir = 1;
    swingCount = 0;
    maxSwings = 2;
  }

  // --------- Push to IoT API (interval) ----------
  if (currentMillis - lastApiPush >= API_POST_INTERVAL) {
    lastApiPush = currentMillis;
    pushReadingsToApi();
  }

  // --------- Servo Motion ----------
  if (servoActive) {

    if (currentMillis - lastServoMove >= SERVO_STEP_DELAY) {

      lastServoMove = currentMillis;

      servoPos += 5 * servoDir;

      if (servoPos >= SERVO_MAX) {
        servoPos = SERVO_MAX;
        servoDir = -1;
        swingCount++;
      }

      if (servoPos <= SERVO_MIN) {
        servoPos = SERVO_MIN;
        servoDir = 1;
        swingCount++;
      }

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
