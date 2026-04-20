#include <curl/curl.h>

#include <chrono>
#include <cmath>
#include <cstdlib>
#include <iostream>
#include <random>
#include <sstream>
#include <string>
#include <thread>

namespace {

size_t discard_write(char * /*ptr*/, size_t size, size_t nmemb, void * /*userdata*/) {
  return size * nmemb;
}

std::string env_or(const char *name, const char *fallback) {
  const char *v = std::getenv(name);
  return (v && v[0]) ? std::string(v) : std::string(fallback);
}

bool post_reading(const std::string &base_url, const std::string &api_key, const char *sensor_id,
                  double value) {
  CURL *curl = curl_easy_init();
  if (!curl) {
    std::cerr << "curl_easy_init failed\n";
    return false;
  }

  const std::string url = base_url + "/api/readings/sensors/" + sensor_id;
  std::ostringstream body;
  body << "{\"reading\":" << value << "}";
  const std::string payload = body.str();

  curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
  curl_easy_setopt(curl, CURLOPT_POSTFIELDS, payload.c_str());
  curl_easy_setopt(curl, CURLOPT_POSTFIELDSIZE, static_cast<long>(payload.size()));

  struct curl_slist *headers = nullptr;
  headers = curl_slist_append(headers, "Content-Type: application/json");
  const std::string key_line = "X-API-Key: " + api_key;
  headers = curl_slist_append(headers, key_line.c_str());
  curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
  curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, discard_write);
  curl_easy_setopt(curl, CURLOPT_TIMEOUT, 5L);

  const CURLcode res = curl_easy_perform(curl);
  long http_code = 0;
  curl_easy_getinfo(curl, CURLINFO_RESPONSE_CODE, &http_code);

  curl_slist_free_all(headers);
  curl_easy_cleanup(curl);

  if (res != CURLE_OK) {
    std::cerr << "curl error: " << curl_easy_strerror(res) << "\n";
    return false;
  }
  if (http_code < 200 || http_code >= 300) {
    std::cerr << "HTTP " << http_code << " for sensor " << sensor_id << "\n";
    return false;
  }
  return true;
}

}  // namespace

int main() {
  const std::string host = env_or("API_HOST", "192.168.1.3");
  const std::string port = env_or("API_PORT", "8888");
  const std::string api_key = env_or("API_KEY", "81eRP7oVkkhOPtMyWHAQfzhGvSvid48z");

  const std::string base = std::string("http://") + host + ":" + port;

  CURLcode g = curl_global_init(CURL_GLOBAL_DEFAULT);
  if (g != CURLE_OK) {
    std::cerr << "curl_global_init failed\n";
    return 1;
  }
  std::atexit([]() { curl_global_cleanup(); });

  std::cout << "Simulating 4 sensors every 1s -> " << base << "\n";
  std::cout << "Ctrl+C to stop.\n";

  std::mt19937 rng{std::random_device{}()};
  std::uniform_real_distribution<double> noise(-0.3, 0.3);

  int tick = 0;
  for (;; ++tick) {
    const double t = tick * 0.05;
    // Fake waves + small noise (same four logical channels as firmware)
    const double temp = 22.0 + 3.0 * std::sin(t) + noise(rng);
    const double humidity = 50.0 + 10.0 * std::cos(t * 0.7) + noise(rng);
    const double wetness = 400.0 + 150.0 * std::sin(t * 1.3) + 20.0 * noise(rng);
    const double sound = std::max(0.0, 200.0 + 300.0 * std::abs(std::sin(t * 2.1)) + 50.0 * noise(rng));

    const bool ok1 = post_reading(base, api_key, "1", temp);
    const bool ok2 = post_reading(base, api_key, "2", humidity);
    const bool ok3 = post_reading(base, api_key, "3", wetness);
    const bool ok4 = post_reading(base, api_key, "4", sound);

    std::cout << "tick " << tick << " temp=" << temp << " hum=" << humidity << " wet=" << wetness
              << " snd=" << sound << " -> " << (ok1 && ok2 && ok3 && ok4 ? "OK" : "partial fail")
              << "\n";

    std::this_thread::sleep_for(std::chrono::seconds(1));
  }
  return 0;
}
