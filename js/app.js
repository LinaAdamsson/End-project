// ============================================================
// AUDIO ATLAS – City Soundscape
// - Klick på sök: spelar introduktionsljud, väntar tills det är klart
// - Sedan: flyger till staden och spelar platsljud
// ============================================================

document.addEventListener('DOMContentLoaded', () => {

  // 1) Hämta UI-element
  const cityInput = document.getElementById('cityInput');
  const searchBtn = document.getElementById('searchBtn');
  const playBtn   = document.getElementById('playBtn');
  const statusEl  = document.getElementById('status');
  const logoEl    = document.getElementById('logo');

  // 2) Skapa Leaflet-kartan
  const map = L.map('map').setView([35.0, 13.0], 3);
  L.tileLayer(
    'https://tiles.stadiamaps.com/tiles/stamen_watercolor/{z}/{x}/{y}.jpg',
    { maxZoom: 16, attribution: '© Stadia Maps © Stamen Design © OSM' }
  ).addTo(map);

  let marker = null;
  let currentAudio = null;

  // 3) Stad → ljud (override-tabell)
  const CITY_SOUND_OVERRIDES = {
    "barcelona": "https://cdn.freesound.org/previews/672/672830_11891749-lq.mp3",
    "marstrand": "https://cdn.freesound.org/previews/638/638157_2061858-lq.mp3",
    "salta": "https://cdn.freesound.org/previews/794/794556_11563061-lq.mp3"
  };

  const DEFAULT_CITY_AMBIENCE =
    "https://cdn.freesound.org/previews/609/609385_5674468-hq.mp3";

  // 4) Nya globala ljud
  const INTRO_SOUND =
    "https://cdn.freesound.org/previews/826/826386_15636277-lq.mp3"; // spelas först
  const ARRIVAL_SOUND =
    "https://cdn.freesound.org/previews/401/401157_7650299-lq.mp3"; // spelas vid ankomst

  // Hjälpfunktion: status
  function setStatus(msg) { statusEl.textContent = msg || ""; }

  // Hjälpfunktion: spela ljud och vänta tills det är klart
  function playAndWait(url) {
    return new Promise((resolve) => {
      if (currentAudio) currentAudio.pause();
      const a = new Audio(url);
      a.crossOrigin = "anonymous";
      currentAudio = a;
      a.volume = 0.7;
      a.play().catch(() => setStatus("Ljud blockerat – klicka igen."));
      a.addEventListener("ended", resolve);
    });
  }

  // Hjälpfunktion: spela upp platsljud (loop)
  function playUrl(url, { volume = 0.6, loop = true } = {}) {
    if (currentAudio) currentAudio.pause();
    const a = new Audio(url);
    a.crossOrigin = "anonymous";
    a.loop = loop;
    a.volume = volume;
    currentAudio = a;
    a.play().catch(() => {
      setStatus("Ljud blockerat – klicka knappen igen eller tillåt ljud för sidan.");
    });
  }

  // Geokodning
  async function geocodeCity(city) {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('q', city);
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', '1');
    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': 'AudioAtlas/1.0 (student project)' }
    });
    if (!res.ok) throw new Error('Geokodning misslyckades.');
    const data = await res.json();
    if (!data.length) throw new Error('Hittade ingen plats med det namnet.');
    const { lat, lon, display_name } = data[0];
    return { lat: parseFloat(lat), lon: parseFloat(lon), name: display_name };
  }

  // Uppdatera karta
  function focusCityOnMap({ lat, lon, name }) {
    map.flyTo([lat, lon], 12, { duration: 2 });
    if (marker) marker.remove();
    marker = L.marker([lat, lon]).addTo(map).bindPopup(`<b>${name}</b>`).openPopup();
    const typed = (cityInput.value || "").trim();
    playBtn.dataset.city = (typed || name).toLowerCase();
    playBtn.disabled = false;
  }

  // Sök-knappen: spela ljud, vänta, sedan flytta karta
  searchBtn.addEventListener('click', async () => {
    const city = cityInput.value.trim();
    if (!city) { setStatus('Skriv in en stad först.'); return; }

    try {
      setStatus("Lyssnar på startljud...");
      // 1️⃣ Spela intro-ljud och vänta tills det är klart
      await playAndWait(INTRO_SOUND);

      setStatus("Söker stad...");
      const result = await geocodeCity(city);

      // 2️⃣ När intro-ljudet är färdigt → flyg till stad
      focusCityOnMap(result);

      // 3️⃣ Spela ankomstljud
      playUrl(ARRIVAL_SOUND, { loop: false, volume: 0.8 });

      // 4️⃣ Flytta loggan till hörnet
      logoEl.classList.add('in-header');
      setStatus('');
    } catch (err) {
      setStatus('Fel: ' + err.message);
      playBtn.disabled = true;
    }
  });

  // Enter i input = klicka sök
  cityInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') searchBtn.click();
  });

  // Spela / Stoppa stadens ljud
  playBtn.addEventListener("click", () => {
    if (currentAudio && !currentAudio.paused) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      playBtn.textContent = "Listen";
      setStatus("Ljud stoppat.");
      return;
    }
    const city = (playBtn.dataset.city || "").toLowerCase();
    const url  = CITY_SOUND_OVERRIDES[city] || DEFAULT_CITY_AMBIENCE;
    playUrl(url);
    playBtn.textContent = "Stop";
    setStatus("Spelar ljud för " + (city || "okänd stad") + "...");
  });

  // Lås upp ljuduppspelning på första klicket
  let audioUnlocked = false;
  function unlockAudioOnce() {
    if (audioUnlocked) return;
    const s = new Audio();
    s.muted = true;
    s.play().finally(() => { audioUnlocked = true; });
  }
  document.addEventListener("click", unlockAudioOnce, { once: true });
});
