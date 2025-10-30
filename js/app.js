// Först i filen ligger projektets alla DOM-element.
const cityInput = document.getElementById('cityInput');
const searchBtn = document.getElementById('searchBtn');
const playBtn = document.getElementById('playBtn');
const statusEl = document.getElementById('status');
const logoEl = document.getElementById('logo');

// Här skapar jag en variabel för Leaflet-kartan. Jag har ställt in den så att fokus i startläge ligger på Centraleuropa.
//  Leaflet är ett JS-bibliotek
const map = L.map('map').setView([35.0, 13.0], 3);

// Här hämtar jag en serie kartbilder (tiles) från Stadia Maps API, jag använder “Stamen Watercolor”-stilen.
L.tileLayer(
  `https://tiles-eu.stadiamaps.com/tiles/stamen_watercolor/{z}/{x}/{y}.jpg?api_key=${STADIA_API_KEY}`, // Min API-nyckel
  // ligger i js/config.js. som i sin tur ligger i .gitignore (så att den inte hamnar på GitHub). Stadia Maps är en
  // API-tjänst, men hämtningen av tiles/anropet sker genom Leaflet så detta är inte en fetch().
  {
    maxZoom: 16, // Här begränsas zoomnivån till 16, mer än så ledde till buggar.
    attribution: '© Stadia Maps © Stamen Design © OpenStreetMap' // Här anges källan.
  }
).addTo(map);

// Här är två variabler som lagrar nuvarande kartmarkör och ljuduppspelning på sidan, hur det ser ut och låter just nu.
let marker = null; // marker används för att hålla koll på den aktuella markören på kartan. När användaren söker
// efter en ny stad tas den gamla bort innan en ny placeras ut. Om marker = null betyder det att ingen markör finns än.
let currentAudio = null; // currentAudio håller referensen till det ljud som spelas just nu (Audio-objekt), så att
// man kan pausa eller byta ljud utan att flera ljud spelas samtidigt. Om currentAudio = null betyder det att inget
// ljud är aktivt just nu.

// Här skapar jag stadsljud. För nu kan endast tre stadsljud spelas upp, vid en vidareutveckling skulle ett API användas
// här med ljuddata för varje plats i världen.
const CITY_SOUND_OVERRIDES = {
  "barcelona": "https://cdn.freesound.org/previews/672/672830_11891749-lq.mp3",
  "marstrand": "https://cdn.freesound.org/previews/638/638157_2061858-lq.mp3",
  "salta": "https://cdn.freesound.org/previews/794/794556_11563061-lq.mp3"
};

// Här ligger ljudeffekter som aktiveras när man klickar på sökknappen.
const INTRO_SOUND = "https://cdn.freesound.org/previews/826/826386_15636277-lq.mp3"; // Först hörs piloten
// förbereda för takeoff.
const ARRIVAL_SOUND = "https://cdn.freesound.org/previews/401/401157_7650299-lq.mp3";  // Parallellt med att
// kartan zoomar in på vald plats hörs ett flygplansljud.

// Här är en funktion för att visa statusmeddelanden för användaren. Även om inga sådana meddelanden visas just nu är
// den kvar för tydlighet och framtida utveckling.
function setStatus(msg = "") {
  statusEl.textContent = msg;
}

// Här skapar jag en funktion som spelar upp ett ljud och resolvar först när det spelats klart, funktionen väntar in att
// ljudet spelats färdigt innan den går vidare i koden – flygplanet lyfter inte förrän piloten tystnat.
function playAndWait(url) {
  return new Promise((resolve) => { // Det görs här med en promise, och när ljudet tar slut körs resolve()
    // vilket säger att den här asynkrona uppgiften (ljudet) är klar.
    if (currentAudio) currentAudio.pause(); // Här pausas pågående ljud om något annat ljud redan spelas.
    // Eftersom mina ljud hämtas från en annan server skapar jag här en funktion som gör att ljuden låter bra.
    const a = new Audio(url); // Skapar ett nytt ljudobjekt i JS.
    a.crossOrigin = "anonymous"; // Här säger jag åt funktionen att jag tillåter att ljud hämtas från en annan domän.
    // Gör så att ljudet inte blockeras.
    currentAudio = a; // Här sparas en referens till ljudet så att man kan stoppa, pausa osv. Gör att endast ett ljud
    // spelas upp åt gången.
    a.volume = 0.7; // Sätter en bra uppspelningsvolym.
    a.play().catch(() => setStatus()); // Här fångas fel upp mha .catch, tex om webbläsaren inte vill spela upp
    // ett ljud, om användaren inte klickat igång ljudet ännu osv. Här kan ett felmeddelande skrivas in.
    a.addEventListener("ended", resolve); // Här säger jag att när ett ljud spelats klart ska funktionen resolve()
    // köras, vilket "fullföljer" vår promise och resten av koden (som väntade genom "await") får fortsätta.
  });
}

function playSound(url, volume = 0.7) { // Den här funktionen tar emot ett ljud från en url.
  if (currentAudio) currentAudio.pause(); // Här pausas ett ev. pågående ljud så att endast ett ljud körs åt gången.
  const a = new Audio(url); // Här skapas ett nytt ljudobjekt utifrån den url-ljudfil som skickats in.
  a.crossOrigin = "anonymous";
  a.volume = volume;
  currentAudio = a;
  a.play().catch(() => {
    setStatus();
  });
}

async function geocodeCity(city) { // Här skapar jag en funktion som hämtar stadskoordinater.
  const url = new URL('https://nominatim.openstreetmap.org/search'); // En url till det öppna Nominatim-API.t.
  // Här lägger jag till sökparametrarna stadens namn, format och max antal resultat.
  url.searchParams.set('q', city); // q = själva sökfrågan/stadsnamnet.
  url.searchParams.set('format', 'json'); // Här ber jag att få svaret som JSON-data.
  url.searchParams.set('limit', '1'); // Här säger jag att jag bara vill ha det första (bästa) resultatet.
  const res = await fetch(url.toString(), { // Här skickar jag förfrågan till API:t med fetch().
    headers: { 'User-Agent': 'AudioAtlas/1.0 (student project)' } // I headern anger jag typ av projekt/avsändare.
  });
  if (!res.ok) {
    throw new Error('Geokodning misslyckades (nätverk eller API).'); // Om något gick fel kastas ett felmeddelande.
  }
  const data = await res.json(); // Här omvandlar jag svaret från API:t (som är i textformat) till JSON (JS-objekt).
  if (!data.length) {
    throw new Error('Hittade ingen plats med det namnet.'); // Om inga resultat hittas eller en stad stavats fel kastas
    // ett fel.
  }
  const { lat, lon, display_name } = data[0]; // Här filtreras koordinater och stadsnamn ur datan.
  return { lat: parseFloat(lat), lon: parseFloat(lon), name: display_name }; // Och här returneras ett objekt med detta.
}

// Här skapar jag en funktion som flyttar oss/kartan till den sökta platsen och placerar ut en markör:
function focusCityOnMap({ lat, lon, name }) { // Här bestäms platsen man ska "resa" till.
  map.flyTo([lat, lon], 11, { duration: 5 }); // Här påverkar jag inzoomningen mot den sökta platsen. 11 styr vilket
  // avstånd från kartmarkören inzoomingen ska stanna på och 5 styr vilket tempo inzoomingen ska ske i.
  if (marker) marker.remove(); // Här tas ev markör bort, om man sökt upp en stad och sen söker på en annan.
  // Här läggs en ny markör till och en popup med stadens namn öppnas:
  marker = L.marker([lat, lon])
    .addTo(map)
    .bindPopup(`<b>${name}</b>`)
    .openPopup();
  const typed = (cityInput.value || "").trim().toLowerCase(); // cityInput.value hämtar vad användaren skriver i
  // sökfältet. trim() tar bort onödiga mellanslag och .toLowerCase() gör allt till små bokstäver (förenklar jämförelse).
  playBtn.dataset.city = typed || name.toLowerCase(); // Här sparas stadens namn på “Listen”-knappen.
  playBtn.disabled = false; // Här aktiveras “Listen”-knappen, som från början är avstängd (disabled).
}

// Här beskriver jag vad som händer när man klickar på sökknappen "Let's go":
searchBtn.addEventListener('click', async () => {
  const city = cityInput.value.trim();
  if (!city) { setStatus("Skriv in en stad först."); return; } // Om användaren inte har skrivit något i fältet ska
  // ett meddelande visas och resten av funktionen avbrytas.
  try {
    setStatus(); // Här rensas ev tidigare status.
    await playAndWait(INTRO_SOUND); // Spelar introljud och vänta tills det är klart.
    setStatus("Söker stad...");
    const result = await geocodeCity(city);  // Här hämtas platsdata/koordinater från API (se rad 91) mha fetch().
    focusCityOnMap(result); // Visar sökresultatet/staden på kartan dvs flyger till platsen och markerar den.
    playSound(ARRIVAL_SOUND, 0.8); // Spelar flygplansljudet när inzoomningen sker.
    logoEl.classList.add('in-header'); // Här säger jag att loggan ska flyttas till headerns hörn när sökandet påbörjas.
    setStatus();
  } catch (err) {
    setStatus("Fel: " + err.message);
    playBtn.disabled = true;
  }
});

playBtn.addEventListener("click", () => { // "Listen"-knappen växlar mellan att spela och stoppa
  // stadens ljud.
  if (currentAudio && !currentAudio.paused) { // Här kontrolleras om det redan finns ett ljud som spelas just nu.
    // currentAudio är ljudet som sparats senast, och .paused kollar om det är pausat eller inte.
    currentAudio.pause(); // Om ett ljud redan spelas upp ska det stoppas.
    currentAudio.currentTime = 0; // Spolar tillbaka ljudet till början.
    playBtn.textContent = "Listen"; // Ändrar texten på knappen tillbaka till "Listen".
    setStatus();
    return;
  }
  // Slå upp stadens ljud (spela bara om det finns – annars gör vi inget alls)
  const city = (playBtn.dataset.city || "").toLowerCase(); // playBtn.dataset.city hämtar namnet på staden som
  // senast söktes (sparas tidigare i focusCityOnMap()).
  const url  = CITY_SOUND_OVERRIDES[city]; // CITY_SOUND_OVERRIDES[city] letar i objektet/kollar i listan om det finns
  // ett ljud till staden.
  if (!url) { // Om ingen stad från listan matchar sökningen ska inget hända.
    return;
  }
  playSound(url); // Spelar upp ljudet för den valda staden.
  playBtn.textContent = "Stop sound"; // Ändrar texten på knappen till "Stop sound" så användaren kan stänga av ljudet.
  setStatus();
});

// Vissa webbläsare tillåter inte ljud förrän användaren klickat någonstans. Den här funktionen låser upp
// ljuduppspelning vid första klicket på sidan.
document.addEventListener("click", () => {
  const s = new Audio(); // Skapar ett nytt, tomt ljudobjekt.
  s.muted = true; // Ser till att det är ljudlöst.
  s.play().catch(()=>{}); // Försöker spela upp ljudet – och om det misslyckas ignoreras felet.
}, { once: true }); // Körs bara en gång, efter första klicket.
