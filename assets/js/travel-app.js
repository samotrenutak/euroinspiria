// === EuroInspiria Live Map ===
// CSS kružić marker + latinica geo-search + teme u sidebaru + ćirilica transliteracija

document.addEventListener("DOMContentLoaded", () => {
  const MAPTILER_KEY = "Nf2B55v665PYbr2W3Lw1";
  const WP_API = "/wp-json/travelmap/v1/search";

  const mapContainer = document.getElementById("map");
  const sidebar = document.getElementById("sidebar");
  const status = document.getElementById("map-status");
  const searchForm = document.getElementById("geo-form");
  const searchInput = document.getElementById("geo-search");
// === Sakrij geo-suggest kada korisnik klikne van inputa ===
document.addEventListener("click", (e) => {
  const suggestBox = document.querySelector(".geo-suggest");
  const input = document.getElementById("geo-search");

  if (suggestBox && !suggestBox.contains(e.target) && e.target !== input) {
    suggestBox.classList.add("hide");
    setTimeout(() => {
      suggestBox.style.display = "none";
    }, 250);
  }
});

document.getElementById("geo-search").addEventListener("input", () => {
  const suggestBox = document.querySelector(".geo-suggest");
  if (suggestBox) {
    suggestBox.style.display = "block";
    suggestBox.classList.remove("hide");
  }
});
  const clearBtn = document.getElementById("geo-clear");

  // === Inicijalizacija mape ===
  const map = new maplibregl.Map({
    container: mapContainer,
    style: `https://api.maptiler.com/maps/basic-v2/style.json?key=${MAPTILER_KEY}`,
    center: [13, 47],
    zoom: 4.5,
    attributionControl: false,
  });
  map.addControl(new maplibregl.NavigationControl(), "bottom-right");

  // === CSS marker (uvek iste veličine) ===
  function addCssMarker(lng, lat, popupHTML) {
    const el = document.createElement("div");
    el.className = "maplibregl-marker";
    const popup = new maplibregl.Popup({ offset: 25 }).setHTML(popupHTML);
    new maplibregl.Marker(el).setLngLat([lng, lat]).setPopup(popup).addTo(map);
  }

  // === Učitavanje destinacija iz REST API-ja ===
  async function loadPostsInView(tema = "") {
    const b = map.getBounds();
    const bbox = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
    const url = `${WP_API}?bbox=${bbox.join(",")}${tema ? `&tema=${tema}` : ""}`;
    status.textContent = "Učitavam destinacije…";

    try {
      const res = await fetch(url);
      const data = await res.json();
      const features = data.features || [];

      document.querySelectorAll(".maplibregl-marker").forEach((el) => el.remove());

      features.forEach((f) => {
        const { title, link, thumb } = f.properties;
        const popupHTML = `
          <div class="popup">
            ${thumb ? `<img src="${thumb}" alt="${title}" />` : ""}
            <h3><a href="${link}">${title}</a></h3>
          </div>`;
        const [lng, lat] = f.geometry.coordinates;
        addCssMarker(lng, lat, popupHTML);
      });

      renderSidebar(
        features.map((f) => ({
          title: f.properties.title,
          link: f.properties.link,
          thumb: f.properties.thumb,
          excerpt: f.properties.excerpt,
        }))
      );

      status.textContent = `${features.length} destinacija u prikazu`;
    } catch (e) {
      console.error(e);
      status.textContent = "Greška pri učitavanju destinacija.";
    }
  }

  // === Sidebar sa filterima i gridom ===
  function renderSidebar(posts) {
    sidebar.innerHTML = "";

    const filters = ["Sve", "Plaže", "Gastro", "Arhitektura", "Budžet", "Porodica", "Priroda"];
    const filterWrap = document.createElement("div");
    filterWrap.className = "filter-bar";
    filters.forEach((f) => {
      const btn = document.createElement("button");
      btn.textContent = f;
      btn.className = "filter-btn";
      if (f === "Sve") btn.classList.add("is-active");
      btn.addEventListener("click", () => {
        document.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("is-active"));
        btn.classList.add("is-active");
        const slug = f === "Sve" ? "" : f.toLowerCase();
        loadPostsInView(slug);
      });
      filterWrap.appendChild(btn);
    });
    sidebar.appendChild(filterWrap);

    const grid = document.createElement("div");
    grid.className = "sidebar-posts";

    if (!posts.length) {
      grid.innerHTML = `<p class="empty-hint">Nema destinacija u ovom delu mape.</p>`;
    } else {
      posts.forEach((p) => {
        const el = document.createElement("article");
        el.className = "card";
        const shortExcerpt =
          p.excerpt && p.excerpt.length > 80
            ? p.excerpt.substring(0, 80) + "…"
            : p.excerpt || "";

        el.innerHTML = `
          ${p.thumb ? `<img src="${p.thumb}" alt="${p.title}">` : ""}
          <div class="card-body">
            <h3><a href="${p.link}" target="_blank">${p.title}</a></h3>
            <p>${shortExcerpt}</p>
          </div>
        `;
        grid.appendChild(el);
      });
    }
    sidebar.appendChild(grid);
  }

  map.on("load", () => {
    loadPostsInView();
    const style = document.createElement("style");
    style.textContent = `
      .maplibregl-marker {
        width: 18px;
        height: 18px;
        background: #F27F0C;
        border: 2px solid #fff;
        border-radius: 50%;
        box-shadow: 0 0 6px rgba(0,0,0,0.4);
        transform: translate(-50%, -50%);
        transition: transform .15s ease;
      }
      .maplibregl-marker:hover {
        transform: translate(-50%, -50%) scale(1.3);
        box-shadow: 0 0 8px rgba(0,0,0,0.55);
      }`;
    document.head.appendChild(style);
  });

  map.on("moveend", () => {
    clearTimeout(window._move);
    window._move = setTimeout(loadPostsInView, 300);
  });
// === GEO SEARCH (latinica + bez kvačica + sinonimi + sr-Latn results) ===
const GEO_SYNONYMS = {
  // ===== BALKAN & REGION =====
  // Srbija
  "srbija": "serbia", "srbijа": "serbia",
  "beograd": "belgrade",
  "nis": "naissus", "niš": "naissus",
  "krusevac": "krusevac", "kruševac": "krusevac",
  "pancevo": "pancevo", "pančevo": "pancevo",
  "sombor": "sombor",
  "novi pazar": "novi pazar",
  "uzice": "uzice", "užice": "uzice",
  "cacak": "cacak", "čačak": "cacak",
  "sabac": "šabac",
  "vrnjacka banja": "vrnjacka banja", "vrnjačka banja": "vrnjacka banja",
  "pristina": "pristina", "priština": "pristina",
  "pec": "peja", "peć": "peja",
  "mitrovica": "mitrovica", "kosovska mitrovica": "mitrovica",
  "đakovica": "djakovica",

  // Crna Gora
  "crna gora": "montenegro",
  "niksic": "nikšić", "nikšić": "niksic",

  // Bosna i Hercegovina
  "bosna": "bosnia and herzegovina", "bosna i hercegovina": "bosnia and herzegovina", "bih": "bosnia and herzegovina",
  "sarajevo": "sarajevo",
  "banja luka": "banja luka",
  "mostar": "mostar",
  "tuzla": "tuzla",
  "bihac": "bihac", "bihać": "bihac",
  "bijeljina": "bijeljina",
  "zenica": "zenica",
  "trebinje": "trebinje",

  // Hrvatska
  "hrvatska": "croatia",
  "zagreb": "zagreb",
  "split": "split",
  "rijeka": "rijeka",
  "osijek": "osijek",
  "zadar": "zadar",
  "pula": "pula",
  "dubrovnik": "dubrovnik",
  "varazdin": "varazdin", "varaždin": "varazdin",
  "slavonski brod": "slavonski brod",

  // Slovenija
  "slovenija": "slovenia",
  "ljubljana": "ljubljana",
  "maribor": "maribor",
  "koper": "koper", "kopar": "koper",
  "celje": "celje",

  // Severna Makedonija
  "makedonija": "north macedonia", "severna makedonija": "north macedonia",
  "skoplje": "skopje",
  "ohrid": "ohrid",
  "bitola": "bitola", "bitolj": "bitola",
  "stip": "stip", "štip": "stip",
  "prilep": "prilep",

  // Albanija
  "albanija": "albania",
  "tirana": "tirana",
  "skadar": "shkoder", "skoder": "shkoder", "shkoder": "shkoder", "shkodër": "shkoder",
  "drač": "durres", "drac": "durres", "durres": "durres",

  // Grčka
  "grcka": "greece", "grčka": "greece",
  "atina": "athens",
  "solun": "thessaloniki", "thessaloniki": "thessaloniki",
  "kavala": "kavala",
  "jerisos": "ierissos", "jerisos (ierissos)": "ierissos",
  "krit": "crete", "kritis": "crete",

  // Bugarska
  "bugarska": "bulgaria",
  "sofia": "sofia", "sofija": "sofia",
  "plovdiv": "plovdiv",
  "varna": "varna",
  "burgas": "burgas",

  // Rumunija
  "rumunija": "romania",
  "bukurest": "bucharest",
  "temisvar": "timisoara", "temišvar": "timisoara", "timisoara": "timisoara",
  "klu z": "cluj-napoca", "kluz": "cluj-napoca", "ključ": "cluj-napoca", "cluj": "cluj-napoca", "cluj-napoca": "cluj-napoca",
  "iasi": "iasi", "jaši": "iasi", "jasi": "iasi",
  "sibiu": "sibiu",

  // Mađarska
  "madjarska": "hungary", "mađarska": "hungary",
  "budimpesta": "budapest", "budapest": "budapest",
  "segedin": "szeged", "szeged": "szeged",
  "pečuj": "pecs", "pecuj": "pecs", "pecs": "pecs",
  "debrecin": "debrecen", "debrecen": "debrecen",
  "miškolc": "miskolc", "miskolc": "miskolc",

  // Austrija
  "austrija": "austria",
  "bec": "vienna", "beč": "vienna", "wien": "vienna",
  "grac": "graz", "graz": "graz",
  "salcburg": "salzburg", "salzburg": "salzburg",
  "lins": "linz", "linz": "linz",
  "insbruk": "innsbruck", "innsbruck": "innsbruck",

  // Češka
  "ceska": "czech republic", "češka": "czech republic", "ceska republika": "czech republic",
  "prag": "prague",
  "brno": "brno",
  "ostrava": "ostrava",

  // Slovačka
  "slovacka": "slovakia", "slovačka": "slovakia",
  "bratislava": "bratislava",
  "kosice": "kosice", "košice": "kosice",

  // Poljska
  "poljska": "poland",
  "varsava": "warsaw", "varšava": "warsaw", "warszawa": "warsaw",
  "krakov": "krakow", "krakow": "krakow",
  "vroclav": "wroclaw", "wroclaw": "wroclaw",
  "poznanj": "poznan", "poznan": "poznan",
  "gdansk": "gdansk",

  // Nemačka
  "nemacka": "germany", "nemačka": "germany", "deutschland": "germany", "de": "germany",
  "minhen": "munich", "minhenj": "munich", "minhjen": "munich", "munich": "munich", "munchen": "munich", "münchen": "munich",
  "keln": "cologne", "keln/koln": "cologne", "koln": "cologne", "köln": "cologne", "koeln": "cologne",
  "dizeldorf": "dusseldorf", "dyuseldorf": "dusseldorf", "düsseldorf": "dusseldorf",
  "stutgart": "stuttgart", "štutgart": "stuttgart",
  "lajpcig": "leipzig", "leipzig": "leipzig",

  // Švajcarska
  "svajcarska": "switzerland", "švajcarska": "switzerland",
  "cirih": "zurich", "zuerich": "zurich", "zürich": "zurich", "zurih": "zurich",
  "bazel": "basel", "basel": "basel",
  "zenеva": "geneva", "ženeva": "geneva", "geneva": "geneva",
  "lozana": "lausanne", "lausanne": "lausanne",
  "lucern": "lucerne", "luzern": "lucerne",

  // Francuska
  "francuska": "france",
  "pariz": "paris",
  "marselj": "marseille", "marsej": "marseille", "marseille": "marseille",
  "lion": "lyon",
  "nica": "nice", "niсa": "nice", "nice": "nice",
  "bordo": "bordeaux", "bordeaux": "bordeaux",
  "tuluz": "toulouse", "toulouse": "toulouse",
  "nantes": "nantes",

  // Italija
  "italija": "italy",
  "rim": "rome", "roma": "rome",
  "milano": "milan",
  "torino": "turin", "torin": "turin",
  "napulj": "naples", "napoli": "naples",
  "firenca": "florence", "firenze": "florence",
  "venecija": "venice", "venezia": "venice",
  "dzenova": "genoa", "đenova": "genoa", "genova": "genoa",
  "bolonja": "bologna", "bologna": "bologna",
  "trst": "trieste",

  // Španija
  "spanija": "spain", "španija": "spain", "espana": "spain", "españa": "spain",
  "madrid": "madrid",
  "barselona": "barcelona", "barcelona": "barcelona",
  "sevilja": "seville", "sevilla": "seville",
  "valensija": "valencia", "valencia": "valencia",
  "saragosa": "zaragoza", "zaragoza": "zaragoza",
  "malaga": "malaga", "malaga": "malaga",

  // Portugal
  "portugal": "portugal",
  "lisabon": "lisbon", "lisboa": "lisbon",
  "porto": "porto",
  "braga": "braga",

  // Holandija / Nizozemska
  "holandija": "netherlands", "nizozemska": "netherlands", "nederland": "netherlands",
  "amsterdam": "amsterdam",
  "roterdam": "rotterdam", "rotterdam": "rotterdam",
  "hag": "the hague", "den haag": "the hague", "s-gravenhage": "the hague",
  "ajndhoven": "eindhoven", "eindhoven": "eindhoven",
  "utreht": "utrecht", "utrecht": "utrecht",

  // Belgija
  "belgija": "belgium",
  "brisel": "brussels", "bruxelles": "brussels", "brussel": "brussels",
  "antverpen": "antwerp", "antwerpen": "antwerp",
  "gent": "ghent", "gend": "ghent", "ghent": "ghent",

  // Danska
  "danska": "denmark",
  "kopenhagen": "copenhagen", "kopenhaga": "copenhagen", "københavn": "copenhagen", "copenhagen": "copenhagen",
  "arhus": "aarhus", "århus": "aarhus", "aarhus": "aarhus",

  // Švedska
  "svedska": "sweden", "švedska": "sweden",
  "stokholm": "stockholm", "stockholm": "stockholm",
  "geteborg": "gothenburg", "göteborg": "gothenburg",
  "malme": "malmo", "malmö": "malmo",

  // Norveška
  "norveska": "norway", "norveška": "norway",
  "oslo": "oslo",
  "bergen": "bergen",
  "stavanger": "stavanger",
  "trondheim": "trondheim",

  // Finska
  "finska": "finland",
  "helsinki": "helsinki",
  "turku": "turku",
  "tampere": "tampere",

  // Island
  "island": "iceland",
  "reykjavik": "reykjavik",

  // Irska
  "irska": "ireland",
  "dablin": "dublin", "dublin": "dublin",
  "kork": "cork", "cork": "cork",

  // Ujedinjeno Kraljevstvo
  "ukin": "united kingdom", "uk": "united kingdom", "velika britanija": "united kingdom", "ujedinjeno kraljevstvo": "united kingdom",
  "engleska": "england", "skotska": "scotland", "vels": "wales", "severna irska": "northern ireland",
  "london": "london",
  "manchester": "manchester",
  "birmingham": "birmingham",
  "liverpool": "liverpool",
  "leeds": "leeds",
  "bristol": "bristol",
  "njukasl": "newcastle", "nju kasl": "newcastle", "newcastle": "newcastle",
  "edinburg": "edinburgh", "edinburgh": "edinburgh",
  "glazgov": "glasgow", "glasgow": "glasgow",
  "kardif": "cardiff", "cardiff": "cardiff",
  "belfast": "belfast",

  // Ukrajina
  "ukrajina": "ukraine",
  "kijev": "kyiv", "kijev/kijiv": "kyiv", "kyiv": "kyiv",
  "lvov": "lviv", "ljviv": "lviv", "lviv": "lviv",
  "odessa": "odesa", "odesa": "odesa",
  "harkov": "kharkiv", "kharkiv": "kharkiv",
  "dnjepar": "dnipro", "dnipar": "dnipro", "dnipro": "dnipro",

  // Belorusija
  "belorusija": "belarus", "bjelorusija": "belarus",
  "minsk": "minsk",
  "grodno": "grodno", "hrodna": "grodno",

  // Baltik
  "litvanija": "lithuania", "letonija": "latvia", "estonija": "estonia",
  "vilnjus": "vilnius", "vilnius": "vilnius",
  "riga": "riga",
  "talin": "tallinn", "tallinn": "tallinn",

  // Turska (evropski deo + ključni gradovi)
  "turska": "turkey",
  "istanbul": "istanbul",
  "jedrene": "edirne", "edirne": "edirne",
  "tekirdag": "tekirdag", "tekirdağ": "tekirdag",

  // Rusija (evropski deo)
  "rusija": "russia",
  "moskva": "moscow",
  "peterburg": "saint petersburg", "sankt peterburg": "saint petersburg",
  "nižni novgorod": "nizhny novgorod", "nizni novgorod": "nizhny novgorod", "nizhny novgorod": "nizhny novgorod",
  "rostov na donu": "rostov-on-don", "rostov-na-donu": "rostov-on-don",
};

const cyrToLat = (s = "") => {
  const map = {
    Љ:"Lj", Њ:"Nj", Џ:"Dž", Ђ:"Dj", Ћ:"C", Ж:"Z", Ч:"C", Ш:"S",
    љ:"lj", њ:"nj", џ:"dz", ђ:"dj", ћ:"c", ж:"z", ч:"c", ш:"s",
  };
  return s.replace(/[\u0400-\u04FF]/g, ch => map[ch] ?? ch);
};

const stripDiacritics = (s="") =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g,"")
   .replace(/đ/g,"dj").replace(/Đ/g,"Dj")
   .replace(/č/g,"c").replace(/ć/g,"c").replace(/š/g,"s").replace(/ž/g,"z");

async function geocodeSmart(qRaw) {
  if (!qRaw) return [];

  let term = cyrToLat(stripDiacritics(qRaw.toLowerCase()));
  const syn = GEO_SYNONYMS[term] || GEO_SYNONYMS[qRaw.toLowerCase()];
  // ako postoji sinonim, koristi njega kao prvi upit
  const queries = [syn || term, term, qRaw].filter(Boolean);

  for (const q of queries) {
    const urls = [
      `https://api.maptiler.com/geocoding/${encodeURIComponent(q)}.json?key=${MAPTILER_KEY}&language=en`,
      `https://api.maptiler.com/geocoding/${encodeURIComponent(q)}.json?key=${MAPTILER_KEY}&language=sr-Latn`
    ];
    for (const url of urls) {
      try {
        const r = await fetch(url);
        if (!r.ok) continue;
        const j = await r.json();
        if (j.features?.length) return j.features;
      } catch (err) {
        console.warn("Greška geocode:", err);
      }
    }
  }
  return [];
}

// === Geo suggest dropdown ===
// === Geo suggest dropdown (popravljen prikaz) ===
const drop = document.createElement("div");
drop.className = "geo-suggest hidden";
drop.innerHTML = "<ul></ul>";
searchForm.parentElement.appendChild(drop); // pomeri van forme, ispod nje
const list = drop.querySelector("ul");

const debounce = (fn, ms = 250) => {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
};

let cached = [];
const renderSuggestions = (features) => {
  console.log("Sugestije:", features);
  if (!features.length) {
    list.innerHTML = "";
    drop.classList.add("hidden");
    return;
  }
  list.innerHTML = features
    .map(
      (f, i) => `
      <li data-idx="${i}">
        <span class="gs-title">${stripDiacritics(cyrToLat(f.text || ""))}</span>
        <span class="gs-sub">${stripDiacritics(cyrToLat(f.place_name || ""))}</span>
      </li>`
    )
    .join("");
  drop.classList.remove("hidden");

  // pozicioniraj ispod inputa
  const rect = searchInput.getBoundingClientRect();
  drop.style.position = "absolute";
  drop.style.top = rect.bottom + window.scrollY + "px";
  drop.style.left = rect.left + "px";
  drop.style.width = rect.width + "px";
};

const onInput = debounce(async () => {
  const q = searchInput.value.trim();
  if (!q) {
    list.innerHTML = "";
    drop.classList.add("hidden");
    return;
  }
  cached = await geocodeSmart(q);
  renderSuggestions(cached);
});
searchInput.addEventListener("input", onInput);
searchInput.addEventListener("focus", () => {
  if (list.children.length) drop.classList.remove("hidden");
});

list.addEventListener("click", (e) => {
  const li = e.target.closest("li[data-idx]");
  if (!li) return;
  const f = cached[parseInt(li.dataset.idx)];
  const [lng, lat] = f.center;
  map.flyTo({ center: [lng, lat], zoom: 9 });
  drop.classList.add("hidden");
  status.textContent = `Prikazujem rezultate za: ${f.place_name}`;
});

  clearBtn.addEventListener("click", () => {
    searchInput.value = "";
    drop.classList.add("hidden");
    status.textContent = "Prikaz svih destinacija";
    loadPostsInView();
  });

  document.addEventListener("click", (e) => {
    if (!drop.contains(e.target) && !searchForm.contains(e.target))
      drop.classList.add("hidden");
  });
});
