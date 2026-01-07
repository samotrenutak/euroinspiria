document.addEventListener("DOMContentLoaded", () => {

  const MAPTILER_KEY = "Nf2B55v665PYbr2W3Lw1";
  const WP_API = "/wp-json/travelmap/v1/search";

  const mapContainer = document.getElementById("map");
  const sidebar = document.getElementById("sidebar");
  const status = document.getElementById("map-status");
  const searchForm = document.getElementById("geo-form");
  const searchInput = document.getElementById("geo-search");
  const clearBtn = document.getElementById("geo-clear");

  /* ================= MAP INIT ================= */

  const map = new maplibregl.Map({
    container: mapContainer,
    style: `https://api.maptiler.com/maps/basic-v2/style.json?key=${MAPTILER_KEY}`,
    center: [13, 47],
    zoom: 4.5,
    maxZoom: 15,
    attributionControl: false,
  });

  map.addControl(new maplibregl.NavigationControl(), "bottom-right");

  /* ================= GEOJSON SOURCE + CLUSTER ================= */

  map.on("load", () => {

    map.addSource("destinations", {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: []
      },
      cluster: true,
      clusterMaxZoom: 10,
      clusterRadius: 50
    });

    /* === CLUSTERS === */
    map.addLayer({
      id: "clusters",
      type: "circle",
      source: "destinations",
      filter: ["has", "point_count"],
      paint: {
        "circle-color": "#F27F0C",
        "circle-radius": [
          "step",
          ["get", "point_count"],
          18,
          10, 24,
          30, 30
        ],
        "circle-stroke-width": 2,
        "circle-stroke-color": "#fff"
      }
    });

    /* === CLUSTER COUNT === */
    map.addLayer({
      id: "cluster-count",
      type: "symbol",
      source: "destinations",
      filter: ["has", "point_count"],
      layout: {
        "text-field": "{point_count_abbreviated}",
        "text-font": ["Open Sans Bold"],
        "text-size": 12
      },
      paint: {
        "text-color": "#fff"
      }
    });

    /* === SINGLE PIN === */
    map.addLayer({
      id: "unclustered-point",
      type: "circle",
      source: "destinations",
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-color": "#F27F0C",
        "circle-radius": 8,
        "circle-stroke-width": 2,
        "circle-stroke-color": "#fff"
      }
    });

    loadPosts();
  });

  /* ================= INTERACTIONS ================= */

  map.on("click", "clusters", (e) => {
    const features = map.queryRenderedFeatures(e.point, { layers: ["clusters"] });
    const clusterId = features[0].properties.cluster_id;

    map.getSource("destinations").getClusterExpansionZoom(
      clusterId,
      (err, zoom) => {
        if (err) return;
        map.easeTo({
          center: features[0].geometry.coordinates,
          zoom
        });
      }
    );
  });

  map.on("click", "unclustered-point", (e) => {
    const f = e.features[0];
    const { title, link, thumb } = f.properties;

    new maplibregl.Popup({ offset: 15 })
      .setLngLat(f.geometry.coordinates)
      .setHTML(`
        <div class="popup">
          ${thumb ? `<img src="${thumb}" alt="${title}">` : ""}
          <h3><a href="${link}" target="_blank">${title}</a></h3>
        </div>
      `)
      .addTo(map);
  });

  map.on("mouseenter", "clusters", () => map.getCanvas().style.cursor = "pointer");
  map.on("mouseleave", "clusters", () => map.getCanvas().style.cursor = "");
  map.on("mouseenter", "unclustered-point", () => map.getCanvas().style.cursor = "pointer");
  map.on("mouseleave", "unclustered-point", () => map.getCanvas().style.cursor = "");
  map.on("moveend", () => {
  filterPostsByMapView();
});

  /* ================= DATA LOAD ================= */

async function loadPosts(tema = "") {
  status.textContent = "Učitavam destinacije…";

  try {
    const res = await fetch(`${WP_API}${tema ? `?tema=${tema}` : ""}`);
    const data = await res.json();

    const features = data.features || [];
    window._allFeatures = features;

    const geojson = {
      type: "FeatureCollection",
      features: features.map(f => ({
        type: "Feature",
        geometry: f.geometry,
        properties: f.properties
      }))
    };

    map.getSource("destinations")?.setData(geojson);

    // ⬅️ inicijalno filtriranje po mapi
    filterPostsByMapView();

  } catch (err) {
    console.error(err);
    status.textContent = "Greška pri učitavanju.";
  }
}

      map.getSource("destinations")?.setData(geojson);

function filterPostsByMapView() {
  if (!window._allFeatures) return;

  const b = map.getBounds();

  const visible = window._allFeatures.filter(f => {
    const [lng, lat] = f.geometry.coordinates;
    return (
      lng >= b.getWest() &&
      lng <= b.getEast() &&
      lat >= b.getSouth() &&
      lat <= b.getNorth()
    );
  });

  renderSidebar(visible.map(f => f.properties));

  status.textContent = visible.length
    ? `${visible.length} destinacija u prikazu`
    : "Nema destinacija u ovom delu mape.";
}

  /* ================= SIDEBAR ================= */

  function renderSidebar(posts) {
    sidebar.innerHTML = "";

    const filters = ["Sve", "Plaže", "Gastro", "Arhitektura", "Budžet", "Porodica", "Priroda"];
    const filterWrap = document.createElement("div");
    filterWrap.className = "filter-bar";

    filters.forEach(f => {
      const btn = document.createElement("button");
      btn.textContent = f;
      btn.className = "filter-btn";
      if (f === "Sve") btn.classList.add("is-active");

      btn.onclick = () => {
        document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("is-active"));
        btn.classList.add("is-active");
        loadPosts(f === "Sve" ? "" : f.toLowerCase());
      };

      filterWrap.appendChild(btn);
    });

    sidebar.appendChild(filterWrap);

    const grid = document.createElement("div");
    grid.className = "sidebar-posts";

    if (!posts.length) {
      grid.innerHTML = `<p class="empty-hint">Nema destinacija.</p>`;
    } else {
      posts.forEach(p => {
        const el = document.createElement("article");
        el.className = "card";
        el.innerHTML = `
          ${p.thumb ? `<img src="${p.thumb}">` : ""}
          <div class="card-body">
            <h3><a href="${p.link}" target="_blank">${p.title}</a></h3>
            <p>${p.excerpt ? p.excerpt.substring(0, 80) + "…" : ""}</p>
          </div>
        `;
        grid.appendChild(el);
      });
    }

    sidebar.appendChild(grid);
  }

  /* ================= GEO SEARCH (SMART) ================= */

  const debounce = (fn, ms = 250) => {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  };

  async function geocode(q) {
    const url = `https://api.maptiler.com/geocoding/${encodeURIComponent(q)}.json?key=${MAPTILER_KEY}&language=sr-Latn`;
    const r = await fetch(url);
    const j = await r.json();
    return j.features || [];
  }

  const drop = document.createElement("div");
  drop.className = "geo-suggest hidden";
  drop.innerHTML = "<ul></ul>";
  searchForm.parentElement.appendChild(drop);
  const list = drop.querySelector("ul");

  let cached = [];

  const onInput = debounce(async () => {
    const q = searchInput.value.trim();
    if (!q) return drop.classList.add("hidden");

    cached = await geocode(q);
    list.innerHTML = cached.map((f, i) =>
      `<li data-idx="${i}">${f.place_name}</li>`
    ).join("");
    drop.classList.remove("hidden");
  });

  searchInput.addEventListener("input", onInput);

  list.addEventListener("click", (e) => {
    const li = e.target.closest("li");
    if (!li) return;
    const f = cached[li.dataset.idx];
    map.flyTo({ center: f.center, zoom: 8 });
    drop.classList.add("hidden");
  });

clearBtn.onclick = () => {
  searchInput.value = "";
  loadPosts();
};

});
