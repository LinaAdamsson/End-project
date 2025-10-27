// =====================================
// Abstract Muse – enkel generator-app
// =====================================

// 1) API-URL (vi hämtar titlar/ämnen från AIC för att få “konstiga” ord att leka med)
const API_URL =
  'https://api.artic.edu/api/v1/artworks' +
  '?fields=title,artist_title,style_title,subject_titles,medium_display' +
  '&limit=100&page=1';

// 2) Enkla “egna” ordlistor som komplement om API:t skulle sakna bra ord
const FALLBACK_ADJECTIVES = [
  'Silent','Crimson','Nocturnal','Electric','Feral','Opaline','Fractured','Tender',
  'Ethereal','Velvet','Echoing','Iridescent','Harmonic','Lonely','Celestial','Obscure'
];

const FALLBACK_NOUNS = [
  'Geometry','Horizon','Memory','Silence','Gravity','Chimera','Spectra','Nebula',
  'Signal','Pulse','Garden','Atlas','Orbit','Echoes','Relic','Mirage'
];

const FALLBACK_MOTIFS = [
  'of Silence','of Dust','of Glass','in Blue','in Transit','for a Distant City',
  'for the Moon','in Winter','for the Last Light','for Yesterday'
];

// 3) “Tillstånd”: ordpooler från API + UI-referenser
let poolAdjectives = [];
let poolNouns = [];
let poolMotifs = [];

const inspireBtn   = document.getElementById('inspireBtn');
const useApiToggle = document.getElementById('useApiToggle');
const countSelect  = document.getElementById('countSelect');
const statusEl     = document.getElementById('status');
const currentTitle = document.getElementById('currentTitle');
const subtitleEl   = document.getElementById('subtitle');
const listEl       = document.getElementById('list');

// 4) Hjälpfunktion: plocka ett slumpat element ur en lista
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// 5) Enkel ordstädning: plocka ut lovande ord ur strängar
function extractWords(str = '') {
  // Dela på icke-bokstäver, filtrera bort korta/frekventa ord
  const STOP = new Set(['the','and','of','for','in','on','with','without','no','untitled']);
  return str
    .toLowerCase()
    .split(/[^a-zà-öčšžäöåéüñ]+/i)
    .filter(w => w && w.length >= 3 && !STOP.has(w));
}

// 6) Ladda ord från API och bygg pooler
async function loadMuseumWords() {
  try {
    setStatus('Hämtar museiord…');
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error('API-svar ej OK');
    const json = await res.json();

    const titles   = json.data.map(d => d.title).filter(Boolean);
    const styles   = json.data.map(d => d.style_title).filter(Boolean);
    const mediums  = json.data.map(d => d.medium_display).filter(Boolean);
    const subjects = json.data.flatMap(d => d.subject_titles || []);

    // Bygg ordlistor (mycket enkelt – det här är “lekfullt”, inte språkteknik)
    const fromTitles   = titles.flatMap(extractWords);
    const fromStyles   = styles.flatMap(extractWords);
    const fromMediums  = mediums.flatMap(extractWords);
    const fromSubjects = subjects.flatMap(extractWords);

    // “Adjektiv” – vi låtsas att en del stil/medium-ord fungerar som beskrivare
    poolAdjectives = unique([
      ...fromStyles, ...fromMediums, ...FALLBACK_ADJECTIVES
    ]).map(capitalize);

    // “Namnord” – titlar + ämnen ger bra substantiv/stämningsord
    poolNouns = unique([
      ...fromTitles, ...fromSubjects, ...FALLBACK_NOUNS
    ]).map(capitalize);

    // “Motiv-slut” – små fraser som kan läggas efter
    poolMotifs = unique([
      ...FALLBACK_MOTIFS,
      // “of …” från museiord (tar några slumpade)
      ...randomSample(poolNouns, 10).map(n => `of ${n}`)
    ]);

    setStatus('Klart! (du kan slå av/på “museiord” med reglaget)');
  } catch (err) {
    console.error(err);
    setStatus('Kunde inte hämta museidata – faller tillbaka på interna ordlistor.');
    // Falla tillbaka helt på våra fallback-ord
    poolAdjectives = FALLBACK_ADJECTIVES;
    poolNouns      = FALLBACK_NOUNS;
    poolMotifs     = FALLBACK_MOTIFS;
  }
}

// 7) Hjälp: unika ord + enkel “prover”
function unique(arr) { return [...new Set(arr)]; }
function randomSample(arr, n) {
  const copy = [...arr];
  const out = [];
  while (copy.length && out.length < n) {
    out.push(copy.splice(Math.floor(Math.random()*copy.length), 1)[0]);
  }
  return out;
}
function capitalize(w='') { return w.charAt(0).toUpperCase() + w.slice(1); }

// 8) Generator: skapa en titel enligt några enkla mallar
function makeTitle() {
  // Välj källor: antingen API-pooler (om de finns och toggle är på) eller fallback
  const useApi = useApiToggle.checked;
  const A = (useApi && poolAdjectives.length ? poolAdjectives : FALLBACK_ADJECTIVES);
  const N = (useApi && poolNouns.length      ? poolNouns      : FALLBACK_NOUNS);
  const M = (useApi && poolMotifs.length     ? poolMotifs     : FALLBACK_MOTIFS);

  // Några enkla titelmönster
  const templates = [
    () => `${pick(A)} ${pick(N)}`,
    () => `${pick(A)} ${pick(N)} No. ${Math.floor(Math.random()*90)+10}`,
    () => `Echoes of ${pick(N)}`,
    () => `${pick(N)} ${pick(M)}`,
    () => `${pick(A)} Studies ${pick(M)}`
  ];
  return pick(templates)();
}

// 9) “Utställning”: skapa flera titlar
function makeExhibition(count=3) {
  return Array.from({length: count}, () => makeTitle());
}

// 10) UI: visa resultat i DOM
function render(titles) {
  const [first, ...rest] = titles;
  currentTitle.textContent = first || '—';
  subtitleEl.textContent = first ? 'Genererad titel' : 'Tryck på knappen för att skapa en titel.';

  listEl.innerHTML = '';
  rest.forEach(t => {
    const li = document.createElement('li');
    li.textContent = t;
    listEl.appendChild(li);
  });
}

// 11) Statusrad
function setStatus(msg) {
  statusEl.textContent = msg || '';
}

// 12) Event: klick på knappen → generera + rendera
inspireBtn.addEventListener('click', () => {
  const n = parseInt(countSelect.value, 10) || 3;
  const titles = makeExhibition(n);
  render(titles);
  // Spara användarval (valfritt “persist”)
  localStorage.setItem('abstractMuse:useApi', String(useApiToggle.checked));
  localStorage.setItem('abstractMuse:count', String(n));
});

// 13) Init: ladda API-ord + återställ sparade val
(async function init(){
  // Läs sparat läge (frivilligt)
  const savedUseApi = localStorage.getItem('abstractMuse:useApi');
  const savedCount  = localStorage.getItem('abstractMuse:count');
  if (savedUseApi !== null) useApiToggle.checked = (savedUseApi === 'true');
  if (savedCount) countSelect.value = savedCount;

  // Hämta museiord (uppfyller kravet: “Read data from an API (GET)” + fetch + JSON)
  await loadMuseumWords();

  // Skapa en första omgång automatiskt
  const n = parseInt(countSelect.value, 10) || 3;
  render(makeExhibition(n));
})();
