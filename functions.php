<?php
// === Parent style (klasičan child tema setup) ===
add_action('wp_enqueue_scripts', function () {
  wp_enqueue_style('parent-style', get_template_directory_uri() . '/style.css');
});

// === KONFIG: ispravan naziv foldera sa statikom ===
$ASSETS_DIR = 'assets';

// === 1) Registruj page template da se pojavi u editoru ===
add_filter('theme_page_templates', function ($templates) {
  $templates['templates/template-live-map.php'] = 'Live Map';
  return $templates;
});

// === 2) Učitaj baš naš template fajl kad je dodeljen ===
add_filter('template_include', function ($template) {
  if (is_page()) {
    $tpl = get_page_template_slug(get_queried_object_id());
    if ($tpl === 'templates/template-live-map.php') {
      $path = get_stylesheet_directory() . '/templates/template-live-map.php';
      if (file_exists($path)) return $path;
      error_log('[Live Map] Template file NOT found at: ' . $path);
    }
  }
  return $template;
});

// === 3) (opciono) automatski dodeli template strani "naslovna" ===
// Možeš obrisati kad se Live Map pojavi u dropdownu i ručno je izabereš.
add_action('init', function () {
  if (!is_admin()) return;
  $page = get_page_by_path('naslovna');
  if ($page && get_page_template_slug($page->ID) !== 'templates/template-live-map.php') {
    update_post_meta($page->ID, '_wp_page_template', 'templates/template-live-map.php');
  }
});

// === 4) Enqueue samo na Live Map šablonu (i u editor preview-u) ===
add_action('wp_enqueue_scripts', function () use ($ASSETS_DIR) {
  if (!is_page_template('templates/template-live-map.php')) {
    return; // ne kači JS/CSS van Live Map strane
  }

  // MapLibre
  wp_enqueue_style('maplibre', 'https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.css', [], '3.6.2');
  wp_enqueue_script('maplibre', 'https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.js', [], '3.6.2', true);

  // Naš CSS/JS (PAZI na "assests"!)
  wp_enqueue_style('travel-app', get_stylesheet_directory_uri() . '/' . $ASSETS_DIR . '/css/travel-app.css', [], '1.0');
  wp_enqueue_script('travel-app', get_stylesheet_directory_uri() . '/' . $ASSETS_DIR . '/js/travel-app.js', ['maplibre'], '1.0', true);

  // (opciono) prosledi PHP → JS vrednosti, npr. API key, WP REST itd.
  wp_localize_script('travel-app', 'TravelApp', [
    'rest'     => esc_url_raw( rest_url('wp/v2') ),
    'siteUrl'  => esc_url_raw( home_url('/') ),
    'maptiler' => [
      'key'   => 'Nf2B55v665PYbr2W3Lw1', // zameni ako koristiš drugi
      'style' => 'https://api.maptiler.com/maps/openstreetmap/style.json?key=Nf2B55v665PYbr2W3Lw1',
      'geocodeEndpoint' => 'https://api.maptiler.com/geocoding/{query}.json?key=Nf2B55v665PYbr2W3Lw1&language=sr',
    ],
  ]);
});
// === CUSTOM POST TYPE: DESTINACIJE ===
add_action('init', function() {
  $labels = [
    'name'               => 'Destinacije',
    'singular_name'      => 'Destinacija',
    'add_new'            => 'Dodaj novu',
    'add_new_item'       => 'Dodaj novu destinaciju',
    'edit_item'          => 'Uredi destinaciju',
    'new_item'           => 'Nova destinacija',
    'view_item'          => 'Prikaži destinaciju',
    'search_items'       => 'Pretraži destinacije',
    'not_found'          => 'Nema pronađenih destinacija',
    'not_found_in_trash' => 'Nema destinacija u korpi',
  ];

  register_post_type('destinacije', [
    'labels' => $labels,
    'public' => true,
    'menu_icon' => 'dashicons-location',
    'has_archive' => true,
    'rewrite' => ['slug' => 'destinacije'],
    'supports' => ['title', 'editor', 'excerpt', 'thumbnail'],
    'show_in_rest' => true,
  ]);
});
// === LOKACIJA (latitude/longitude) ===
add_action('add_meta_boxes', function() {
  add_meta_box(
    'dest_location',
    'Lokacija (Latitude / Longitude)',
    function($post) {
      $lat = get_post_meta($post->ID, 'lat', true);
      $lng = get_post_meta($post->ID, 'lng', true);
      echo '<p>Upiši geografske koordinate destinacije:</p>';
      echo '<label>Latitude: <input type="text" name="lat" value="' . esc_attr($lat) . '" style="width:120px"></label> ';
      echo '<label>Longitude: <input type="text" name="lng" value="' . esc_attr($lng) . '" style="width:120px"></label>';
      echo '<p><small>Primer: Beograd — lat: <code>44.8176</code>, lng: <code>20.4569</code></small></p>';
    },
    'destinacije',
    'normal',
    'default'
  );
});

// Sačuvaj vrednosti
add_action('save_post_destinacije', function($post_id) {
  if (isset($_POST['lat'])) update_post_meta($post_id, 'lat', sanitize_text_field($_POST['lat']));
  if (isset($_POST['lng'])) update_post_meta($post_id, 'lng', sanitize_text_field($_POST['lng']));
});
// === TAKSONOMIJE ===
add_action('init', function() {
  register_taxonomy('tema', ['destinacije'], [
    'label' => 'Teme',
    'hierarchical' => false,
    'show_in_rest' => true,
    'rewrite' => ['slug' => 'tema']
  ]);
});
// === REST ENDPOINT: travel/v1/search (GeoJSON, bez greške kad nema bbox) ===
add_action('rest_api_init', function() {
  register_rest_route('travelmap/v1', '/search', [
    'methods'  => 'GET',
    'args'     => [
      'bbox' => [
        'description' => 'Bounding box u formatu minLng,minLat,maxLng,maxLat',
        'required'    => false,
        'type'        => 'string',
      ],
      'tema' => [
        'description' => 'Filter po taksonomiji tema',
        'required'    => false,
        'type'        => 'string',
      ],
    ],
    'callback' => function(WP_REST_Request $req) {

      $bbox_raw = $req->get_param('bbox');
      $bbox = $bbox_raw ? explode(',', $bbox_raw) : [];

      $args = [
        'post_type'      => 'destinacije',
        'posts_per_page' => -1,
        'post_status'    => 'publish',
      ];

      // 🗺️ Ako je bbox validan (4 broja)
      if (count($bbox) === 4 && !in_array('', $bbox, true)) {
        [$minLon, $minLat, $maxLon, $maxLat] = array_map('floatval', $bbox);
        $args['meta_query'] = [
          'relation' => 'AND',
          [
            'key'     => 'lat',
            'value'   => [$minLat, $maxLat],
            'compare' => 'BETWEEN',
            'type'    => 'NUMERIC',
          ],
          [
            'key'     => 'lng',
            'value'   => [$minLon, $maxLon],
            'compare' => 'BETWEEN',
            'type'    => 'NUMERIC',
          ],
        ];
      }

      // 🎯 Filter po temi
      $tema = $req->get_param('tema');
      if (!empty($tema)) {
        $args['tax_query'] = [[
          'taxonomy' => 'tema',
          'field'    => 'slug',
          'terms'    => sanitize_text_field($tema),
        ]];
      }

      $posts = get_posts($args);

      // 📍 GeoJSON FeatureCollection
      $features = [];
      foreach ($posts as $p) {
        $lat = (float) get_post_meta($p->ID, 'lat', true);
        $lng = (float) get_post_meta($p->ID, 'lng', true);
        if (!$lat || !$lng) continue;

        $features[] = [
          'type'       => 'Feature',
          'geometry'   => [
            'type'        => 'Point',
            'coordinates' => [$lng, $lat],
          ],
          'properties' => [
            'id'      => $p->ID,
            'title'   => get_the_title($p),
            'link'    => get_permalink($p),
            'excerpt' => wp_strip_all_tags(get_the_excerpt($p)),
            'thumb'   => get_the_post_thumbnail_url($p->ID, 'medium') ?: '',
          ],
        ];
      }

      return rest_ensure_response([
        'type'     => 'FeatureCollection',
        'features' => $features,
      ]);
    },
  ]);
});




