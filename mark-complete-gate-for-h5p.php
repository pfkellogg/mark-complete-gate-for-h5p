<?php
/**
 * Plugin Name:       AIKellogg Mark Complete Gate
 * Plugin URI:        https://aikellogg.com/#/mark-complete-gate
 * Description:       On LearnDash lessons and topics with H5P content, the Mark Complete button stays locked until the learner has completed every H5P activity on the page.
 * Version:           1.1.3
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * Requires Plugins:  h5p
 * Author:            Patrick Kellogg
 * Author URI:        https://aikellogg.com
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       aikellogg-mark-complete-gate
 *
 * H5P is a registered trademark of H5P Group. LearnDash is a trademark of its owner. This plugin is independent: it is
 * not made or endorsed by either.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'MCGH_VERSION', '1.1.3' );

/**
 * The post types whose pages have LearnDash's Mark Complete button: lessons and topics (filterable).
 *
 * @return string[]
 */
function mcgh_post_types() {
	return (array) apply_filters( 'mcgh_post_types', array( 'sfwd-lessons', 'sfwd-topic' ) );
}

/**
 * The page's [mark_complete_gate] instruction, if it has one: off; what to ignore (H5P IDs or type names); what's
 * required (a rule such as "3 and (5 or 7)"); and the pass mark, in percent, for activities that give only a score.
 *
 * @return array{off: bool, ignore: string[], require: string, pass: int}
 */
function mcgh_page_settings() {
	$settings = array(
		'off'     => false,
		'ignore'  => array(),
		'require' => '',
		'pass'    => 100,
	);
	$post = get_post();
	if ( ! $post ) {
		return $settings;
	}
	if ( has_shortcode( $post->post_content, 'mark_complete_gate' ) && preg_match_all( '/' . get_shortcode_regex( array( 'mark_complete_gate' ) ) . '/', $post->post_content, $found, PREG_SET_ORDER ) ) {
		foreach ( $found as $one ) {
			$atts = shortcode_parse_atts( $one[3] );
			$atts = is_array( $atts ) ? $atts : array();
			// [mark_complete_gate off] or off="yes": no gate on this page
			if ( in_array( 'off', $atts, true ) || ( isset( $atts['off'] ) && ! in_array( strtolower( (string) $atts['off'] ), array( '0', 'no', 'false' ), true ) ) ) {
				$settings['off'] = true;
			}
			// ignore="3,7" or ignore="accordion, 12": H5P IDs and type names
			if ( isset( $atts['ignore'] ) ) {
				$words              = preg_split( '/[\s,]+/', strtolower( (string) $atts['ignore'] ), -1, PREG_SPLIT_NO_EMPTY );
				$words              = array_filter( array_map( 'mcgh_word', $words ) );
				$settings['ignore'] = array_values( array_unique( array_merge( $settings['ignore'], $words ) ) );
			}
			// require="3 and (5 or 7)": IDs, type names, and, or, brackets
			if ( isset( $atts['require'] ) ) {
				$settings['require'] = trim( preg_replace( '/[^a-z0-9_.\-\s,()&|]/', '', strtolower( html_entity_decode( (string) $atts['require'], ENT_QUOTES ) ) ) );
			}
			// pass="80": the pass mark for activities that give only a score
			if ( isset( $atts['pass'] ) ) {
				$settings['pass'] = max( 0, min( 100, absint( $atts['pass'] ) ) );
			}
		}
	}
	// eLearning Complete's H5P for LearnDash: [elc_h5p id="3" ignore] means the same as ignore="3" here
	// (read from the text: has_shortcode() is false while eLearning Complete's plugin isn't active)
	if ( false !== strpos( $post->post_content, '[elc_h5p' ) &&
		preg_match_all( '/' . get_shortcode_regex( array( 'elc_h5p' ) ) . '/', $post->post_content, $elc, PREG_SET_ORDER ) ) {
		foreach ( $elc as $one ) {
			$atts = shortcode_parse_atts( $one[3] );
			$atts = is_array( $atts ) ? $atts : array();
			$off  = in_array( 'ignore', $atts, true ) || ( isset( $atts['ignore'] ) && ! in_array( strtolower( (string) $atts['ignore'] ), array( '0', 'no', 'false' ), true ) );
			if ( $off && ! empty( $atts['id'] ) && absint( $atts['id'] ) ) {
				$settings['ignore'][] = (string) absint( $atts['id'] );
			}
		}
		$settings['ignore'] = array_values( array_unique( $settings['ignore'] ) );
	}
	return $settings;
}

/**
 * One word of an ignore list: an H5P ID or a type name (letters, digits, dot, dash, underscore).
 *
 * @param string $word The word.
 * @return string
 */
function mcgh_word( $word ) {
	return preg_replace( '/[^a-z0-9_.\-]/', '', strtolower( (string) $word ) );
}

function mcgh_applies() {
	if ( ! is_singular( mcgh_post_types() ) ) {
		return false;
	}
	$settings = mcgh_page_settings();
	return ! $settings['off'];
}

/**
 * [mark_complete_gate ignore="3,7"], [mark_complete_gate require="3 and (5 or 7)"], [mark_complete_gate pass="80"]
 * or [mark_complete_gate off]: an instruction for this page; it shows nothing.
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
	$settings = mcgh_page_settings();
	wp_localize_script(
		'mark-complete-gate',
		'MCGH',
		array(
			'ignore'   => $settings['ignore'],
			'require'  => $settings['require'],
			'pass'     => $settings['pass'],
			'user'     => get_current_user_id(), // passes are remembered per user in this browser
			'message'  => __( 'Please complete the H5P activity to enable the "Mark Complete" button.', 'aikellogg-mark-complete-gate' ),
			'locked'   => __( 'Please complete the H5P activity to enable this button.', 'aikellogg-mark-complete-gate' ),
			'unlocked' => __( 'You can now mark this lesson as complete.', 'aikellogg-mark-complete-gate' ),
			'progress' => /* translators: 1: activities done, 2: activities on the page */ __( 'H5P activities completed: %1$d of %2$d', 'aikellogg-mark-complete-gate' ),
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
