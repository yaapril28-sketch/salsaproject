// Import Modular Firebase Database jika diperlukan
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, onValue, set, update } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// === INISIALISASI STATE & FALLBACK SIMULASI ===
// State lokal jika berjalan dalam mode simulasi offline
let localDB = {
    relay: {
        relay1: 0,
        relay2: 0,
        relay3: 0,
        relay4: 0,
        lampCFL: 0,
        lampLED: 0
    },
    sensor: {
        temperature: 26.5,
        humidity: 62
    }
};

let isSimulated = true;
let db = null;
let databaseRef = null;

// Ambil konfigurasi lokal browser jika sebelumnya sudah disimpan
const savedDbURL = localStorage.getItem('NEXUS_FB_DB_URL');
const savedApiKey = localStorage.getItem('NEXUS_FB_API_KEY');
const savedProjId = localStorage.getItem('NEXUS_FB_PROJ_ID');

// === KONEKSI KE FIREBASE ===
function initFirebase() {
    const statusText = document.getElementById('db-status-text');
    const statusBadge = document.getElementById('db-status-badge');
    const alertBanner = document.getElementById('firebase-alert');

    // Cek apakah ada config valid dari UI atau file config yang diisi
    // Secara default, jika masih mendeteksi "ISI_CONFIG" / kosong, jalankan simulasi
    let configToUse = null;

    if (savedDbURL && savedDbURL.trim() !== "") {
        configToUse = {
            apiKey: savedApiKey || "",
            databaseURL: savedDbURL,
            projectId: savedProjId || "nexus-smart-iot",
            authDomain: `${savedProjId || "nexus-smart-iot"}.firebaseapp.com`
        };
        isSimulated = false;
        createLog("Menginisialisasi koneksi Firebase Realtime Database dari penyimpanan lokal...");
    } else {
        // Mode Simulasi Offline Default
        isSimulated = true;
        createLog("Koneksi Firebase ditunda. Menjalankan modul simulasi cerdas luring.");
    }

    if (!isSimulated && configToUse) {
        try {
            const app = initializeApp(configToUse);
            db = getDatabase(app);
            
            // Atur status indikator
            statusBadge.className = "flex items-center gap-2 bg-emerald-500/10 px-3.5 py-1.5 rounded-lg border border-emerald-500/30 text-emerald-400 text-xs font-semibold transition-all duration-300";
            statusBadge.querySelector('span').className = "w-2 h-2 rounded-full bg-emerald-400 inline-block shadow-[0_0_8px_#10b981]";
            statusText.textContent = "TERHUBUNG KE FIREBASE";
            alertBanner.classList.add('hidden'); // Sembunyikan alert jika sukses terhubung

            // Daftarkan listener realtime untuk seluruh node
            const dbRef = ref(db, '/');
            onValue(dbRef, (snapshot) => {
                const data = snapshot.val();
                if (data) {
                    if (data.relay) {
                        localDB.relay = { ...localDB.relay, ...data.relay };
                    }
                    if (data.sensor) {
                        localDB.sensor = { ...localDB.sensor, ...data.sensor };
                    }
                    updateUI();
                }
            }, (error) => {
                showToast("Firebase Error: " + error.message, "danger");
                fallbackToSimulation();
            });

        } catch (e) {
            console.error(e);
            showToast("Gagal menginisialisasi Firebase, beralih ke simulasi", "warning");
            fallbackToSimulation();
        }
    } else {
        fallbackToSimulation();
    }
}

function fallbackToSimulation() {
    isSimulated = true;
    const statusText = document.getElementById('db-status-text');
    const statusBadge = document.getElementById('db-status-badge');
    const alertBanner = document.getElementById('firebase-alert');

    statusBadge.className = "flex items-center gap-2 bg-amber-500/10 px-3.5 py-1.5 rounded-lg border border-amber-500/30 text-amber-400 text-xs font-semibold animate-pulse transition-all duration-300";
    statusBadge.querySelector('span').className = "w-2 h-2 rounded-full bg-amber-400 inline-block shadow-[0_0_8px_#f59e0b]";
    statusText.textContent = "MODE SIMULASI (OFFLINE)";
    alertBanner.classList.remove('hidden');

    // Load Nilai Awal Pembuat
    updateUI();
}

// === AKTIVITAS LOG & NOTIFIKASI ===
function createLog(message) {
    const logContainer = document.getElementById('activity-log');
    if (!logContainer) return;
    
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];
    
    const logItem = document.createElement('div');
    logItem.className = "border-l-2 border-cyan-500/40 pl-2 py-0.5 text-[#38bdf8] select-all";
    logItem.innerHTML = `<span class="text-gray-500">[${timeStr}]</span> ${message}`;
    
    logContainer.appendChild(logItem);
    logContainer.scrollTop = logContainer.scrollHeight;
}

function clearActivityLogs() {
    const logContainer = document.getElementById('activity-log');
    if (logContainer) {
        logContainer.innerHTML = `<div class="text-slate-500">[${new Date().toTimeString().split(' ')[0]}] Log aktivitas sistem berhasil dibersihkan.</div>`;
    }
}
window.clearActivityLogs = clearActivityLogs;

function showToast(message, type = "success") {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) return;

    const toast = document.createElement('div');
    let bgClass = "bg-slate-900 border-emerald-500/30 text-emerald-300";
    let icon = "fa-circle-check text-emerald-400";
    
    if (type === "warning") {
        bgClass = "bg-slate-900 border-amber-500/30 text-amber-300";
        icon = "fa-triangle-exclamation text-amber-400";
    } else if (type === "danger") {
        bgClass = "bg-slate-900 border-rose-500/30 text-rose-300";
        icon = "fa-circle-xmark text-rose-400";
    }

    toast.className = `toast-msg flex items-center gap-3 px-4 py-3 rounded-xl border ${bgClass} shadow-lg backdrop-blur-md min-w-[280px] max-w-sm`;
    toast.innerHTML = `
        <i class="fa-solid ${icon} text-lg shrink-0"></i>
        <div class="flex-grow">
            <p class="text-xs font-bold leading-tight font-sans">${message}</p>
        </div>
    `;

    toastContainer.appendChild(toast);
    
    // Hapus dari DOM setelah 5 detik (sesuai animasi CSS)
    setTimeout(() => {
        toast.remove();
    }, 5000);
}

// === UPDATE VIEW UI ===
function updateUI() {
    // 1. Update Suhu & Kelembaban
    const tempVal = document.getElementById('temp-val');
    const tempProgress = document.getElementById('temp-progress');
    const tempStatus = document.getElementById('temp-status');
    const humVal = document.getElementById('humidity-val');
    const humProgress = document.getElementById('humidity-progress');
    const humStatus = document.getElementById('humidity-status');

    const temp = parseFloat(localDB.sensor.temperature).toFixed(1);
    const hum = Math.round(localDB.sensor.humidity);

    tempVal.textContent = temp;
    // Map temperature 0-50 ke persen width
    const tempPrc = Math.min(Math.max((temp / 50) * 100, 0), 100);
    tempProgress.style.width = `${tempPrc}%`;
    
    if (temp < 20) {
        tempStatus.textContent = "DINGIN";
        tempStatus.className = "text-cyan-400";
    } else if (temp <= 29) {
        tempStatus.textContent = "NORMAL";
        tempStatus.className = "text-emerald-400 font-bold";
    } else {
        tempStatus.textContent = "PANAS / OVERHEAT";
        tempStatus.className = "text-rose-500 font-bold";
    }

    humVal.textContent = hum;
    humProgress.style.width = `${hum}%`;
    if (hum < 40) {
        humStatus.textContent = "KERING";
        humStatus.className = "text-orange-400";
    } else if (hum <= 70) {
        humStatus.textContent = "NYAMAN";
        humStatus.className = "text-emerald-400 font-bold";
    } else {
        humStatus.textContent = "LEMBAB / BASAH";
        humStatus.className = "text-cyan-400";
    }

    // Update Simulator slider labels
    document.getElementById('sim-temp-lbl').textContent = `${temp}°C`;
    document.getElementById('sim-hum-lbl').textContent = `${hum}%`;

    // 2. Update Relay Switch indicators
    const items = [
        { key: 'relay1', id: '1' },
        { key: 'relay2', id: '2' },
        { key: 'relay3', id: '3' },
        { key: 'relay4', id: '4' },
        { key: 'lampCFL', id: '5' },
        { key: 'lampLED', id: '6' }
    ];

    items.forEach(item => {
        const val = localDB.relay[item.key];
        const cardObj = document.getElementById(`relay-card-${item.id}`);
        const statusBadge = document.getElementById(`relay-status-${item.id}`);
        const iconCont = document.getElementById(`lamp-icon-container-${item.id}`);
        const btnOn = document.getElementById(`btn-on-${item.id}`);
        const btnOff = document.getElementById(`btn-off-${item.id}`);

        if (!cardObj) return;

        if (val === 1 || val === true) {
            // Relay ON
            cardObj.classList.add('active-glow');
            if (item.key === 'lampCFL') {
                cardObj.style.boxShadow = '0 0 20px rgba(245, 158, 11, 0.15)';
                cardObj.style.borderColor = 'rgba(245, 158, 11, 0.4)';
            } else if (item.key === 'lampLED') {
                cardObj.style.boxShadow = '0 0 20px rgba(6, 182, 212, 0.15)';
                cardObj.style.borderColor = 'rgba(6, 182, 212, 0.4)';
            }
            statusBadge.textContent = "AKTIF";
            statusBadge.classList.add('status-active');
            iconCont.classList.add('icon-active');
            if (item.key === 'lampCFL') {
                iconCont.style.color = '#f59e0b';
                iconCont.style.backgroundColor = 'rgba(245, 158, 11, 0.1)';
                statusBadge.style.color = '#f59e0b';
                statusBadge.style.backgroundColor = 'rgba(245, 158, 11, 0.1)';
                statusBadge.style.borderColor = 'rgba(245, 158, 11, 0.3)';
            }
            
            btnOn.className = item.key === 'lampCFL' 
                ? "py-2.5 bg-amber-500 font-extrabold text-slate-950 text-xs font-bold rounded-lg transition-all duration-200 active:scale-95 shadow-[0_0_10px_rgba(245,158,11,0.3)]"
                : "py-2.5 btn-on-active text-xs font-bold rounded-lg transition-all duration-200 active:scale-95 shadow-[0_0_10px_rgba(16,185,129,0.3)]";
            btnOff.className = "py-2.5 bg-neutral-900 border border-rose-500/20 hover:border-rose-500 hover:bg-rose-500/10 text-rose-400 hover:shadow-[0_0_10px_rgba(244,63,94,0.2)] text-xs font-bold rounded-lg transition-all duration-200 active:scale-95";
        } else {
            // Relay OFF
            cardObj.classList.remove('active-glow');
            cardObj.style.boxShadow = '';
            cardObj.style.borderColor = '';
            statusBadge.textContent = "MATI";
            statusBadge.classList.remove('status-active');
            iconCont.classList.remove('icon-active');
            if (item.key === 'lampCFL') {
                iconCont.style.color = '';
                iconCont.style.backgroundColor = '';
                statusBadge.style.color = '';
                statusBadge.style.backgroundColor = '';
                statusBadge.style.borderColor = '';
            }

            btnOn.className = "py-2.5 bg-neutral-900 border border-emerald-500/20 hover:border-emerald-500 hover:bg-emerald-500/10 text-emerald-400 hover:shadow-[0_0_10px_rgba(16,185,129,0.2)] text-xs font-bold rounded-lg transition-all duration-200 active:scale-95";
            btnOff.className = "py-2.5 btn-off-active text-xs font-bold rounded-lg transition-all duration-200 active:scale-95 shadow-[0_0_10px_rgba(244,63,94,0.3)]";
        }
    });
}

// === TOMBOL KONTROL RELAY ===
function controlRelay(relayKey, value) {
    if (localDB.relay[relayKey] === value) return; // Tidak terjadi perubahan

    const lampNames = {
        relay1: "Lampu 1 (Teras Depan)",
        relay2: "Lampu 2 (Ruang Tamu)",
        relay3: "Lampu 3 (Kamar Tidur)",
        relay4: "Lampu 4 (Stop Kontak)",
        lampCFL: "Lampu CFL (Warm White)",
        lampLED: "Lampu LED (Electric Blue)"
    };

    const actionText = value === 1 ? "Dinyalakan" : "Dimatikan";
    const statusType = value === 1 ? "success" : "warning";

    if (!isSimulated && db) {
        // Update Firebase DB Realtime
        const relayRef = ref(db, `relay/${relayKey}`);
        set(relayRef, value)
            .then(() => {
                createLog(`${lampNames[relayKey]} berhasil ${actionText.toLowerCase()} via dashboard.`);
                showToast(`${lampNames[relayKey]} ${actionText}!`, statusType);
            })
            .catch(err => {
                showToast("Firebase Error: " + err.message, "danger");
                createLog(`Gagal mengubah data pada server Firebase: ${err.message}`);
            });
    } else {
        // Mode Simulasi Offline lokal
        localDB.relay[relayKey] = value;
        createLog(`[Offline-Sim] ${lampNames[relayKey]} berhasil ${actionText.toLowerCase()}.`);
        showToast(`[Simulasi] ${lampNames[relayKey]} ${actionText}!`, statusType);
        updateUI();
    }
}
window.controlRelay = controlRelay;

// Master Control (Toggle All)
function toggleAllRelays(turnOn) {
    const value = turnOn ? 1 : 0;
    const actionText = turnOn ? "Menyalakan semua peralatan utama..." : "Mematikan semua peralatan utama...";
    createLog(actionText);

    if (!isSimulated && db) {
        const relaysRef = ref(db, 'relay');
        update(relaysRef, {
            relay1: value,
            relay2: value,
            relay3: value,
            relay4: value,
            lampCFL: value,
            lampLED: value
        }).then(() => {
            showToast(turnOn ? "Semua relay DINYALAKAN!" : "Semua relay DIMATIKAN!", turnOn ? "success" : "warning");
        }).catch(err => {
            showToast("Firebase Error: " + err.message, "danger");
        });
    } else {
        localDB.relay.relay1 = value;
        localDB.relay.relay2 = value;
        localDB.relay.relay3 = value;
        localDB.relay.relay4 = value;
        localDB.relay.lampCFL = value;
        localDB.relay.lampLED = value;
        showToast(turnOn ? "[Sim] Semua relay DINYALAKAN!" : "[Sim] Semua relay DIMATIKAN!", turnOn ? "success" : "warning");
        updateUI();
    }
}
window.toggleAllRelays = toggleAllRelays;

// === PENGATURAN TAMPILAN MODAL DAN CONFIG ===
function saveFirebaseSetup() {
    const dbURLInput = document.getElementById('setup-db-url').value;
    const apiKeyInput = document.getElementById('setup-api-key').value;
    const projIdInput = document.getElementById('setup-proj-id').value;

    if (!dbURLInput || dbURLInput.trim() === "") {
        showToast("Database URL tidak boleh kosong!", "danger");
        return;
    }

    localStorage.setItem('NEXUS_FB_DB_URL', dbURLInput.trim());
    localStorage.setItem('NEXUS_FB_API_KEY', apiKeyInput.trim());
    localStorage.setItem('NEXUS_FB_PROJ_ID', projIdInput.trim() || "nexus-smart-iot");

    showToast("Konfigurasi disimpan. Memuat ulang koneksi...", "success");
    toggleSetupModal();
    
    // Inisialisasi ulang
    setTimeout(() => {
        initFirebase();
    }, 500);
}
window.saveFirebaseSetup = saveFirebaseSetup;

function resetFirebaseSetup() {
    localStorage.removeItem('NEXUS_FB_DB_URL');
    localStorage.removeItem('NEXUS_FB_API_KEY');
    localStorage.removeItem('NEXUS_FB_PROJ_ID');

    showToast("Konfigurasi di-reset. Kembali ke sistem simulasi luring.", "warning");
    toggleSetupModal();

    setTimeout(() => {
        fallbackToSimulation();
    }, 500);
}
window.resetFirebaseSetup = resetFirebaseSetup;

// === VOICE COMMAND CONSOLE (Web Speech API) ===
function startVoiceRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const micIcon = document.getElementById('mic-icon');
    const micBtnText = document.getElementById('mic-btn-text');
    const transText = document.getElementById('transcription-text');
    const waves = document.getElementById('voice-waves');

    if (!SpeechRecognition) {
        showToast("Web Speech Recognition tidak didukung web browser ini. Coba gunakan Google Chrome.", "danger");
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'id-ID'; // Bahasa Indonesia
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
        micIcon.className = "fa-solid fa-microphone text-rose-500 animate-ping";
        micBtnText.textContent = "MENDENGARKAN...";
        transText.textContent = "Silakan ucapkan perintah perintah suara sekarang...";
        transText.classList.remove('italic');
        waves.classList.remove('hidden');
    };

    recognition.onerror = (e) => {
        console.error("Speech Error:", e);
        showToast("Gagal mengenali suara: " + e.error, "danger");
        resetMicButton();
    };

    recognition.onend = () => {
        resetMicButton();
    };

    recognition.onresult = (event) => {
        const command = event.results[0][0].transcript.toLowerCase().trim();
        transText.textContent = `"${command}"`;
        createLog(`Menerima input suara: "${command}"`);
        prosesSuara(command);
    };

    recognition.start();
}
window.startVoiceRecognition = startVoiceRecognition;

function resetMicButton() {
    const micIcon = document.getElementById('mic-icon');
    const micBtnText = document.getElementById('mic-btn-text');
    const waves = document.getElementById('voice-waves');

    micIcon.className = "fa-solid fa-microphone text-base";
    micBtnText.textContent = "DENGARKAN PERINTAH";
    waves.classList.add('hidden');
}

// Ekstensi Simulasi Trigger Suara via Click
function voiceTriggerSim(command) {
    const transText = document.getElementById('transcription-text');
    transText.textContent = `"${command}" (Simulasi Klik)`;
    createLog(`Memicu perintah suara simulasi: "${command}"`);
    prosesSuara(command.toLowerCase());
}
window.voiceTriggerSim = voiceTriggerSim;

// Parser Logika Perintah Suara Bahasa Indonesia
function prosesSuara(command) {
    let matched = false;

    // Robot feedback konfirmasi voice
    const SpeakResponse = (text) => {
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'id-ID';
            utterance.rate = 1.1;
            window.speechSynthesis.speak(utterance);
        }
    };

    // 1. Matikan/Nyalakan Semua
    if (command.includes('nyalakan semua') || command.includes('hidupkan semua')) {
        toggleAllRelays(true);
        SpeakResponse("Baik, semua lampu dinyalakan.");
        matched = true;
    } else if (command.includes('matikan semua')) {
        toggleAllRelays(false);
        SpeakResponse("Baik, semua lampu dimatikan.");
        matched = true;
    }

    // 2. Kontrol Relay Individu
    if (!matched) {
        const isTurnOn = command.includes('nyalakan') || command.includes('hidupkan');
        const isTurnOff = command.includes('matikan');
        const val = isTurnOn ? 1 : 0;
        const actionLabel = isTurnOn ? "dinyalakan" : "dimatikan";

        if (isTurnOn || isTurnOff) {
            if (command.includes('cfl') || command.includes('warm') || command.includes('lampu 5') || command.includes('lampu lima')) {
                controlRelay('lampCFL', val);
                SpeakResponse(`Baik, lampu C F L ${actionLabel}.`);
                matched = true;
            } else if (command.includes('led') || command.includes('blue') || command.includes('lampu 6') || command.includes('lampu enam')) {
                controlRelay('lampLED', val);
                SpeakResponse(`Baik, lampu L E D ${actionLabel}.`);
                matched = true;
            } else {
                const targets = [
                    { id: 1, key: 'relay1', name: "Lampu satu" },
                    { id: 2, key: 'relay2', name: "Lampu dua" },
                    { id: 3, key: 'relay3', name: "Lampu tiga" },
                    { id: 4, key: 'relay4', name: "Alat empat" }
                ];

                for (const target of targets) {
                    const matchesTarget = command.includes(`lampu ${target.id}`) || 
                                          command.includes(`nomor ${target.id}`) || 
                                          command.includes(`alat ${target.id}`) ||
                                          command.includes(`${target.id}`);
                    if (matchesTarget) {
                        controlRelay(target.key, val);
                        SpeakResponse(`Baik, ${target.name} ${actionLabel}.`);
                        matched = true;
                        break;
                    }
                }
            }
        }
    }

    if (!matched) {
        showToast("Perintah suara tidak dikenali!", "warning");
        SpeakResponse("Maaf, perintah suara tidak dikenali. Silakan coba lagi.");
    }
}

// === SIMULASI DRIFT ALAMIAH SENSOR (EFEK HOVER REAL) ===
// Membuat nilai DHT sensor terlihat dinamis bergerak halus sekian detik sekali
function startSensorSimulation() {
    setInterval(() => {
        // Hanya update jika sedang di mode simulasi agar tidak menimpa data sensor ESP32 asli
        if (isSimulated) {
            // Drift kecil antara -0.2 / +0.2 derajat dan persen
            const driftTemp = (Math.random() - 0.5) * 0.4;
            const driftHum = (Math.random() - 0.5) * 1;

            localDB.sensor.temperature = Math.min(Math.max(localDB.sensor.temperature + driftTemp, 18), 42);
            localDB.sensor.humidity = Math.min(Math.max(localDB.sensor.humidity + driftHum, 30), 90);

            updateUI();
        }
    }, 4000);
}

// Mengatur slider simulasi dari feedback mahasiswa
function configureSliders() {
    const tempSlider = document.getElementById('sim-temp-slider');
    const humSlider = document.getElementById('sim-hum-slider');

    if (tempSlider && humSlider) {
        tempSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            localDB.sensor.temperature = val;
            updateUI();
            if (!isSimulated && db) {
                set(ref(db, 'sensor/temperature'), val);
            }
        });

        humSlider.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            localDB.sensor.humidity = val;
            updateUI();
            if (!isSimulated && db) {
                set(ref(db, 'sensor/humidity'), val);
            }
        });
    }
}

// === DIGITAL REALTIME CLOCK ===
function startDigitalClock() {
    const clockEl = document.getElementById('digital-clock');
    if (!clockEl) return;
    
    setInterval(() => {
        const now = new Date();
        const timeStr = now.toTimeString().split(' ')[0];
        clockEl.textContent = timeStr;
    }, 1000);
}

// === RUN APPLICATON ON DOCUMENT LOAD ===
document.addEventListener('DOMContentLoaded', () => {
    startDigitalClock();
    initFirebase();
    startSensorSimulation();
    configureSliders();

    // Isi Nilai awal modal jika ada
    if (savedDbURL) document.getElementById('setup-db-url').value = savedDbURL;
    if (savedApiKey) document.getElementById('setup-api-key').value = savedApiKey;
    if (savedProjId) document.getElementById('setup-proj-id').value = savedProjId;
});
