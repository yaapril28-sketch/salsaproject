import React, { useState, useEffect, useRef } from "react";
import { 
  Home, 
  Lightbulb, 
  Thermometer, 
  Droplet, 
  Mic, 
  MicOff, 
  Settings, 
  Database, 
  Cpu, 
  Layers, 
  Terminal, 
  Check, 
  Copy, 
  FileCode, 
  Wifi, 
  WifiOff, 
  Clock, 
  Power, 
  AlertTriangle, 
  Trash2, 
  BookOpen, 
  Volume2, 
  Zap, 
  ArrowRight
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

// === TYPES ===
interface RelayState {
  relay1: number;
  relay2: number;
  relay3: number;
  relay4: number;
  lampCFL: number;
  lampLED: number;
}

interface SensorState {
  temperature: number;
  humidity: number;
}

interface SystemLog {
  id: string;
  time: string;
  message: string;
  type: "info" | "success" | "warn" | "error";
}

interface FirebaseConfig {
  databaseURL: string;
  apiKey: string;
  projectId: string;
}

// === PURE SOURCE CODE STRINGS FOR THE CAMPUS VIEWER ===
const SECURE_ARDUINO_CODE = `/**
 * ====================================================================
 * SKRIP FIRMWARE ESP32 SMART HOME - NEXUS IoT
 * KONEKSI FIREBASE REALTIME DATABASE & SENSOR DHT11/DHT22
 * Cocok untuk Presentasi Tugas Akhir & Proyek Kampus
 * ====================================================================
 */
#include <WiFi.h>
#include <Firebase_ESP_Client.h>
#include <DHT.h>

// Helper Token & Config Firebase
#include "addons/TokenHelper.h"
#include "addons/RTDBHelper.h"

// 1. KREDENSIAL WI-FI
#define WIFI_SSID "NAMA_WIFI_PROBI_ANDA"
#define WIFI_PASSWORD "PASSWORD_WIFI_ANDA"

// 2. KREDENSIAL FIREBASE (Sesuai Dashboard Web)
#define API_KEY "MASUKKAN_API_KEY_FIREBASE_PROYEK"
#define DATABASE_URL "https://PROYEK_ANDA-default-rtdb.firebaseio.com/"

// 3. KONFIGURASI SENSOR & PIN RELAY
#define DHTPIN 15          // Pin Data DHT terhubung ke GPIO15 ESP32
#define DHTTYPE DHT22      // Ganti jadi DHT11 jika menggunakan tipe DHT11
DHT dht(DHTPIN, DHTTYPE);

// Definisikan Pin Output Relay (Aktif LOW umumnya pada modul relay)
#define RELAY_1 2          // Lampu 1: Teras Depan (GPIO2)
#define RELAY_2 4          // Lampu 2: Ruang Tamu (GPIO4)
#define RELAY_3 5          // Lampu 3: Kamar Tidur (GPIO5)
#define RELAY_4 18         // Alat 4: Stop Kontak Dapur (GPIO18)

// 4. DEKLARASI DATABASE FIREBASE
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

unsigned long sendDataPrevMillis = 0;
bool signupOK = false;

void setup() {
  Serial.begin(115200);
  dht.begin();

  // Atur Pin Mode Relay sebagai OUTPUT
  pinMode(RELAY_1, OUTPUT);
  pinMode(RELAY_2, OUTPUT);
  pinMode(RELAY_3, OUTPUT);
  pinMode(RELAY_4, OUTPUT);

  // Secara default, matikan semua relay (HIGH = Mati jika modul Active LOW)
  digitalWrite(RELAY_1, HIGH);
  digitalWrite(RELAY_2, HIGH);
  digitalWrite(RELAY_3, HIGH);
  digitalWrite(RELAY_4, HIGH);

  // Hubungkan ke WiFi
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to Wi-Fi");
  while (WiFi.status() != WL_CONNECTED) {
    Serial.print(".");
    delay(300);
  }
  Serial.println();
  Serial.print("Connected with IP: ");
  Serial.println(WiFi.localIP());

  // Konfigurasi Kredensial Firebase
  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;

  // Sign up anonim/tanpa login untuk RTDB dasar
  if (Firebase.signUp(&config, &auth, "", "")) {
    Serial.println("Firebase SignUp OK");
    signupOK = true;
  } else {
    Serial.printf("Firebase SignUp Gagal: %s\\n", config.signer.signupError.message.c_str());
  }

  config.token_status_callback = tokenStatusCallback;
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);
}

void loop() {
  if (Firebase.ready() && signupOK) {
    
    // --- A. BACA DATA RELAY DARI FIREBASE (REALTIME) ---
    // Baca status Relay 1
    if (Firebase.RTDB.getInt(&fbdo, "/relay/relay1")) {
      if (fbdo.dataType() == "int") {
        int rVal = fbdo.intData();
        // Active LOW: 0 = Menyala (LOW), 1 = Mati (HIGH)
        digitalWrite(RELAY_1, rVal == 1 ? LOW : HIGH);
      }
    }
    
    // Baca status Relay 2
    if (Firebase.RTDB.getInt(&fbdo, "/relay/relay2")) {
      if (fbdo.dataType() == "int") {
        int rVal = fbdo.intData();
        digitalWrite(RELAY_2, rVal == 1 ? LOW : HIGH);
      }
    }

    // Baca status Relay 3
    if (Firebase.RTDB.getInt(&fbdo, "/relay/relay3")) {
      if (fbdo.dataType() == "int") {
        int rVal = fbdo.intData();
        digitalWrite(RELAY_3, rVal == 1 ? LOW : HIGH);
      }
    }

    // Baca status Relay 4
    if (Firebase.RTDB.getInt(&fbdo, "/relay/relay4")) {
      if (fbdo.dataType() == "int") {
        int rVal = fbdo.intData();
        digitalWrite(RELAY_4, rVal == 1 ? LOW : HIGH);
      }
    }

    // --- B. KIRIM DATA SENSOR SUHU & KELEMBABAN TIAP 5 DETIK ---
    if (millis() - sendDataPrevMillis > 5000 || sendDataPrevMillis == 0) {
      sendDataPrevMillis = millis();
      
      float t = dht.readTemperature();
      float h = dht.readHumidity();

      if (isnan(t) || isnan(h)) {
        Serial.println("Gagal membaca sensor DHT11/DHT22!");
      } else {
        Serial.printf("Mengirim -> Suhu: %.1f°C, Kelembaban: %.1f%%\\n", t, h);
        
        // Kirim Suhu ke Firebase RTDB
        if (Firebase.RTDB.setFloat(&fbdo, "/sensor/temperature", t)) {
          Serial.println("Suhu terkirim ke Firebase");
        } else {
          Serial.println("Gagal mengirim suhu: " + fbdo.errorReason());
        }

        // Kirim Kelembaban ke Firebase RTDB
        if (Firebase.RTDB.setFloat(&fbdo, "/sensor/humidity", h)) {
          Serial.println("Kelembaban terkirim ke Firebase");
        } else {
          Serial.println("Gagal mengirim kelembaban: " + fbdo.errorReason());
        }
      }
    }
  }
}
`;

export default function App() {
  // === LOCAL FORWARD STATE ===
  const [relays, setRelays] = useState<RelayState>({
    relay1: 0,
    relay2: 0,
    relay3: 0,
    relay4: 0,
    lampCFL: 0,
    lampLED: 0,
  });

  const [sensors, setSensors] = useState<SensorState>({
    temperature: 25.5,
    humidity: 58.0,
  });

  const [logs, setLogs] = useState<SystemLog[]>([
    {
      id: "init",
      time: new Date().toLocaleTimeString(),
      message: "Sistem cerdas Nexus IoT diinisialisasi sukses.",
      type: "info",
    }
  ]);

  const [currentTime, setCurrentTime] = useState("");
  const [isFirebaseConfigured, setIsFirebaseConfigured] = useState(false);
  const [firebaseKeys, setFirebaseKeys] = useState<FirebaseConfig>({
    databaseURL: "",
    apiKey: "",
    projectId: "nexus-smart-iot",
  });

  const [micActive, setMicActive] = useState(false);
  const [voiceText, setVoiceText] = useState("");
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);
  const [selectedGuideTab, setSelectedGuideTab] = useState<"esp32" | "wiring" | "deploy" | "vanilla">("esp32");

  // === DYNAMIC SOURCES STORES FOR LOCAL PRESENTATION COPY ===
  const [vanillaHTML, setVanillaHTML] = useState("Memuat file index.html...");
  const [vanillaCSS, setVanillaCSS] = useState("Memuat file style.css...");
  const [vanillaJS, setVanillaJS] = useState("Memuat file script.js...");
  const [vanillaFB, setVanillaFB] = useState("Memuat file firebase-config.js...");

  // Ref container for scroll constraints
  const logsEndRef = useRef<HTMLDivElement | null>(null);

  // Initialize clock, initial loads, simulation loop
  useEffect(() => {
    // 1. Loop Clock
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now.toTimeString().split(" ")[0]);
    }, 1000);

    // 2. Random Sensor Drift Simulation (To prove live updating is interactive)
    const driftTimer = setInterval(() => {
      setSensors(prev => {
        const driftT = (Math.random() - 0.5) * 0.4;
        const driftH = (Math.random() - 0.5) * 1.2;
        return {
          temperature: Math.min(Math.max(prev.temperature + driftT, 19.5), 41.2),
          humidity: Math.min(Math.max(prev.humidity + driftH, 30.0), 95.0),
        };
      });
    }, 4500);

    // 3. Load files from workspace dynamically to render in pure tab views!
    fetchVanillaSources();

    // 4. Try loading from localStorage
    const savedURL = localStorage.getItem("NEXUS_FB_DB_URL") || "";
    const savedKey = localStorage.getItem("NEXUS_FB_API_KEY") || "";
    const savedProj = localStorage.getItem("NEXUS_FB_PROJ_ID") || "nexus-smart-iot";
    if (savedURL) {
      setFirebaseKeys({ databaseURL: savedURL, apiKey: savedKey, projectId: savedProj });
      setIsFirebaseConfigured(true);
      pushLog("Menyinkronkan data dengan database cluster Firebase Anda...", "info");
    }

    return () => {
      clearInterval(timer);
      clearInterval(driftTimer);
    };
  }, []);

  // Sync scroll for logs
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  // Fetch the created files so the student can view/copy them directly in-app!
  const fetchVanillaSources = async () => {
    try {
      const responseHtml = await fetch("/vanilla-web/index.html");
      if (responseHtml.ok) setVanillaHTML(await responseHtml.text());
      const responseCss = await fetch("/vanilla-web/style.css");
      if (responseCss.ok) setVanillaCSS(await responseCss.text());
      const responseJs = await fetch("/vanilla-web/script.js");
      if (responseJs.ok) setVanillaJS(await responseJs.text());
      const responseFb = await fetch("/vanilla-web/firebase-config.js");
      if (responseFb.ok) setVanillaFB(await responseFb.text());
    } catch (e) {
      console.log("Failed reading sources directly, writing boilerplate code into view.");
    }
  };

  // Push custom logs helper
  const pushLog = (message: string, type: "info" | "success" | "warn" | "error" = "info") => {
    const timestamp = new Date().toLocaleTimeString().split(" ")[0];
    setLogs(prev => [
      ...prev,
      {
        id: Math.random().toString(),
        time: timestamp,
        message,
        type,
      }
    ]);
  };

  // Helper trigger vocal synthesized responses in Indonesian
  const speakIndonesian = (text: string) => {
    if ("speechSynthesis" in window) {
      // cancel previous audios
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "id-ID";
      utterance.rate = 1.15;
      window.speechSynthesis.speak(utterance);
    }
  };

  // Control Specific Relay
  const triggerRelayChange = (key: keyof RelayState, value: number) => {
    const names: Record<keyof RelayState, string> = {
      relay1: "Lampu 1 (Teras Depan)",
      relay2: "Lampu 2 (Ruang Tamu)",
      relay3: "Lampu 3 (Kamar Tidur)",
      relay4: "Relay 4 (Stop Kontak Dapur)",
      lampCFL: "Lampu CFL (Warm White)",
      lampLED: "Lampu LED (Electric Blue)",
    };

    setRelays(prev => {
      if (prev[key] === value) return prev;
      pushLog(`${names[key]} diubah menjadi ${value === 1 ? "AKTIF" : "NONAKTIF"}`, value === 1 ? "success" : "warn");
      return { ...prev, [key]: value };
    });
  };

  // Master switches
  const triggerAllRelays = (actionOn: boolean) => {
    const value = actionOn ? 1 : 0;
    pushLog(actionOn ? "Menyalakan seluruh kelistrikan..." : "Mematikan seluruh kelistrikan...", actionOn ? "success" : "error");
    setRelays({
      relay1: value,
      relay2: value,
      relay3: value,
      relay4: value,
      lampCFL: value,
      lampLED: value,
    });
  };

  // Voice Speech Command Parsing (Fully reactive Web Speech API)
  const runVoiceRecognition = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      pushLog("Web Speech Recognition tidak didukung browser ini. Coba gunakan Google Chrome.", "error");
      speakIndonesian("Maaf, pencarian suara tidak didukung browser Anda.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "id-ID";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setMicActive(true);
      setVoiceText("Silakan berbicara sekarang...");
    };

    recognition.onerror = (e: any) => {
      console.error(e);
      pushLog("Gagal menangkap gelombang suara: " + e.error, "error");
      setMicActive(false);
    };

    recognition.onend = () => {
      setMicActive(false);
    };

    recognition.onresult = (event: any) => {
      const command = event.results[0][0].transcript.toLowerCase().trim();
      setVoiceText(`"${command}"`);
      pushLog(`Perintah suara dikenali: "${command}"`, "info");
      parseAndExecuteVoice(command);
    };

    recognition.start();
  };

  // Voice Simulated triggers (for presentation comfort)
  const simulateVoiceTextTrigger = (command: string) => {
    setVoiceText(`"${command}" (Simulasi Klik)`);
    pushLog(`Memicu teks perintah suara: "${command}"`, "info");
    parseAndExecuteVoice(command.toLowerCase());
  };

  const parseAndExecuteVoice = (cmd: string) => {
    let matched = false;

    // Master command parsing
    if (cmd.includes("nyalakan semua") || cmd.includes("hidupkan semua") || cmd.includes("hidupkan seluruh") || cmd.includes("nyalakan seluruh")) {
      triggerAllRelays(true);
      speakIndonesian("Baik, semua lampu berhasil dinyalakan.");
      matched = true;
    } else if (cmd.includes("matikan semua") || cmd.includes("matikan seluruh")) {
      triggerAllRelays(false);
      speakIndonesian("Baik, semua lampu berhasil dimatikan.");
      matched = true;
    }

    // Parse physical variations (CFL and LED)
    if (!matched) {
      if (cmd.includes("cfl") || cmd.includes("gfl")) {
        const turnOn = cmd.includes("nyalakan") || cmd.includes("hidupkan") || cmd.includes("on");
        const turnOff = cmd.includes("matikan") || cmd.includes("padamkan") || cmd.includes("off");
        if (turnOn) {
          triggerRelayChange("lampCFL", 1);
          speakIndonesian("Baik, lampu C F L dinyalakan.");
          matched = true;
        } else if (turnOff) {
          triggerRelayChange("lampCFL", 0);
          speakIndonesian("Baik, lampu C F L dimatikan.");
          matched = true;
        }
      } else if (cmd.includes("led") || cmd.includes("l.e.d")) {
        const turnOn = cmd.includes("nyalakan") || cmd.includes("hidupkan") || cmd.includes("on");
        const turnOff = cmd.includes("matikan") || cmd.includes("padamkan") || cmd.includes("off");
        if (turnOn) {
          triggerRelayChange("lampLED", 1);
          speakIndonesian("Baik, lampu L E D dinyalakan.");
          matched = true;
        } else if (turnOff) {
          triggerRelayChange("lampLED", 0);
          speakIndonesian("Baik, lampu L E D dimatikan.");
          matched = true;
        }
      }
    }

    if (!matched) {
      // Individual relay parsing
      const targets = [
        { id: 1, key: "relay1" as keyof RelayState, name: "Lampu 1 teras depan" },
        { id: 2, key: "relay2" as keyof RelayState, name: "Lampu 2 ruang tamu" },
        { id: 3, key: "relay3" as keyof RelayState, name: "Lampu 3 kamar tidur" },
        { id: 4, key: "relay4" as keyof RelayState, name: "Alat 4 stop kontak dapur" },
      ];

      for (const t of targets) {
        const matchesOn = (cmd.includes("nyalakan") || cmd.includes("hidupkan")) && 
                          (cmd.includes(`lampu ${t.id}`) || cmd.includes(`nomor ${t.id}`) || cmd.includes(`alat ${t.id}`) || cmd.includes(`relay ${t.id}`));
        const matchesOff = cmd.includes("matikan") && 
                           (cmd.includes(`lampu ${t.id}`) || cmd.includes(`nomor ${t.id}`) || cmd.includes(`alat ${t.id}`) || cmd.includes(`relay ${t.id}`));

        if (matchesOn) {
          triggerRelayChange(t.key, 1);
          speakIndonesian(`Baik, ${t.name} dinyalakan.`);
          matched = true;
          break;
        } else if (matchesOff) {
          triggerRelayChange(t.key, 0);
          speakIndonesian(`Baik, ${t.name} dimatikan.`);
          matched = true;
          break;
        }
      }
    }

    if (!matched) {
      pushLog("Perintah '" + cmd + "' tidak cocok dengan format smart home.", "warn");
      speakIndonesian("Maaf, perintah suara tidak dikenali. Silakan coba lagi.");
    }
  };

  // Clipboard copy utility
  const copyTextToClipboard = (text: string, tabIndex: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(tabIndex);
    setTimeout(() => setCopiedIndex(null), 2500);
  };

  // Submit DB setup details
  const saveFirebaseConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseKeys.databaseURL) {
      pushLog("Database URL tidak boleh kosong untuk sinkronisasi!", "error");
      return;
    }
    localStorage.setItem("NEXUS_FB_DB_URL", firebaseKeys.databaseURL);
    localStorage.setItem("NEXUS_FB_API_KEY", firebaseKeys.apiKey);
    localStorage.setItem("NEXUS_FB_PROJ_ID", firebaseKeys.projectId);
    setIsFirebaseConfigured(true);
    pushLog("Berhasil menyimpan config lokal. Gateway tersambung!", "success");
  };

  const removeFirebaseConfig = () => {
    localStorage.removeItem("NEXUS_FB_DB_URL");
    localStorage.removeItem("NEXUS_FB_API_KEY");
    localStorage.removeItem("NEXUS_FB_PROJ_ID");
    setFirebaseKeys({ databaseURL: "", apiKey: "", projectId: "nexus-smart-iot" });
    setIsFirebaseConfigured(false);
    pushLog("Config dihapus. Kembali ke simulasi offline penuh.", "warn");
  };

  const clearLogsScreen = () => {
    setLogs([{
      id: "clear",
      time: new Date().toLocaleTimeString(),
      message: "Log sistem dibersihkan.",
      type: "info",
    }]);
  };

  return (
    <div className="min-h-screen bg-[#050608] text-[#e2e8f0] font-sans flex flex-col justify-between overflow-x-hidden select-none">
      
      {/* Header Panel */}
      <header className="border-b border-white/5 bg-gradient-to-r from-[#050608] to-[#0f111a] backdrop-blur-md px-4 py-3 sm:px-8 relative sticky top-0 z-30 shadow-[0_4px_30px_rgba(0,0,0,0.4)]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          
          {/* Logo & Subtitle */}
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-[#00f3ff] via-teal-400 to-emerald-500 rounded-xl shadow-[0_0_20px_rgba(0,243,255,0.3)]">
              <Zap className="w-5 h-5 text-slate-950 font-black animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold tracking-widest text-[#00f3ff] font-mono">NEXUS</span>
                <span className="text-xs bg-[#00f3ff]/10 text-[#00f3ff] font-mono px-1.5 py-0.5 rounded border border-[#00f3ff]/20">LIVE PREVIEW</span>
              </div>
              <h1 className="text-lg font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-[#00f3ff] via-white to-[#00f3ff] font-sans">
                IoT SMART HOME SYSTEM
              </h1>
            </div>
          </div>

          {/* Clock & Status */}
          <div className="flex items-center gap-3 sm:gap-4 flex-wrap justify-center">
            {/* Clock Widget */}
            <div className="flex items-center gap-2 bg-[#11141b] px-3.5 py-1.5 rounded-xl border border-white/5 shadow-[0_0_15px_rgba(0,243,255,0.15)]">
              <Clock className="w-4 h-4 text-[#00f3ff]" />
              <span className="font-mono text-sm font-semibold text-[#00f3ff] tracking-widest">{currentTime || "00:00:00"}</span>
            </div>

            {/* Connection badge */}
            <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-bold font-mono transition-all duration-300 text-[#00f3ff] bg-[#00f3ff]/10 border-[#00f3ff] shadow-[0_0_15px_rgba(0,243,255,0.4)] ${
              isFirebaseConfigured ? "" : "animate-pulse"
            }`}>
              <span className="w-2 h-2 rounded-full inline-block bg-[#00f3ff] shadow-[0_0_8px_#00f3ff]" />
              <span>{isFirebaseConfigured ? "FIREBASE CONNECTED" : "DEMO SIMULATOR"}</span>
            </div>
          </div>

        </div>
      </header>

      {/* Main Body */}
      <main className="max-w-7xl w-full mx-auto px-4 py-8 sm:px-8 space-y-8 flex-grow">
        
        {/* Offline Simulator Warning Banner */}
        {!isFirebaseConfigured && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }} 
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-[#11141b] border border-[#00f3ff]/20 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 backdrop-blur-sm shadow-[0_0_15px_rgba(0,243,255,0.05)]"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-[#00f3ff] mt-0.5 shrink-0" />
              <div>
                <h4 className="font-bold text-sm text-[#00f3ff]">Modus Simulasi Interaktif Aktif</h4>
                <p className="text-xs text-[#94a3b8] leading-relaxed mt-1">
                  Halaman web ini menyediakan simulasi luring penuh agar Anda dapat mendemokan fungsi sensor DHT, saklar relay, dan asisten suara tanpa setup apa pun! Untuk menyambungkan ke mikrokontroler ESP32 fisik secara nyata, isi formulir konfigurasi Firebase di panel kanan.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* 3 Grid Dashboard System */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* SECTION A: REALTIME MONITORING (DHT Sensors) */}
          <section className="lg:col-span-4 space-y-6">
            <h3 className="elegant-section-title-custom font-semibold">
              <Layers className="w-4 h-4 text-[#00f3ff]" /> Environment Sensors
            </h3>

            {/* Suhu (Temperature) Card */}
            <motion.div 
              whileHover={{ borderColor: "rgba(0, 243, 255, 0.3)" }}
              className="relative overflow-hidden bg-[#11141b] border border-white/5 rounded-[20px] p-6 shadow-2xl transition-all duration-300"
            >
              <div className="absolute right-0 bottom-0 p-5 opacity-[0.03] text-rose-500 pointer-events-none">
                <Thermometer className="w-24 h-24" />
              </div>

              <div className="flex justify-between items-start mb-4">
                <div className="space-y-1">
                  <span className="elegant-tag">LIVING ROOM</span>
                  <span className="text-xs text-[#94a3b8] font-bold uppercase tracking-widest block mt-1">Temperature</span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 shadow-[0_0_10px_rgba(255,62,62,0.1)]">
                  <Thermometer className="w-5 h-5" />
                </div>
              </div>

              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-5xl font-sans font-light text-white">
                  {sensors.temperature.toFixed(1)}
                </span>
                <span className="text-xl font-bold text-[#94a3b8]">°C</span>
              </div>

              {/* Progress Slider mimic */}
              <div className="w-full bg-[#050608] h-2 rounded-full overflow-hidden border border-white/5">
                <div 
                  className="bg-[#00f3ff] h-full rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(0,243,255,0.4)]" 
                  style={{ width: `${Math.min(Math.max((sensors.temperature / 50) * 100, 0), 100)}%` }}
                />
              </div>

              <div className="flex justify-between items-center mt-2.5 text-[10px] text-[#94a3b8] font-semibold font-mono">
                <span>MIN 0°C</span>
                <span className={sensors.temperature > 29 ? "text-[#ff3e3e] font-black animate-pulse" : "text-[#00f3ff]"}>
                  {sensors.temperature < 20 ? "DINGIN" : sensors.temperature <= 29 ? "NORMAL" : "WARNING: HOTo"}
                </span>
                <span>MAX 50°C</span>
              </div>
            </motion.div>

            {/* Kelembaban (Humidity) Card */}
            <motion.div 
              whileHover={{ borderColor: "rgba(0, 243, 255, 0.3)" }}
              className="relative overflow-hidden bg-[#11141b] border border-white/5 rounded-[20px] p-6 shadow-2xl transition-all duration-300"
            >
              <div className="absolute right-0 bottom-0 p-5 opacity-[0.03] text-emerald-500 pointer-events-none">
                <Droplet className="w-24 h-24" />
              </div>

              <div className="flex justify-between items-start mb-4">
                <div className="space-y-1">
                  <span className="elegant-tag">LIVING ROOM</span>
                  <span className="text-xs text-[#94a3b8] font-bold uppercase tracking-widest block mt-1">Humidity</span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shadow-[0_0_10px_rgba(0,243,255,0.1)]">
                  <Droplet className="w-5 h-5" />
                </div>
              </div>

              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-5xl font-sans font-light text-white">
                  {Math.round(sensors.humidity)}
                </span>
                <span className="text-xl font-bold text-[#94a3b8]">% RH</span>
              </div>

              {/* Progress dynamic mimic */}
              <div className="w-full bg-[#050608] h-2 rounded-full overflow-hidden border border-white/5">
                <div 
                  className="bg-[#00f3ff] h-full rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(0,243,255,0.4)]" 
                  style={{ width: `${sensors.humidity}%` }}
                />
              </div>

              <div className="flex justify-between items-center mt-2.5 text-[10px] text-[#94a3b8] font-semibold font-mono">
                <span>MIN 0%</span>
                <span className="text-[#00f3ff]">
                  {sensors.humidity < 40 ? "KERING" : sensors.humidity <= 75 ? "NYAMAN" : "SANGAT BASAH"}
                </span>
                <span>MAX 100%</span>
              </div>
            </motion.div>

            {/* Simulated hardware dials */}
            <div className="bg-[#11141b] border border-white/5 p-5 rounded-[20px] relative overflow-hidden shadow-2xl">
              <div className="flex justify-between items-center mb-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#00f3ff]">ESP32 DEVICE STATUS</span>
                <span className="text-[8px] bg-[#00f3ff]/10 text-[#00f3ff] px-1.5 py-0.5 rounded font-mono border border-[#00f3ff]/20">Online</span>
              </div>
              <p className="text-[10px] text-[#94a3b8] leading-relaxed mb-4">
                Gunakan slider di bawah ini untuk mensimulasikan pembacaan sensor DHT fisik secara luring dan lihat dashboard merespon secara seketika!
              </p>
              
              <div className="space-y-3.5">
                <div>
                  <div className="flex justify-between text-xs text-[#94a3b8] mb-1">
                    <span>Atur Suhu Lokal:</span>
                    <span className="font-mono text-rose-400 font-bold">{sensors.temperature.toFixed(1)}°C</span>
                  </div>
                  <input 
                    type="range" 
                    min="10" 
                    max="45" 
                    step="0.5" 
                    value={sensors.temperature}
                    onChange={(e) => setSensors(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
                    className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-[#00f3ff]"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-xs text-[#94a3b8] mb-1">
                    <span>Atur Kelembaban Lokal:</span>
                    <span className="font-mono text-emerald-400 font-bold">{Math.round(sensors.humidity)}% RH</span>
                  </div>
                  <input 
                    type="range" 
                    min="20" 
                    max="95" 
                    step="1" 
                    value={sensors.humidity}
                    onChange={(e) => setSensors(prev => ({ ...prev, humidity: parseInt(e.target.value) }))}
                    className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-[#00f3ff]"
                  />
                </div>
              </div>
            </div>

          </section>

          {/* SECTION B: CORE INTERACTION CENTER (Relays, Master Switches, Voice Controller) */}
          <section className="lg:col-span-5 space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <h3 className="elegant-section-title-custom font-semibold">
                <Cpu className="w-4 h-4 text-[#00f3ff]" /> Smart Relay Control
              </h3>
              
              {/* Master controls triggers */}
              <div className="flex gap-2">
                <button 
                  onClick={() => triggerAllRelays(true)}
                  className="px-3 py-1.5 bg-[#00f3ff]/10 hover:bg-[#00f3ff]/20 text-[#00f3ff] border border-[#00f3ff]/30 text-[10px] font-bold rounded-lg shadow-[0_0_10px_rgba(0,243,255,0.15)] transition-all"
                >
                  ALL ON <Power className="w-3 h-3 ml-1 inline" />
                </button>
                <button 
                  onClick={() => triggerAllRelays(false)}
                  className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-[#ff3e3e] border border-rose-500/30 text-[10px] font-bold rounded-lg transition-all"
                >
                  ALL OFF <Power className="w-3 h-3 ml-1 inline" />
                </button>
              </div>
            </div>

            {/* Relay Switches Grid-2x2 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* RELAY 1 */}
              <motion.div 
                className={`relative overflow-hidden p-5 rounded-2xl border transition-all duration-500 flex flex-col justify-between h-[170px] ${
                  relays.relay1 === 1 
                    ? "elegant-relay-item-active" 
                    : "elegant-relay-item"
                }`}
              >
                {/* Visual Ambient Light Effect */}
                <div className={`absolute top-0 right-0 w-32 h-32 rounded-full filter blur-2xl pointer-events-none transition-opacity duration-1000 bg-gradient-to-tr from-[#00f3ff]/10 to-teal-400/5 ${
                  relays.relay1 === 1 ? "opacity-100" : "opacity-0"
                }`} />

                <div className="flex justify-between items-start z-10">
                  <div className="flex items-center gap-3">
                    <span className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                      relays.relay1 === 1 
                        ? "elegant-relay-icon-active" 
                        : "elegant-relay-icon text-[#94a3b8]"
                    }`}>
                      <Lightbulb className="w-4 h-4" />
                    </span>
                    <div>
                      <h4 className="font-bold text-xs text-gray-200">Relay 01</h4>
                      <p className="text-[11px] text-[#00f3ff] font-mono">Lampu Teras</p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md font-extrabold border tracking-wider transition-all ${
                    relays.relay1 === 1 
                      ? "bg-[#00f3ff]/15 text-[#00f3ff] border-[#00f3ff]/30 shadow-[0_0_10px_rgba(0,243,255,0.2)]" 
                      : "bg-[#050608] text-[#94a3b8]/60 border-white/5"
                  }`}>
                    {relays.relay1 === 1 ? "ON" : "OFF"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-4 z-10">
                  <button 
                    onClick={() => triggerRelayChange("relay1", 1)}
                    className={`py-2 text-[11px] font-bold rounded-lg transition-all ${
                      relays.relay1 === 1 
                        ? "elegant-btn-on-active" 
                        : "elegant-btn"
                    }`}
                  >
                    ON
                  </button>
                  <button 
                    onClick={() => triggerRelayChange("relay1", 0)}
                    className={`py-2 text-[11px] font-bold rounded-lg transition-all ${
                      relays.relay1 === 0 
                        ? "elegant-btn-off-active" 
                        : "elegant-btn"
                    }`}
                  >
                    OFF
                  </button>
                </div>
              </motion.div>

              {/* RELAY 2 */}
              <motion.div 
                className={`relative overflow-hidden p-5 rounded-2xl border transition-all duration-500 flex flex-col justify-between h-[170px] ${
                  relays.relay2 === 1 
                    ? "elegant-relay-item-active" 
                    : "elegant-relay-item"
                }`}
              >
                <div className={`absolute top-0 right-0 w-32 h-32 rounded-full filter blur-2xl pointer-events-none transition-opacity duration-1000 bg-gradient-to-tr from-[#00f3ff]/10 to-teal-400/5 ${
                  relays.relay2 === 1 ? "opacity-100" : "opacity-0"
                }`} />

                <div className="flex justify-between items-start z-10">
                  <div className="flex items-center gap-3">
                    <span className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                      relays.relay2 === 1 
                        ? "elegant-relay-icon-active" 
                        : "elegant-relay-icon text-[#94a3b8]"
                    }`}>
                      <Lightbulb className="w-4 h-4" />
                    </span>
                    <div>
                      <h4 className="font-bold text-xs text-gray-200">Relay 02</h4>
                      <p className="text-[11px] text-[#00f3ff] font-mono">Lampu Tamu</p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md font-extrabold border tracking-wider transition-all ${
                    relays.relay2 === 1 
                      ? "bg-[#00f3ff]/15 text-[#00f3ff] border-[#00f3ff]/30 shadow-[0_0_10px_rgba(0,243,255,0.2)]" 
                      : "bg-[#050608] text-[#94a3b8]/60 border-white/5"
                  }`}>
                    {relays.relay2 === 1 ? "ON" : "OFF"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-4 z-10">
                  <button 
                    onClick={() => triggerRelayChange("relay2", 1)}
                    className={`py-2 text-[11px] font-bold rounded-lg transition-all ${
                      relays.relay2 === 1 
                        ? "elegant-btn-on-active" 
                        : "elegant-btn"
                    }`}
                  >
                    ON
                  </button>
                  <button 
                    onClick={() => triggerRelayChange("relay2", 0)}
                    className={`py-2 text-[11px] font-bold rounded-lg transition-all ${
                      relays.relay2 === 0 
                        ? "elegant-btn-off-active" 
                        : "elegant-btn"
                    }`}
                  >
                    OFF
                  </button>
                </div>
              </motion.div>

              {/* RELAY 3 */}
              <motion.div 
                className={`relative overflow-hidden p-5 rounded-2xl border transition-all duration-500 flex flex-col justify-between h-[170px] ${
                  relays.relay3 === 1 
                    ? "elegant-relay-item-active" 
                    : "elegant-relay-item"
                }`}
              >
                <div className={`absolute top-0 right-0 w-32 h-32 rounded-full filter blur-2xl pointer-events-none transition-opacity duration-1000 bg-gradient-to-tr from-[#00f3ff]/10 to-teal-400/5 ${
                  relays.relay3 === 1 ? "opacity-100" : "opacity-0"
                }`} />

                <div className="flex justify-between items-start z-10">
                  <div className="flex items-center gap-3">
                    <span className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                      relays.relay3 === 1 
                        ? "elegant-relay-icon-active" 
                        : "elegant-relay-icon text-[#94a3b8]"
                    }`}>
                      <Lightbulb className="w-4 h-4" />
                    </span>
                    <div>
                      <h4 className="font-bold text-xs text-gray-200">Relay 03</h4>
                      <p className="text-[11px] text-[#00f3ff] font-mono">Smart AC</p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md font-extrabold border tracking-wider transition-all ${
                    relays.relay3 === 1 
                      ? "bg-[#00f3ff]/15 text-[#00f3ff] border-[#00f3ff]/30 shadow-[0_0_10px_rgba(0,243,255,0.2)]" 
                      : "bg-[#050608] text-[#94a3b8]/60 border-white/5"
                  }`}>
                    {relays.relay3 === 1 ? "ON" : "OFF"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-4 z-10">
                  <button 
                    onClick={() => triggerRelayChange("relay3", 1)}
                    className={`py-2 text-[11px] font-bold rounded-lg transition-all ${
                      relays.relay3 === 1 
                        ? "elegant-btn-on-active" 
                        : "elegant-btn"
                    }`}
                  >
                    ON
                  </button>
                  <button 
                    onClick={() => triggerRelayChange("relay3", 0)}
                    className={`py-2 text-[11px] font-bold rounded-lg transition-all ${
                      relays.relay3 === 0 
                        ? "elegant-btn-off-active" 
                        : "elegant-btn"
                    }`}
                  >
                    OFF
                  </button>
                </div>
              </motion.div>

              {/* RELAY 4 */}
              <motion.div 
                className={`relative overflow-hidden p-5 rounded-2xl border transition-all duration-500 flex flex-col justify-between h-[170px] ${
                  relays.relay4 === 1 
                    ? "elegant-relay-item-active" 
                    : "elegant-relay-item"
                }`}
              >
                <div className={`absolute top-0 right-0 w-32 h-32 rounded-full filter blur-2xl pointer-events-none transition-opacity duration-1000 bg-gradient-to-tr from-[#00f3ff]/10 to-teal-400/5 ${
                  relays.relay4 === 1 ? "opacity-100" : "opacity-0"
                }`} />

                <div className="flex justify-between items-start z-10">
                  <div className="flex items-center gap-3">
                    <span className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                      relays.relay4 === 1 
                        ? "elegant-relay-icon-active" 
                        : "elegant-relay-icon text-[#94a3b8]"
                    }`}>
                      <Zap className="w-4 h-4" />
                    </span>
                    <div>
                      <h4 className="font-bold text-xs text-gray-200">Relay 04</h4>
                      <p className="text-[11px] text-[#00f3ff] font-mono">Kitchen</p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md font-extrabold border tracking-wider transition-all ${
                    relays.relay4 === 1 
                      ? "bg-[#00f3ff]/15 text-[#00f3ff] border-[#00f3ff]/30 shadow-[0_0_10px_rgba(0,243,255,0.2)]" 
                      : "bg-[#050608] text-[#94a3b8]/60 border-white/5"
                  }`}>
                    {relays.relay4 === 1 ? "ON" : "OFF"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-4 z-10">
                  <button 
                    onClick={() => triggerRelayChange("relay4", 1)}
                    className={`py-2 text-[11px] font-bold rounded-lg transition-all ${
                      relays.relay4 === 1 
                        ? "elegant-btn-on-active" 
                        : "elegant-btn"
                    }`}
                  >
                    ON
                  </button>
                  <button 
                    onClick={() => triggerRelayChange("relay4", 0)}
                    className={`py-2 text-[11px] font-bold rounded-lg transition-all ${
                      relays.relay4 === 0 
                        ? "elegant-btn-off-active" 
                        : "elegant-btn"
                    }`}
                  >
                    OFF
                  </button>
                </div>
              </motion.div>

              {/* LED VARIATION: LAMP CFL */}
              <motion.div 
                className={`relative overflow-hidden p-5 rounded-2xl border transition-all duration-500 flex flex-col justify-between h-[170px] ${
                  relays.lampCFL === 1 
                    ? "elegant-relay-item-active" 
                    : "elegant-relay-item"
                }`}
              >
                <div className={`absolute top-0 right-0 w-32 h-32 rounded-full filter blur-2xl pointer-events-none transition-opacity duration-1000 bg-gradient-to-tr from-amber-500/15 to-yellow-400/5 ${
                  relays.lampCFL === 1 ? "opacity-100" : "opacity-0"
                }`} />

                <div className="flex justify-between items-start z-10">
                  <div className="flex items-center gap-3">
                    <span className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                      relays.lampCFL === 1 
                        ? "bg-amber-500/20 text-amber-400 border border-amber-500/35 shadow-[0_0_10px_rgba(245,158,11,0.2)]" 
                        : "elegant-relay-icon text-[#94a3b8]"
                    }`}>
                      <Lightbulb className="w-4 h-4" />
                    </span>
                    <div>
                      <h4 className="font-bold text-xs text-gray-200">Relay 05 (Variasi)</h4>
                      <p className="text-[11px] text-amber-400 font-mono">Lampu CFL</p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md font-extrabold border tracking-wider transition-all ${
                    relays.lampCFL === 1 
                      ? "bg-amber-500/15 text-amber-400 border-amber-400/30 shadow-[0_0_10px_rgba(245,158,11,0.2)]" 
                      : "bg-[#050608] text-[#94a3b8]/60 border-white/5"
                  }`}>
                    {relays.lampCFL === 1 ? "ON" : "OFF"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-4 z-10">
                  <button 
                    onClick={() => triggerRelayChange("lampCFL", 1)}
                    className={`py-2 text-[11px] font-bold rounded-lg transition-all ${
                      relays.lampCFL === 1 
                        ? "bg-amber-450 hover:bg-amber-500 text-slate-950 font-black shadow-[0_0_12px_rgba(245,158,11,0.35)] border-transparent" 
                        : "elegant-btn"
                    }`}
                  >
                    ON
                  </button>
                  <button 
                    onClick={() => triggerRelayChange("lampCFL", 0)}
                    className={`py-2 text-[11px] font-bold rounded-lg transition-all ${
                      relays.lampCFL === 0 
                        ? "bg-rose-500/10 text-rose-400 border border-rose-500/30" 
                        : "elegant-btn"
                    }`}
                  >
                    OFF
                  </button>
                </div>
              </motion.div>

              {/* LED VARIATION: LAMP LED */}
              <motion.div 
                className={`relative overflow-hidden p-5 rounded-2xl border transition-all duration-500 flex flex-col justify-between h-[170px] ${
                  relays.lampLED === 1 
                    ? "elegant-relay-item-active" 
                    : "elegant-relay-item"
                }`}
              >
                <div className={`absolute top-0 right-0 w-32 h-32 rounded-full filter blur-2xl pointer-events-none transition-opacity duration-1000 bg-gradient-to-tr from-[#00f3ff]/15 to-cyan-400/5 ${
                  relays.lampLED === 1 ? "opacity-100" : "opacity-0"
                }`} />

                <div className="flex justify-between items-start z-10">
                  <div className="flex items-center gap-3">
                    <span className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                      relays.lampLED === 1 
                        ? "elegant-relay-icon-active" 
                        : "elegant-relay-icon text-[#94a3b8]"
                    }`}>
                      <Lightbulb className="w-4 h-4" />
                    </span>
                    <div>
                      <h4 className="font-bold text-xs text-gray-200">Relay 06 (Variasi)</h4>
                      <p className="text-[11px] text-[#00f3ff] font-mono">Lampu LED</p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md font-extrabold border tracking-wider transition-all ${
                    relays.lampLED === 1 
                      ? "bg-[#00f3ff]/15 text-[#00f3ff] border-[#00f3ff]/30 shadow-[0_0_10px_rgba(0,243,255,0.2)]" 
                      : "bg-[#050608] text-[#94a3b8]/60 border-white/5"
                  }`}>
                    {relays.lampLED === 1 ? "ON" : "OFF"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-4 z-10">
                  <button 
                    onClick={() => triggerRelayChange("lampLED", 1)}
                    className={`py-2 text-[11px] font-bold rounded-lg transition-all ${
                      relays.lampLED === 1 
                        ? "elegant-btn-on-active" 
                        : "elegant-btn"
                    }`}
                  >
                    ON
                  </button>
                  <button 
                    onClick={() => triggerRelayChange("lampLED", 0)}
                    className={`py-2 text-[11px] font-bold rounded-lg transition-all ${
                      relays.lampLED === 0 
                        ? "elegant-btn-off-active" 
                        : "elegant-btn"
                    }`}
                  >
                    OFF
                  </button>
                </div>
              </motion.div>

            </div>

            {/* Voice Command Card Section */}
            <div className="relative overflow-hidden bg-[#11141b] border border-white/5 rounded-[20px] p-5 shadow-2xl">
              <div className="flex justify-between items-center mb-3">
                <span className="text-[10px] uppercase font-bold tracking-widest text-[#00f3ff] flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#00f3ff] inline-block animate-ping shadow-[0_0_8px_#00f3ff]" />
                  Voice Control Console (ID/EN)
                </span>
                <Volume2 className="w-4 h-4 text-[#00f3ff]" />
              </div>

              <div className="flex flex-col md:flex-row gap-4 items-center mt-2.5">
                <motion.button 
                  whileTap={{ scale: 0.95 }}
                  onClick={runVoiceRecognition}
                  className={`w-full md:w-auto px-5 py-4 font-black tracking-wider text-xs uppercase rounded-xl flex items-center justify-center gap-3 shadow-lg select-none transition-colors border ${
                    micActive 
                      ? "bg-rose-500/20 text-rose-400 border-rose-500/40 animate-pulse" 
                      : "bg-gradient-to-tr from-[#00f3ff] to-emerald-400 text-slate-950 border-white/5 hover:scale-105"
                  }`}
                >
                  {micActive ? <MicOff className="w-4 h-4 text-rose-400 shrink-0" /> : <Mic className="w-4 h-4 text-slate-950 shrink-0" />}
                  <span>{micActive ? "DENGARKAN..." : "AKTIFKAN VOICE COMMAND"}</span>
                </motion.button>

                <div className="flex-grow w-full">
                  <div className="elegant-voice-console p-3 min-h-[58px] flex flex-col justify-center relative">
                    {micActive && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-1 items-center">
                        <span className="w-1 h-3 bg-[#00f3ff] rounded-full animate-bounce" />
                        <span className="w-1 h-4 bg-[#00f3ff] rounded-full animate-bounce" style={{ animationDelay: "0.15s" }} />
                        <span className="w-1 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: "0.3s" }} />
                      </div>
                    )}
                    <span className="text-[9px] uppercase font-mono font-bold text-[#94a3b8]/50 block mb-1">TRANSKRIP SUARA ANDA</span>
                    <span className={`text-xs font-mono tracking-wide leading-relaxed ${voiceText ? "text-[#00ff00]" : "text-[#00ff00]/60 italic"}`}>
                      {voiceText || "Ketuk tombol mikrofon dan katakan -> 'Nyalakan lampu 1'"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick Preset Speech Mimics for Presentation Comfort */}
              <div className="mt-4 pt-3 border-t border-white/5">
                <label className="text-[10px] text-[#94a3b8]/50 uppercase font-mono font-bold block mb-2">Simulasikan Perintah Suara (Klik Cepat):</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-[10px] font-mono">
                  <button 
                    onClick={() => simulateVoiceTextTrigger("Nyalakan Lampu 1")}
                    className="p-1.5 bg-[#050608] border border-white/5 hover:border-[#00f3ff]/30 text-gray-400 rounded transition-colors"
                  >
                    "Nyalakan Lampu 1"
                  </button>
                  <button 
                    onClick={() => simulateVoiceTextTrigger("Matikan Lampu 1")}
                    className="p-1.5 bg-[#050608] border border-white/5 hover:border-[#00f3ff]/30 text-gray-400 rounded transition-colors"
                  >
                    "Matikan Lampu 1"
                  </button>
                  <button 
                    onClick={() => simulateVoiceTextTrigger("Nyalakan semua")}
                    className="p-1.5 bg-[#050608] border border-white/5 hover:border-[#00f3ff]/30 text-gray-400 rounded transition-colors"
                  >
                    "Nyalakan Semua"
                  </button>
                  <button 
                    onClick={() => simulateVoiceTextTrigger("Matikan semua")}
                    className="p-1.5 bg-[#050608] border border-white/5 hover:border-[#00f3ff]/30 text-gray-400 rounded transition-colors"
                  >
                    "Matikan Semua"
                  </button>
                  <button 
                    onClick={() => simulateVoiceTextTrigger("Nyalakan CFL")}
                    className="p-1.5 bg-[#050608] border border-white/5 hover:border-[#00f3ff]/30 text-gray-400 rounded transition-colors"
                  >
                    "Nyalakan CFL"
                  </button>
                  <button 
                    onClick={() => simulateVoiceTextTrigger("Matikan CFL")}
                    className="p-1.5 bg-[#050608] border border-white/5 hover:border-[#00f3ff]/30 text-gray-400 rounded transition-colors"
                  >
                    "Matikan CFL"
                  </button>
                  <button 
                    onClick={() => simulateVoiceTextTrigger("Nyalakan LED")}
                    className="p-1.5 bg-[#050608] border border-white/5 hover:border-[#00f3ff]/30 text-gray-400 rounded transition-colors"
                  >
                    "Nyalakan LED"
                  </button>
                  <button 
                    onClick={() => simulateVoiceTextTrigger("Matikan LED")}
                    className="p-1.5 bg-[#050608] border border-white/5 hover:border-[#00f3ff]/30 text-gray-400 rounded transition-colors"
                  >
                    "Matikan LED"
                  </button>
                </div>
              </div>

            </div>
          </section>

          {/* SECTION C: CONFIGURATION & LOGS (Firebase & Activity Console) */}
          <section className="lg:col-span-3 space-y-6">
            <h3 className="elegant-section-title-custom font-semibold">
              <Database className="w-4 h-4 text-[#00f3ff]" /> Gateway & Konsol Log
            </h3>

            {/* Firebase Config card inside Dashboard */}
            <div className="bg-[#11141b] border border-white/5 rounded-[20px] p-5 shadow-2xl relative overflow-hidden">
              <div className="flex justify-between items-center mb-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#00f3ff] flex items-center gap-1.5">
                  <Settings className="w-3.5 h-3.5" /> GATEWAY CONFIGURATION
                </span>
              </div>

              {isFirebaseConfigured ? (
                <div className="space-y-3.5">
                  <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl space-y-2 text-xs">
                    <p className="font-bold text-emerald-400 flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-400" /> Firebase Tersambung
                    </p>
                    <div className="text-[10px] text-gray-400 font-mono space-y-1 block mt-1 overflow-x-auto select-all">
                      <p className="truncate"><strong>DB:</strong> {firebaseKeys.databaseURL}</p>
                      <p><strong>Project:</strong> {firebaseKeys.projectId}</p>
                    </div>
                  </div>
                  <button 
                    onClick={removeFirebaseConfig}
                    className="w-full py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 text-xs font-bold rounded-xl active:scale-95 transition-all"
                  >
                    Putuskan Gateway
                  </button>
                </div>
              ) : (
                <form onSubmit={saveFirebaseConfig} className="space-y-3">
                  <p className="text-[10px] text-gray-400 leading-relaxed mb-1">
                    Hubungkan langsung gateway ini ke proyek IoT Firebase Realtime Database Anda secara luring. Kunci diamankan dalam penyimpanan lokal.
                  </p>
                  <div>
                    <label className="text-[9px] uppercase font-mono font-bold text-[#00f3ff] block mb-1">URL Realtime DB (rtdb): *</label>
                    <input 
                      type="text" 
                      required
                      placeholder="https://test-rtdb.firebaseio.com"
                      value={firebaseKeys.databaseURL}
                      onChange={(e) => setFirebaseKeys(prev => ({ ...prev, databaseURL: e.target.value }))}
                      className="w-full bg-[#050608] border border-white/5 focus:border-[#00f3ff] rounded-lg px-3 py-1.5 text-xs font-mono text-[#e2e8f0] outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] uppercase font-mono font-bold text-[#00f3ff] block mb-1">API Key Firebase: (Opsional)</label>
                    <input 
                      type="password" 
                      placeholder="AIzaSyA..."
                      value={firebaseKeys.apiKey}
                      onChange={(e) => setFirebaseKeys(prev => ({ ...prev, apiKey: e.target.value }))}
                      className="w-full bg-[#050608] border border-white/5 focus:border-[#00f3ff] rounded-lg px-3 py-1.5 text-xs font-mono text-[#e2e8f0] outline-none transition-colors"
                    />
                  </div>
                  <button 
                    type="submit"
                    className="w-full py-2 px-3 bg-gradient-to-r from-[#00f3ff] to-[#10b981] text-[#050608] text-xs font-bold rounded-xl shadow-[0_4px_12px_rgba(0,243,255,0.3)] hover:scale-[1.02] active:scale-95 transition-all"
                  >
                    SINKRONISASI DATABASES
                  </button>
                </form>
              )}
            </div>

            {/* Event logs screen */}
            <div className="bg-[#11141b] border border-white/5 rounded-[20px] p-5 shadow-2xl flex flex-col h-[280px]">
              <div className="flex justify-between items-center mb-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#00f3ff] flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5" /> SYSTEM ACTIVITY LOG
                </span>
                <button 
                  onClick={clearLogsScreen}
                  className="text-[9px] border border-white/5 hover:text-rose-450 text-[#94a3b8] px-1.5 py-0.5 rounded uppercase tracking-wider bg-[#1e222d] font-semibold transition-colors"
                >
                  CLEAR
                </button>
              </div>

              {/* Logs Area */}
              <div className="flex-grow overflow-y-auto space-y-2 font-mono text-[10px] pr-1.5 scrollbar-thin">
                {logs.map((log) => (
                  <div key={log.id} className="border-l border-[#00f3ff]/20 pl-1.5 py-0.5 select-all leading-normal flex items-start gap-1">
                    <span className="text-[#94a3b8]/50 shrink-0">[{log.time}]</span>
                    <span className={
                      log.type === "success" ? "text-emerald-400 font-bold" :
                      log.type === "warn" ? "text-amber-400" :
                      log.type === "error" ? "text-[#ff3e3e]" : "text-[#00f3ff]"
                    }>
                      {log.message}
                    </span>
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            </div>

          </section>

        </div>

        {/* SECTION D: ACADEMIC LAB COMPANION (Project Presentation Guides) */}
        <section className="pt-8 border-t border-white/5">
          <div className="bg-[#11141b] border border-white/5 rounded-[20px] p-6 sm:p-8 shadow-2xl space-y-6">
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#050608] border border-white/5 rounded-xl">
                  <BookOpen className="w-5 h-5 text-[#00f3ff]" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold tracking-wider font-sans text-gray-200">
                    A+ ACADEMIC LAB COMPANION
                  </h3>
                  <p className="text-xs text-gray-400 leading-relaxed mt-0.5">
                    Modul pendamping lengkap untuk presentasi tugas akhir kuliah, skripsi, atau proyek Smart Home IoT Anda.
                  </p>
                </div>
              </div>

              {/* Tab Toggles */}
              <div className="flex flex-wrap gap-1.5 bg-[#050608]/80 p-1.5 rounded-xl border border-white/5 shrink-0">
                <button 
                  onClick={() => setSelectedGuideTab("esp32")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    selectedGuideTab === "esp32" ? "bg-[#00f3ff] text-slate-950 shadow-[0_0_10px_rgba(0,243,255,0.25)]" : "text-[#94a3b8] hover:text-[#00f3ff]"
                  }`}
                >
                  <Cpu className="w-3.5 h-3.5 inline mr-1" /> ESP32 Firmware
                </button>
                <button 
                  onClick={() => setSelectedGuideTab("wiring")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    selectedGuideTab === "wiring" ? "bg-[#00f3ff] text-slate-950 shadow-[0_0_10px_rgba(0,243,255,0.25)]" : "text-[#94a3b8] hover:text-[#00f3ff]"
                  }`}
                >
                  <Layers className="w-3.5 h-3.5 inline mr-1" /> Skema Kabel
                </button>
                <button 
                  onClick={() => setSelectedGuideTab("vanilla")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    selectedGuideTab === "vanilla" ? "bg-[#00f3ff] text-slate-950 shadow-[0_0_10px_rgba(0,243,255,0.25)]" : "text-[#94a3b8] hover:text-[#00f3ff]"
                  }`}
                >
                  <FileCode className="w-3.5 h-3.5 inline mr-1" /> Source Code Web
                </button>
                <button 
                  onClick={() => setSelectedGuideTab("deploy")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    selectedGuideTab === "deploy" ? "bg-[#00f3ff] text-slate-950 shadow-[0_0_10px_rgba(0,243,255,0.25)]" : "text-[#94a3b8] hover:text-[#00f3ff]"
                  }`}
                >
                  <ArrowRight className="w-3.5 h-3.5 inline mr-1" /> Cara Jalan & Deploy
                </button>
              </div>
            </div>

            {/* TAB DETAILS */}
            <div className="font-sans">
              <AnimatePresence mode="wait">
                
                {/* ADVANCED ESP32 CODE INTERFACE */}
                {selectedGuideTab === "esp32" && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    exit={{ opacity: 0, y: -10 }} 
                    className="space-y-4"
                  >
                    <div className="flex justify-between items-center flex-wrap gap-2">
                      <div>
                        <h4 className="font-bold text-sm text-[#00f3ff]">Firmware Kode C++ ESP32 (Arduino IDE)</h4>
                        <p className="text-[11px] text-gray-400 mt-0.5">Integrasi sensor suhu DHT11/DHT22 dan modul relay 4 Channel ke Firebase Realtime Database.</p>
                      </div>
                      <button 
                        onClick={() => copyTextToClipboard(SECURE_ARDUINO_CODE, "esp32")}
                        className="px-3 py-1.5 bg-[#050608] border border-white/5 hover:border-[#00f3ff]/30 text-xs rounded-xl flex items-center gap-1.5 hover:text-[#00f3ff] active:scale-95 transition-all"
                      >
                        {copiedIndex === "esp32" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedIndex === "esp32" ? "KODE DISALIN!" : "SALIN FIRMWARE"}</span>
                      </button>
                    </div>

                    <div className="relative rounded-2xl overflow-hidden border border-white/5 bg-[#050608]">
                      <div className="bg-[#11141b] px-4 py-2 border-b border-white/5 flex items-center justify-between text-xs text-gray-500 font-mono">
                        <span>src/main.cpp | Arduino ESP32</span>
                        <span>C++ Language</span>
                      </div>
                      <pre className="p-4 overflow-x-auto text-[11px] font-mono leading-relaxed text-[#00f3ff]/90 max-h-[450px] scrollbar-thin select-all">
                        <code>{SECURE_ARDUINO_CODE}</code>
                      </pre>
                    </div>
                  </motion.div>
                )}

                {/* HARDWARE WIRING */}
                {selectedGuideTab === "wiring" && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    exit={{ opacity: 0, y: -10 }} 
                    className="space-y-6"
                  >
                    <div>
                      <h4 className="font-bold text-sm text-[#00f3ff]">Skema Pengkabelan & Wiring Diagram Elektronik</h4>
                      <p className="text-[11px] text-gray-400 mt-0.5">Skematik representasi pin hubung fisik antara ESP32 DevKit V1, sensor DHT, dan Modul Relay.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-mono text-xs">
                      
                      {/* Connection DHT */}
                      <div className="bg-[#050608] border border-white/5 p-5 rounded-2xl relative overflow-hidden">
                        <div className="absolute right-0 top-0 p-4 font-black opacity-[0.03] text-rose-500">DHT</div>
                        <h5 className="font-bold text-rose-400 border-b border-white/5 pb-2 mb-3 uppercase tracking-wider flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-rose-500" /> 1. KONEKSI SENSOR DHT11 / DHT22
                        </h5>
                        <ul className="space-y-3 font-mono leading-relaxed">
                          <li className="flex justify-between items-center bg-[#11141b] p-2 rounded border border-white/5">
                            <span className="text-gray-400">DHT VCC (Kaki 1)</span>
                            <span className="bg-rose-500/10 text-rose-400 px-2 py-0.5 rounded border border-rose-500/20 font-bold">Pin 3.3V / 5V ESP32</span>
                          </li>
                          <li className="flex justify-between items-center bg-[#11141b] p-2 rounded border border-white/5">
                            <span className="text-gray-400">DHT DATA (Kaki 2)</span>
                            <span className="bg-rose-500/10 text-rose-400 px-2 py-0.5 rounded border border-rose-500/20 font-bold">GPIO 15 ESP32</span>
                          </li>
                          <li className="flex justify-between items-center bg-[#11141b] p-2 rounded border border-white/5">
                            <span className="text-gray-400">DHT GND (Kaki 4)</span>
                            <span className="bg-rose-500/10 text-rose-400 px-2 py-0.5 rounded border border-rose-500/20 font-bold">Pin GND ESP32</span>
                          </li>
                        </ul>
                        <p className="text-[10px] text-slate-500 mt-4 leading-relaxed font-sans">
                          * Catatan: Pasangkan resistor pull-up 10K ohm antara kaki VCC dan DATA sensor DHT jika Anda menggunakan sensor DHT batangan tanpa board module breakout.
                        </p>
                      </div>

                      {/* Connection Relay */}
                      <div className="bg-[#050608] border border-white/5 p-5 rounded-2xl relative overflow-hidden">
                        <div className="absolute right-0 top-0 p-4 font-black opacity-[0.03] text-emerald-500">RELAY</div>
                        <h5 className="font-bold text-emerald-400 border-b border-white/5 pb-2 mb-3 uppercase tracking-wider flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" /> 2. KONEKSI MODUL RELAY 4-CHANNEL
                        </h5>
                        <ul className="space-y-3 font-mono leading-relaxed">
                          <li className="flex justify-between items-center bg-[#11141b] p-2 rounded border border-white/5">
                            <span className="text-gray-400">Relay VCC (Power)</span>
                            <span className="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20 font-bold">Pin VIN/V5V ESP32</span>
                          </li>
                          <li className="flex justify-between items-center bg-[#11141b] p-2 rounded border border-white/5">
                            <span className="text-gray-400">Relay GND (Ground)</span>
                            <span className="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20 font-bold">Pin GND ESP32</span>
                          </li>
                          <li className="flex justify-between items-center bg-[#11141b] p-2 rounded border border-white/5">
                            <span className="text-gray-400">Relay IN1 (Lampu 1)</span>
                            <span className="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20 font-bold">GPIO 2 ESP32</span>
                          </li>
                          <li className="flex justify-between items-center bg-[#11141b] p-2 rounded border border-white/5">
                            <span className="text-gray-400">Relay IN2 (Lampu 2)</span>
                            <span className="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20 font-bold">GPIO 4 ESP32</span>
                          </li>
                          <li className="flex justify-between items-center bg-[#11141b] p-2 rounded border border-white/5">
                            <span className="text-gray-400">Relay IN3 (Lampu 3)</span>
                            <span className="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20 font-bold">GPIO 5 ESP32</span>
                          </li>
                          <li className="flex justify-between items-center bg-[#11141b] p-2 rounded border border-white/5">
                            <span className="text-gray-400">Relay IN4 (Alat 4)</span>
                            <span className="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20 font-bold">GPIO 18 ESP32</span>
                          </li>
                        </ul>
                      </div>

                    </div>
                  </motion.div>
                )}

                {/* VIEW VANILLA SOURCE CODES */}
                {selectedGuideTab === "vanilla" && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    exit={{ opacity: 0, y: -10 }} 
                    className="space-y-6"
                  >
                    <div>
                      <h4 className="font-bold text-sm text-[#00f3ff]">File-file Versi Pure Javascript (Vanila)</h4>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        File-file berikut di bawah ini telah dibuat di dalam folder <code className="text-teal-400">/vanilla-web/</code> pada project ini. Sangat bersih, tanpa compiler React / Vite, siap dijalankan di laptop penguji langsung menggunakan Live Server VS Code!
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-6 text-xs">
                      
                      {/* index.html viewer */}
                      <div className="space-y-2 bg-[#050608] p-4 rounded-2xl border border-white/5">
                        <div className="flex justify-between items-center">
                          <code className="text-[#00f3ff] text-xs font-bold font-mono">1. folder/vanilla-web/index.html</code>
                          <button 
                            onClick={() => copyTextToClipboard(vanillaHTML, "v_html")}
                            className="bg-[#11141b] text-[10px] px-2 py-1 border border-white/5 rounded font-semibold text-gray-400 flex items-center gap-1 hover:text-[#00f3ff] transition-colors"
                          >
                            {copiedIndex === "v_html" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            <span>SALIN</span>
                          </button>
                        </div>
                        <pre className="p-3 bg-[#11141b]/95 select-all max-h-[140px] overflow-y-auto rounded-xl font-mono text-[10px] text-[#00f3ff]/80 scrollbar-thin">
                          <code>{vanillaHTML}</code>
                        </pre>
                      </div>

                      {/* script.js viewer */}
                      <div className="space-y-2 bg-[#050608] p-4 rounded-2xl border border-white/5">
                        <div className="flex justify-between items-center">
                          <code className="text-[#00f3ff] text-xs font-bold font-mono">2. folder/vanilla-web/script.js</code>
                          <button 
                            onClick={() => copyTextToClipboard(vanillaJS, "v_js")}
                            className="bg-[#11141b] text-[10px] px-2 py-1 border border-white/5 rounded font-semibold text-gray-400 flex items-center gap-1 hover:text-[#00f3ff] transition-colors"
                          >
                            {copiedIndex === "v_js" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            <span>SALIN</span>
                          </button>
                        </div>
                        <pre className="p-3 bg-[#11141b]/95 select-all max-h-[140px] overflow-y-auto rounded-xl font-mono text-[10px] text-[#00f3ff]/80 scrollbar-thin">
                          <code>{vanillaJS}</code>
                        </pre>
                      </div>

                      {/* style.css & config viewer */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2 bg-[#050608] p-4 rounded-2xl border border-white/5">
                          <div className="flex justify-between items-center">
                            <code className="text-[#00f3ff] text-xs font-bold font-mono">3. vanilla-web/style.css</code>
                            <button 
                              onClick={() => copyTextToClipboard(vanillaCSS, "v_css")}
                              className="bg-[#11141b] text-[10px] px-2 py-1 border border-white/5 rounded font-semibold text-gray-400 flex items-center gap-1 hover:text-[#00f3ff] transition-colors"
                            >
                              {copiedIndex === "v_css" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                              <span>SALIN</span>
                            </button>
                          </div>
                          <pre className="p-3 bg-[#11141b]/95 select-all h-[110px] overflow-y-auto rounded-xl font-mono text-[10px] text-[#00f3ff]/80 scrollbar-thin">
                            <code>{vanillaCSS}</code>
                          </pre>
                        </div>

                        <div className="space-y-2 bg-[#050608] p-4 rounded-2xl border border-white/5">
                          <div className="flex justify-between items-center">
                            <code className="text-[#00f3ff] text-xs font-bold font-mono">4. vanilla-web/firebase-config.js</code>
                            <button 
                              onClick={() => copyTextToClipboard(vanillaFB, "v_fb")}
                              className="bg-[#11141b] text-[10px] px-2 py-1 border border-white/5 rounded font-semibold text-gray-400 flex items-center gap-1 hover:text-[#00f3ff] transition-colors"
                            >
                              {copiedIndex === "v_fb" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                              <span>SALIN</span>
                            </button>
                          </div>
                          <pre className="p-3 bg-[#11141b]/95 select-all h-[110px] overflow-y-auto rounded-xl font-mono text-[10px] text-[#00f3ff]/80 scrollbar-thin">
                            <code>{vanillaFB}</code>
                          </pre>
                        </div>
                      </div>

                    </div>
                  </motion.div>
                )}

                {/* RUNNING & DEPLOY GUIDE */}
                {selectedGuideTab === "deploy" && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    exit={{ opacity: 0, y: -10 }} 
                    className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs leading-relaxed"
                  >
                    
                    {/* Running Locally Guide */}
                    <div className="bg-[#050608] border border-white/5 p-5 rounded-2xl relative">
                      <h5 className="font-bold text-[#00f3ff] border-b border-white/5 pb-2 mb-3 uppercase tracking-wider flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[#00f3ff]" /> CARA MENJALANKAN DI LAPTOP (LOCAL)
                      </h5>
                      <ol className="list-decimal list-inside space-y-2 text-gray-300 font-sans pl-1">
                        <li>
                          Buka aplikasi <strong>Visual Studio Code (VS Code)</strong> di komputer Anda.
                        </li>
                        <li>
                          Buka / Drag folder proyek <strong>vanilla-web</strong> yang telah diunduh/asal dari ZIP ini.
                        </li>
                        <li>
                          Install ekstensi VS Code bernama <strong className="text-cyan-300">Live Server</strong> oleh Ritwick Dey (ikon bertuliskan "Go Live").
                        </li>
                        <li>
                          Buka file <code className="text-pink-400 font-mono text-[10px] bg-[#11141b] px-1 py-0.5 rounded">index.html</code>, lalu klik tombol <strong className="text-[#00f3ff]">"Go Live"</strong> di bilah bagian kanan bawah VS Code Anda.
                        </li>
                        <li>
                          Aplikasi web akan terbuka otomatis di web browser default Anda! (Misal: <code className="text-emerald-400">http://127.0.0.1:5500/index.html</code>)
                        </li>
                      </ol>
                    </div>

                    {/* Deployment Guide */}
                    <div className="bg-[#050608] border border-white/5 p-5 rounded-2xl relative">
                      <h5 className="font-bold text-emerald-400 border-b border-white/5 pb-2 mb-3 uppercase tracking-wider flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" /> CARA DEPLOY KE FIREBASE HOSTING GRATIS
                      </h5>
                      <ol className="list-decimal list-inside space-y-2 text-gray-300 font-sans pl-1">
                        <li>
                          Buka terminal console, instal tool resmi Firebase CLI global:
                          <pre className="bg-[#11141b] p-2 rounded mt-1.5 font-mono text-[9px] text-[#00f3ff] border border-white/5 select-all">npm install -g firebase-tools</pre>
                        </li>
                        <li>
                          Login ke akun Firebase Google Anda lewat konsol:
                          <pre className="bg-[#11141b] p-2 rounded mt-1.5 font-mono text-[9px] text-[#00f3ff] border border-white/5 select-all">firebase login</pre>
                        </li>
                        <li>
                          Masuk ke direktori folder <code className="font-mono text-[10px]">vanilla-web</code>, lalu inisialisasi:
                          <pre className="bg-[#11141b] p-2 rounded mt-1.5 font-mono text-[9px] text-[#00f3ff] border border-white/5 select-all">firebase init hosting</pre>
                          <span className="text-[10px] text-gray-400 block mt-1">* Catatan: Pilih project Anda, set directory public ke "." (titik), dan configure as single-page app ke No.</span>
                        </li>
                        <li>
                          Upload & Deploy web Anda ke hosting server Firebase gratis:
                          <pre className="bg-[#11141b] p-2 rounded mt-1.5 font-mono text-[9px] text-[#00f3ff] border border-white/5 select-all">firebase deploy</pre>
                        </li>
                      </ol>
                    </div>

                  </motion.div>
                )}

              </AnimatePresence>
            </div>

          </div>
        </section>

      </main>

      {/* Footer copyright */}
      <footer className="border-t border-white/5 bg-[#050608] py-5 text-center text-xs text-[#94a3b8]/50 px-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          <p>© 2026 NEXUS IOT SYSTEMS • SMART HOME ENGINE v2.4.0 • CLOUD SYNC ACTIVE</p>
          <div className="flex items-center gap-2 text-[#00f3ff]/60 font-semibold font-mono">
            <span>READY FOR ESP32 DEV-BOARD</span>
            <span className="text-gray-800">|</span>
            <span className="text-emerald-500/70">A+ RANK COLLEGE BUILD</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
