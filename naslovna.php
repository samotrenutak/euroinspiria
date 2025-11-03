<?php 
add_action('init', function () {
  if (!is_admin()) return;
  $page = get_page_by_path('naslovna');
  if ($page && get_page_template_slug($page->ID) !== 'templates/template-live-map.php') {
    update_post_meta($page->ID, '_wp_page_template', 'templates/template-live-map.php');
  }
});
?>
