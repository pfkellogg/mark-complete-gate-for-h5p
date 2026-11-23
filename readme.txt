=== Mark Complete Gate for H5P in LearnDash ===
Contributors: pfkellogg
Tags: h5p, learndash, mark complete, lms, elearning
Requires at least: 6.0
Tested up to: 7.1
Requires PHP: 7.4
Requires Plugins: h5p
Stable tag: 1.1.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Keeps LearnDash's Mark Complete button locked until the learner has completed every H5P activity on the lesson or topic.

== Description ==

When a LearnDash lesson or topic has H5P content, learners can click **Mark Complete** without even trying the activity. This plugin locks the button until every H5P activity on the page is done.

* **No setup.** Activate it: every lesson and topic with H5P is gated. Pages without H5P are left alone.
* **Passing counts.** A scored activity counts once the learner passes it; a wrong answer keeps the button locked, and the learner can retry.
* **Several activities.** With more than one H5P on the page, all of them must be done; a message shows how many are complete.
* **Works with H5P's embeds.** It listens to H5P's own completion events (xAPI), so it works when H5P runs inside its frame, the usual way in WordPress.
* **A clear message.** Above the locked button: "Please complete the H5P activity to enable the Mark Complete button." It goes away once the button unlocks.

= A clean slate when a user is deleted =

When a user is permanently deleted, their H5P data goes too: their scores, the progress H5P saved for them, and their entries in H5P's activity log. The H5P plugin cleans up only when a user is deleted from the admin screens, and keeps the activity log; this plugin does it however the user is deleted (the admin, the REST API, WP-CLI, a member deleting their own account, an LMS tool). On multisite, it happens when the account is deleted from the network, on every site; removing a user from one site keeps their data.

= Choose per page with a shortcode =

Put the shortcode anywhere in a lesson or topic (a Shortcode block works in the block editor). It shows nothing on the page.

* `[mark_complete_gate ignore="3,7"]` — H5P items 3 and 7 don't count (for example, display-only content such as an Accordion, which can't be "completed").
* `[mark_complete_gate off]` — no gate on this page.

The H5P ID is the number in the H5P shortcode (`[h5p id="3"]`), or in **H5P Content** in the admin.

= Good to know =

The lock is in the learner's browser. It keeps honest learners on track, but someone determined can get around it with the browser's developer tools. For gating that the server enforces, with passing scores, quizzes and the Next buttons too, see **H5P Gating & Scoring for LearnDash**, a separate paid plugin: https://aikellogg.com/#/mark-complete-gate

H5P is a registered trademark of H5P Group. LearnDash is a trademark of its owner. This plugin is independent: it is not made or endorsed by either.

== Installation ==

1. Install and activate **H5P** (Interactive Content - H5P) and **LearnDash**.
2. Install **Mark Complete Gate for H5P in LearnDash** from **Plugins → Add New**, or upload the zip, and activate it.
3. That's all: open a lesson or topic with H5P content as a learner; the Mark Complete button is locked until the H5P is done.

== Frequently Asked Questions ==

= Which pages does it gate? =

LearnDash lessons and topics (the pages with a Mark Complete button) that have H5P content. Developers can change the list of post types with the `mcgh_post_types` filter.

= An activity can't be completed (an Accordion, an image, a timeline) =

Add `[mark_complete_gate ignore="ID"]` to that lesson with the activity's H5P ID, so it doesn't count.

= Does a wrong answer unlock the button? =

No: a scored activity must be passed. The learner can use H5P's Retry and try again.

= What does it delete when a user is deleted? =

Only that user's rows in the H5P plugin's tables h5p_results (scores), h5p_contents_user_data (saved progress) and h5p_events (activity log). Nothing else, and nothing for other users. LearnDash's own progress is stored with the user and WordPress deletes it with them.

= Is it secure? =

It's a convenience, not a lock the server enforces: see "Good to know" above.

== Screenshots ==

1. A lesson with H5P: the Mark Complete button is locked, with a message above it.
2. After the learner answers correctly, the button unlocks.
3. The shortcode in the block editor: `[mark_complete_gate ignore="3"]`.

== Changelog ==

= 1.1.0 =
* New name for the WordPress.org directory: Mark Complete Gate for H5P in LearnDash (was H5P Controls LearnDash).
* Listens to H5P's own completion events, so it works when H5P runs in its frame, and waits for H5P to load.
* Every H5P activity on the page must be done, not just the first; scored activities must be passed.
* Topics too, not only lessons.
* The message shows only on pages with H5P, and only while the button is locked.
* New shortcode: `[mark_complete_gate ignore="..."]` and `[mark_complete_gate off]`.
* A clean slate: when a user is permanently deleted, their H5P scores, saved progress and activity log are deleted too.
* All text can be translated.

= 1.0 =
* First version.

== Upgrade Notice ==

= 1.1.0 =
Works with H5P in its frame, gates every activity on the page, and adds a shortcode to ignore activities or turn the gate off.
