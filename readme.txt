=== AIKellogg Mark Complete Gate ===
Contributors: pfkellogg
Tags: h5p, learndash, mark complete, lms, elearning
Requires at least: 6.0
Tested up to: 7.1
Requires PHP: 7.4
Requires Plugins: h5p
Stable tag: 1.1.2
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

For H5P in LearnDash: keeps LearnDash's Mark Complete button locked until the learner has completed every H5P activity on the lesson or topic.

== Description ==

When a LearnDash lesson or topic has H5P content, learners can click **Mark Complete** without even trying the activity. This plugin locks the button until every H5P activity on the page is done.

* **No setup.** Activate it: every lesson and topic with H5P is gated. Pages without H5P are left alone.
* **Passing counts.** A scored activity counts once the learner passes it; a wrong answer keeps the button locked, and the learner can retry. When an activity gives only a score (Fill in the Blanks, Drag the Words, Flashcards, Interactive Video), the score must reach the pass mark: full marks, or what you set with `pass="80"`.
* **Every kind of H5P.** Activities that never report a result are watched on the page instead: an Accordion counts once every panel has been opened, Dialog Cards once every card has been turned, Guess the Answer once the answer is revealed, Audio once it has played to the end, display-only content once it has been on screen. Kinds not tested yet count once the learner has worked with them.
* **Several activities.** With more than one H5P on the page, all of them must be done; a message shows how many are complete.
* **Works with H5P's embeds.** It listens to H5P's own completion events (xAPI), so it works when H5P runs inside its frame, the usual way in WordPress.
* **A clear message.** Above the locked button: "Please complete the H5P activity to enable the Mark Complete button." It goes away once the button unlocks.

= A clean slate when a user is deleted =

When a user is permanently deleted, their H5P data goes too: their scores, the progress H5P saved for them, and their entries in H5P's activity log. The H5P plugin cleans up only when a user is deleted from the admin screens, and keeps the activity log; this plugin does it however the user is deleted (the admin, the REST API, WP-CLI, a member deleting their own account, an LMS tool). On multisite, it happens when the account is deleted from the network, on every site; removing a user from one site keeps their data.

= Choose per page with a shortcode =

Put the shortcode anywhere in a lesson or topic (a Shortcode block works in the block editor). It shows nothing on the page.

* `[mark_complete_gate ignore="3,7"]` — H5P items 3 and 7 don't count.
* `[mark_complete_gate ignore="accordion, audio"]` — no Accordion or Audio on this page counts. Types can be mixed with IDs: `ignore="accordion, 12"`.
* `[mark_complete_gate require="3 and (5 or 7)"]` — exactly what must be done: item 3, and item 5 or item 7. Use `and`, `or` and brackets (`&&`, `||` and commas work too); a word is a type (`require="quiz or 12"`: every Question Set on the page, or item 12); `all` is everything not ignored.
* `[mark_complete_gate pass="80"]` — the pass mark, in percent, for activities that give only a score (100 unless you say).
* `[mark_complete_gate off]` — no gate on this page.

Without `require`, every H5P on the page counts, except what `ignore` leaves out. Type names are the H5P type without "H5P.": `multichoice`, `truefalse`, `blanks`, `dragtext`, `dragquestion`, `markthewords`, `singlechoiceset`, `questionset`, `summary`, `essay`, `findthewords`, `flashcards`, `dialogcards`, `accordion`, `interactivevideo`, `audio`, `guesstheanswer`, `questionnaire`; also `quiz`, `video`, `multiplechoice`, `fillintheblanks`, `dragthewords` and `draganddrop`.

The H5P ID is the number in the H5P shortcode (`[h5p id="3"]`), or in **H5P Content** in the admin.

= Good to know =

The lock is in the learner's browser. It keeps honest learners on track, but someone determined can get around it with the browser's developer tools. For gating that the server enforces, with passing scores, quizzes and the Next buttons too, see **H5P Gating & Scoring for LearnDash**, a separate paid plugin: https://aikellogg.com/#/mark-complete-gate

H5P is a registered trademark of H5P Group. LearnDash is a trademark of its owner. This plugin is independent: it is not made or endorsed by either.

== Installation ==

1. Install and activate **H5P** (Interactive Content - H5P) and **LearnDash**.
2. Install **AIKellogg Mark Complete Gate** from **Plugins → Add New**, or upload the zip, and activate it.
3. That's all: open a lesson or topic with H5P content as a learner; the Mark Complete button is locked until the H5P is done.

== Frequently Asked Questions ==

= Which pages does it gate? =

LearnDash lessons and topics (the pages with a Mark Complete button) that have H5P content. Developers can change the list of post types with the `mcgh_post_types` filter.

= An activity can't be completed (an Accordion, an image, a timeline) =

It doesn't need to report anything: the gate watches the page. An Accordion counts once every panel has been opened, Dialog Cards once every card is turned, Audio once it has played to the end, an image or other display-only content once it has been on screen. If you'd rather it didn't count at all, add `[mark_complete_gate ignore="accordion"]` (or its ID).

= Which H5P types were tested? =

Multiple Choice, True/False, Mark the Words, Drag and Drop, Single Choice Set, Question Set, Find the Words, Summary, Questionnaire, Essay, Fill in the Blanks, Drag the Words, Flashcards, Interactive Video, Accordion, Dialog Cards, Guess the Answer, Audio and Greeting Card. Essay follows its own pass setting. An Interactive Video counts when the learner presses Submit at the end with a passing score; a video with no questions counts when it has played to the end.

= Does a wrong answer unlock the button? =

No: a scored activity must be passed, or reach full marks (or your `pass="..."`) when it gives only a score. The learner can use H5P's Retry and try again.

= What does it delete when a user is deleted? =

Only that user's rows in the H5P plugin's tables h5p_results (scores), h5p_contents_user_data (saved progress) and h5p_events (activity log). Nothing else, and nothing for other users. LearnDash's own progress is stored with the user and WordPress deletes it with them.

= Is it secure? =

It's a convenience, not a lock the server enforces: see "Good to know" above.

== Screenshots ==

1. A lesson with H5P: the Mark Complete button is locked, with a message above it.
2. After the learner answers correctly, the button unlocks.
3. The shortcode in the block editor: `[mark_complete_gate ignore="3"]`.

== Changelog ==

= 1.1.2 =
* Fixed: Fill in the Blanks, Drag the Words, Flashcards and Interactive Video unlocked the button even with wrong answers (they give a score but no pass or fail). Their score must now reach the pass mark: full marks, or `pass="80"`.
* New: activities that never report a result no longer lock the button for good. The page watches them: every Accordion panel opened, every Dialog Card turned, Guess the Answer revealed, Audio played to the end, display-only content seen.
* New: `require="3 and (5 or 7)"`: exactly which activities must be done, with and, or and brackets; IDs or types.
* New: `ignore` takes types too: `ignore="accordion, 12"`.

= 1.1.1 =
* New name for the WordPress.org directory: AIKellogg Mark Complete Gate (address aikellogg-mark-complete-gate); text domain to match.

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
