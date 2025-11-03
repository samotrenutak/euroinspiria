<?php
/**
 * Template Name: Live Map
 * Template Post Type: page
 */
if (!defined('ABSPATH')) exit;
get_header();
?>

<main class="app-wrap">
  <!-- Samo centralni search bar -->
  <header class="app-topbar" role="search">
    <form id="geo-form" class="geo-form" autocomplete="off">
      <input
        id="geo-search"
        name="q"
        type="search"
        placeholder="Upiši grad, regiju ili državu…"
        aria-label="Pretraga lokacije"
      />
      <button type="submit" class="btn-search" aria-label="Pronađi">
        🔍
      </button>
      <button type="button" id="geo-clear" class="btn-clear" aria-label="Obriši">×</button>
    </form>
  </header>

  <!-- Levo mapa -->
  <section class="map-wrap">
    <div id="map"></div>
    <div class="map-legend">
      <div class="legend-row">
        <span class="cluster cluster-s"></span> manji klaster
        <span class="cluster cluster-m"></span> srednji
        <span class="cluster cluster-l"></span> veći
      </div>
      <div id="map-status" class="map-status">Spremno</div>
    </div>
  </section>

  <!-- Desno: sidebar -->
<aside id="sidebar" class="sidebar" aria-label="Rezultati pretrage">
  <div class="sidebar-filters">
    <button class="qf-btn active" data-tag="">Sve</button>
    <button class="qf-btn" data-tag="plaze">Plaže</button>
    <button class="qf-btn" data-tag="gastro">Gastro</button>
    <button class="qf-btn" data-tag="arhitektura">Arhitektura</button>
    <button class="qf-btn" data-tag="budzet">Budžet</button>
    <button class="qf-btn" data-tag="porodica">Porodica</button>
    <button class="qf-btn" data-tag="priroda">Priroda</button>
  </div>

  <div class="sidebar-posts" id="sidebar-posts">
    <p class="empty-hint">
      Upiši lokaciju ili zumiraj mapu — relevantne objave će se pojaviti ovde.
    </p>
  </div>
</aside>
</main>

<style>
/* Sakrij globalni WP header i naslov stranice samo na ovoj */
header.site-header, .entry-header, .page-title { display: none !important; }
</style>


<?php get_footer(); ?>
