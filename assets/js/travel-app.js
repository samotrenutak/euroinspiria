// === Live mapa sa MapTiler geocoderom i WP destinacijama ===
// Autor: Nikola & ChatGPT
// Verzija: 1.9-stable — CSS kružić + geo-suggest sr/en/latinica + sinonimi

document.addEventListener("DOMContentLoaded", () => {
  const MAPTILER_KEY = "Nf2B55v665PYbr2W3Lw1";
  const WP_API = "/wp-json/travel/v1/search";

  const mapContainer = document.getElementById("map");
  const sidebar = document.getElementById("sidebar");
  const searchForm = document.getElementById("geo-form");
  const searchInput = document.getElementById("geo-search");
  const clearBtn = document.getElementById("geo-clear");
  const status = document.getElementById("map-status");

  // === Inicijalna mapa ===
  const map = new maplibregl.Map({
    container: mapContainer,
    style: `https://api.maptiler.com/maps/basic-v2/style.json?key=${MAPTILER_KEY}`,
    center: [12, 47],
    zoom: 4,
    attributionControl: false,
  });
  window.map = map;

  map.addControl(new maplibregl.NavigationControl(), "bottom-right");
  map.addControl(
    new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
      showUserHeading: true,
    })
  );

  // === Source i slojevi ===
  map.on("load", () => {
    map.addSource("destinations", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
      cluster: true,
      clusterRadius: 50,
    });

    map.addLayer({
      id: "clusters",
      type: "circle",
      source: "destinations",
      filter: ["has", "point_count"],
      paint: {
        "circle-color": [
          "step",
          ["get", "point_count"],
          "#F9A825",
          10,
          "#FB8C00",
          30,
          "#F27F0C",
        ],
        "circle-radius": ["step", ["get", "point_count"], 15, 10, 20, 30, 25],
      },
    });

    map.addLayer({
      id: "cluster-count",
      type: "symbol",
      source: "destinations",
      filter: ["has", "point_count"],
      layout: {
        "text-field": ["get", "point_count_abbreviated"],
        "text-size": 12,
      },
      paint: { "text-color": "#fff" },
    });

    // === CSS kružić marker — uvek iste veličine ===
    map.addLayer({
      id: "unclustered-point",
      type: "circle",
      source: "destinations",
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-radius": 8,
        "circle-color": "#F27F0C",
        "circle-stroke-color": "#fff",
        "circle-stroke-width": 2,
        "circle-opacity": 0.95,
        "circle-blur": 0.2,
        "circle-pitch-scale": "viewport",
      },
    });

    map.on("click", "unclustered-point", (e) => {
      const f = e.features[0];
      const { title, link, thumb } = f.properties;
      new maplibregl.Popup()
        .setLngLat(f.geometry.coordinates)
        .setHTML(
          `<div class="popup">
            ${thumb ? `<img src="${thumb}" alt="${title}" />` : ""}
            <h3><a href="${link}">${title}</a></h3>
          </div>`
        )
        .addTo(map);
    });

    loadPostsInView();
  });

  // === REST API ===
  async function loadPostsInView() {
    const b = map.getBounds();
    const bbox = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
    const url = `${WP_API}?bbox=${bbox.join(",")}`;
    status.textContent = "Učitavam destinacije…";

    try {
      const res = await fetch(url);
      const data = await res.json();
      const features = data.features || [];

      map.getSource("destinations").setData({
        type: "FeatureCollection",
        features,
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

  function renderSidebar(posts) {
    sidebar.innerHTML = "";
    if (!posts.length) {
      sidebar.innerHTML = `<p class="empty-hint">Nema destinacija u ovom delu mape.</p>`;
      return;
    }
    posts.forEach((p) => {
      const el = document.createElement("article");
      el.className = "card";
      el.innerHTML = `
        ${p.thumb ? `<img src="${p.thumb}" alt="">` : ""}
        <h3><a href="${p.link}">${p.title}</a></h3>
        <p>${p.excerpt}</p>
      `;
      sidebar.appendChild(el);
    });
  }

  map.on("moveend", () => {
    clearTimeout(window._moveT);
    window._moveT = setTimeout(loadPostsInView, 300);
  });

  // === GEOCODER (sr/en, latinica, sinonimi) ===
  const GEO_SYNONYMS = {
    "bec": "vienna",
    "beč": "vienna",
    "srbija": "serbia",
    "grcka": "greece",
    "grčka": "greece",
    "madjarska": "hungary",
    "mađarska": "hungary",
    "nemacka": "germany",
    "nemačka": "germany",
    "italija": "italy",
    "spanija": "spain",
    "španija": "spain",
  };

  function cyrToLat(s = "") {
    const map = {
      Љ: "Lj", Њ: "Nj", Џ: "Dž", Ђ: "Đ", Ћ: "Ć", Ж: "Ž", Ч: "Č", Ш: "Š",
      љ: "lj", њ: "nj", џ: "dž", ђ: "đ", ћ: "ć", ж: "ž", ч: "č", ш: "š",
      А: "A", Б: "B", В: "V", Г: "G", Д: "D", Е: "E", З: "Z", И: "I",
      Ј: "J", К: "K", Л: "L", М: "M", Н: "N", О: "O", П: "P", Р: "R",
      С: "S", Т: "T", У: "U", Ф: "F", Х: "H", Ц: "C",
      а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", з: "z", и: "i",
      ј: "j", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
      с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c",
    };
    return s.replace(/[\u0400-\u04FF]/g, (ch) => map[ch] ?? ch);
  }

  function stripDiacritics(str) {
    return str
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "dj")
      .replace(/Đ/g, "Dj");
  }

  async function geocodeSmart(q) {
    let term = cyrToLat(stripDiacritics(q.toLowerCase()));
    const syn = GEO_SYNONYMS[term] || GEO_SYNONYMS[q.toLowerCase()];
    const variants = [term, syn, q].filter(Boolean);
    for (const v of variants) {
      const url = `https://api.maptiler.com/geocoding/${encodeURIComponent(
        v
      )}.json?key=${MAPTILER_KEY}&limit=8&fuzzyMatch=true&language=sr,en,de`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.features?.length) return data.features;
      }
    }
    return [];
  }

  // === GEO-SUGGEST (live search dropdown) ===
  const drop = document.createElement("div");
  drop.className = "geo-suggest hidden";
  drop.innerHTML = "<ul></ul>";
  searchForm.appendChild(drop);
  const list = drop.querySelector("ul");

  const debounce = (fn, ms = 250) => {
    let t;
    return (...a) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...a), ms);
    };
  };

  let cached = [];
  let current = -1;

  const renderSuggestions = (features) => {
    if (!features.length) {
      list.innerHTML = "";
      drop.classList.add("hidden");
      return;
    }
    list.innerHTML = features
      .map(
        (f, i) => `
        <li data-idx="${i}">
          <span class="gs-main">
            <span class="gs-title">${f.text || f.place_name}</span>
            <span class="gs-sub">${f.place_name}</span>
          </span>
        </li>`
      )
      .join("");
    drop.classList.remove("hidden");
  };

  const onInput = debounce(async () => {
    const q = searchInput.value.trim();
    if (!q) {
      list.innerHTML = "";
      drop.classList.add("hidden");
      return;
    }
    cached = await geocodeSmart(q);
    current = -1;
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

  document.addEventListener("click", (e) => {
    if (!drop.contains(e.target) && !searchForm.contains(e.target))
      drop.classList.add("hidden");
  });

  clearBtn.addEventListener("click", () => {
    searchInput.value = "";
    drop.classList.add("hidden");
    status.textContent = "Prikaz svih destinacija";
    loadPostsInView();
  });
});
