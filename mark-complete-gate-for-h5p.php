<?php
/**
 * Plugin Name:       Mark Complete Gate for H5P in LearnDash
 * Plugin URI:        https://aikellogg.com/#/mark-complete-gate
 * Description:       On LearnDash lessons and topics with H5P content, the Mark Complete button stays locked until the learner has completed every H5P activity on the page.
 * Version:           1.1.0
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * Requires Plugins:  h5p
 * Author:            Patrick Kellogg
 * Author URI:        https://aikellogg.com
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       mark-complete-gate-for-h5p
 *
 * H5P is a registered trademark of H5P Group. LearnDash is a trademark of its owner. This plugin is independent: it is
 * not made or endorsed by either.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'MCGH_VERSION', '1.1.0' );

/**
 * The post types whose pages have LearnDash's Mark Complete button: lessons and topics (filterable).
 *
 * @return string[]
 */
function mcgh_post_types() {
	return (array) apply_filters( 'mcgh_post_types', array( 'sfwd-lessons', 'sfwd-topic' ) );
}

/**
 * The page's [mark_complete_gate] instruction, if it has one: off, and the H5P IDs to ignore.
 *
 * @return array{off: bool, ignore: int[]}
 */
function mcgh_page_settings() {
	$settings = array(
		'off'    => false,
		'ignore' => array(),
	);
	$post = get_post();
	if ( ! $post || ! has_shortcode( $post->post_content, 'mark_complete_gate' ) ) {
		return $settings;
	}
	if ( preg_match_all( '/' . get_shortcode_regex( array( 'mark_complete_gate' ) ) . '/', $post->post_content, $found, PREG_SET_ORDER ) ) {
		foreach ( $found as $one ) {
			$atts = shortcode_parse_atts( $one[3] );
			$atts = is_array( $atts ) ? $atts : array();
			// [mark_complete_gate off] or off="yes": no gate on this page
			if ( in_array( 'off', $atts, true ) || ( isset( $atts['off'] ) && ! in_array( strtolower( (string) $atts['off'] ), array( '0', 'no', 'false' ), true ) ) ) {
				$settings['off'] = true;
			}
			if ( isset( $atts['ignore'] ) ) {
				$ids                = array_filter( array_map( 'absint', explode( ',', (string) $atts['ignore'] ) ) );
				$settings['ignore'] = array_values( array_unique( array_merge( $settings['ignore'], $ids ) ) );
			}
		}
	}
	return $settings;
}

function mcgh_applies() {
	if ( ! is_singular( mcgh_post_types() ) ) {
		return false;
	}
	$settings = mcgh_page_settings();
	return ! $settings['off'];
}

/**
 * [mark_complete_gate ignore="3,7"] or [mark_complete_gate off]: an instruction for this page; it shows nothing.
 */
add_shortcode(
	'mark_complete_gate',
	function () {
		return '';
	}
);

add_action( 'wp_enqueue_scripts', 'mcgh_enqueue' );

function mcgh_enqueue() {
	if ( ! mcgh_applies() ) {
		return;
	}
	$url = plugin_dir_url( __FILE__ );
	wp_enqueue_style( 'mark-complete-gate', $url . 'css/mark-complete-gate.css', array(), MCGH_VERSION );
	wp_enqueue_script( 'mark-complete-gate', $url . 'js/mark-complete-gate.js', array(), MCGH_VERSION, true );
	wp_localize_script(
		'mark-complete-gate',
		'MCGH',
		array(
			'ignore'   => mcgh_page_settings()['ignore'],
			'message'  => __( 'Please complete the H5P activity to enable the "Mark Complete" button.', 'mark-complete-gate-for-h5p' ),
			'locked'   => __( 'Please complete the H5P activity to enable this button.', 'mark-complete-gate-for-h5p' ),
			'unlocked' => __( 'You can now mark this lesson as complete.', 'mark-complete-gate-for-h5p' ),
			'progress' => /* translators: 1: activities done, 2: activities on the page */ __( 'H5P activities completed: %1$d of %2$d', 'mark-complete-gate-for-h5p' ),
		)
	);
}

// ============================================================================
// A clean slate: when a user is permanently deleted, their H5P data goes too
// ============================================================================

/**
 * The H5P plugin's per-user tables: scores, saved progress (the state H5P restores), and the activity log.
 *
 * @return string[]
 */
function mcgh_h5p_user_tables() {
	return array( 'h5p_results', 'h5p_contents_user_data', 'h5p_events' );
}

/**
 * Deletes one user's rows from the H5P tables that use this table prefix (those that exist).
 *
 * @param string $prefix  A site's table prefix.
 * @param int    $user_id The user.
 */
function mcgh_delete_h5p_user_data( $prefix, $user_id ) {
	global $wpdb;
	$user_id = (int) $user_id;
	if ( $user_id <= 0 ) {
		return;
	}
	foreach ( mcgh_h5p_user_tables() as $name ) {
		$table = $prefix . $name;
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- checking the H5P plugin's own table exists.
		if ( $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $wpdb->esc_like( $table ) ) ) !== $table ) {
			continue;
		}
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- removing a deleted user's rows from the H5P plugin's own table.
		$wpdb->delete( $table, array( 'user_id' => $user_id ), array( '%d' ) );
	}
}

/*
 * Single site: wp_delete_user() deletes the account, from anywhere (admin, REST API, WP-CLI, a member deleting their own
 * account, an LMS tool). The H5P plugin cleans up only on admin screens, and leaves its activity log.
 */
add_action(
	'deleted_user',
	function ( $user_id ) {
		if ( ! is_multisite() ) {
			global $wpdb;
			mcgh_delete_h5p_user_data( $wpdb->prefix, $user_id );
		}
	}
);

/*
 * Multisite: "remove from this site" keeps the account, so only a network deletion counts, and then on every site.
 */
add_action(
	'wpmu_delete_user',
	function ( $user_id ) {
		global $wpdb;
		foreach ( get_sites( array( 'fields' => 'ids', 'number' => 0 ) ) as $site_id ) {
			mcgh_delete_h5p_user_data( $wpdb->get_blog_prefix( $site_id ), $user_id );
		}
	}
);
