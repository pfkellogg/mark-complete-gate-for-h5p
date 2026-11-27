/**
 * AIKellogg Mark Complete Gate.
 *
 * When the page has H5P content, LearnDash's Mark Complete button is locked until the H5P activities are done.
 *
 * How an activity counts as done:
 * - Types that report their result (xAPI): when H5P says "completed" or "answered" and it's passed. If H5P says
 *   passed/failed, that decides; if it only gives a score, the score must reach the pass mark (full marks unless the
 *   shortcode says pass="80").
 * - Types that never report (Accordion, Dialog Cards, Guess the Answer, Audio, display-only content, and any type we
 *   haven't tested): a MutationObserver watches the activity's own page for the learner finishing it (every panel
 *   opened, every card turned, the answer revealed, played to the end), or, for types we don't know, the learner
 *   working with it (a click that changes it) or, with nothing to click, having it on screen.
 *
 * Which activities must be done: all of them on the page, except those in ignore="..." (H5P IDs or type names), or
 * exactly what require="..." says, with and/or and brackets: require="3 and (5 or 7)", require="quiz or 12".
 */
( function () {
	'use strict';

	var TEXT = window.MCGH || {};
	var BUTTONS = [
		'#learndash_mark_complete_button',
		'input.learndash_mark_complete_button',
		'.learndash_mark_complete_button input[type="submit"]',
		'form.sfwd-mark-complete [type="submit"]'
	].join( ',' );
	var LOCAL_ID = 'http://h5p.org/x-api/h5p-local-content-id';
	var SUB_ID = 'http://h5p.org/x-api/h5p-subContentId';
	var PASS = isNaN( parseInt( TEXT.pass, 10 ) ) ? 100 : Math.max( 0, Math.min( 100, parseInt( TEXT.pass, 10 ) ) );

	// Types tested to report their result over xAPI: only that counts for them.
	var REPORTS = [ 'multichoice', 'truefalse', 'markthewords', 'dragquestion', 'singlechoiceset', 'questionset',
		'findthewords', 'summary', 'questionnaire', 'essay', 'blanks', 'dragtext', 'flashcards', 'interactivevideo' ];

	// Short names people can use in ignore/require, besides the type's own name (accordion, dialogcards, ...).
	var ALIASES = {
		quiz: 'questionset', multiplechoice: 'multichoice', fillintheblanks: 'blanks', dragthewords: 'dragtext',
		draganddrop: 'dragquestion', video: 'interactivevideo', interactive: 'interactivevideo', cards: 'dialogcards',
		guess: 'guesstheanswer', truefalsequestion: 'truefalse'
	};

	function buttons() {
		return Array.prototype.slice.call( document.querySelectorAll( BUTTONS ) );
	}

	function format( s, a, b ) {
		return String( s || '' ).replace( '%1$d', a ).replace( '%2$d', b );
	}

	// "H5P.DialogCards 1.9" -> "dialogcards"
	function typeKey( library ) {
		return String( library || '' ).split( ' ' )[ 0 ].replace( /^H5P\./i, '' ).replace( /[^a-z0-9]/gi, '' ).toLowerCase();
	}

	function nameKey( word ) {
		var k = String( word ).replace( /^H5P\./i, '' ).replace( /[^a-z0-9]/gi, '' ).toLowerCase();
		return ALIASES[ k ] || k;
	}

	// ------------------------------------------------------------------------------------------------------------
	// The rule: "3 and (5 or 7)". Commas and "&&" mean and; "||" means or; and binds tighter than or.
	// A number is an H5P ID; a word is a type (all of that type on the page); "all" is everything not ignored.
	// ------------------------------------------------------------------------------------------------------------
	function parseRule( text ) {
		var tokens = String( text ).toLowerCase().match( /\(|\)|,|&&|\|\||[a-z0-9_.\-]+/g ) || [];
		var i = 0;
		function peek() {
			return tokens[ i ];
		}
		function orExpr() {
			var parts = [ andExpr() ];
			while ( peek() === 'or' || peek() === '||' ) {
				i++;
				parts.push( andExpr() );
			}
			return parts.length === 1 ? parts[ 0 ] : { or: parts };
		}
		function andExpr() {
			var parts = [ atom() ];
			while ( peek() === 'and' || peek() === '&&' || peek() === ',' ) {
				i++;
				parts.push( atom() );
			}
			return parts.length === 1 ? parts[ 0 ] : { and: parts };
		}
		function atom() {
			var t = tokens[ i++ ];
			if ( t === '(' ) {
				var e = orExpr();
				if ( peek() === ')' ) {
					i++;
				}
				return e;
			}
			if ( t === undefined || t === ')' ) {
				return { all: true };
			}
			return /^\d+$/.test( t ) ? { id: t } : ( t === 'all' ? { all: true } : { type: nameKey( t ) } );
		}
		var tree = orExpr();
		return i < tokens.length ? null : tree; // leftovers: a typo; fall back to "all"
	}

	function start() {
		var contents = ( window.H5PIntegration && window.H5PIntegration.contents ) || {};
		var items = {}; // id -> { id, type }
		Object.keys( contents ).forEach( function ( k ) {
			var id = String( k ).replace( 'cid-', '' );
			items[ id ] = { id: id, type: typeKey( contents[ k ].library ), params: contents[ k ].jsonContent };
		} );
		var ids = Object.keys( items );
		if ( ! ids.length || ! buttons().length ) {
			return; // no H5P here (or no button): leave the page alone
		}

		var ignored = {};
		( TEXT.ignore || [] ).forEach( function ( w ) {
			w = String( w );
			ids.forEach( function ( id ) {
				if ( id === w || items[ id ].type === nameKey( w ) ) {
					ignored[ id ] = true;
				}
			} );
		} );
		var rule = ( TEXT.require && parseRule( TEXT.require ) ) || { all: true };
		if ( TEXT.require && ! parseRule( TEXT.require ) && window.console ) {
			window.console.warn( 'Mark Complete Gate: couldn\'t read require="' + TEXT.require + '"; all activities count.' );
		}

		var done = {};
		function isDone( id ) {
			return !! done[ id ] || !! ignored[ id ] || ! items[ id ]; // an ID that isn't on the page can't hold the learner up
		}
		function ofType( type ) {
			return ids.filter( function ( id ) {
				return items[ id ].type === type && ! ignored[ id ];
			} );
		}
		function evaluate( node ) {
			if ( node.or ) {
				return node.or.some( evaluate );
			}
			if ( node.and ) {
				return node.and.every( evaluate );
			}
			if ( node.id ) {
				return isDone( node.id );
			}
			var list = node.all ? ids.filter( function ( id ) {
				return ! ignored[ id ];
			} ) : ofType( node.type );
			return list.every( isDone );
		}
		function counted( node, out ) {
			if ( node.or || node.and ) {
				( node.or || node.and ).forEach( function ( n ) {
					counted( n, out );
				} );
			} else if ( node.id ) {
				if ( items[ node.id ] && ! ignored[ node.id ] ) {
					out[ node.id ] = true;
				}
			} else {
				( node.all ? ids.filter( function ( id ) {
					return ! ignored[ id ];
				} ) : ofType( node.type ) ).forEach( function ( id ) {
					out[ id ] = true;
				} );
			}
			return out;
		}
		var watched = Object.keys( counted( rule, {} ) );
		if ( ! watched.length || evaluate( rule ) ) {
			return; // nothing on this page needs doing
		}

		// a message above the (first) button, while it's locked
		var message = document.createElement( 'div' );
		message.className = 'mcgh-message';
		message.setAttribute( 'role', 'status' );
		message.setAttribute( 'aria-live', 'polite' );
		message.textContent = TEXT.message || '';
		var first = buttons()[ 0 ];
		var anchor = first.closest( 'form' ) || first;
		anchor.parentNode.insertBefore( message, anchor );

		function setLocked( locked ) {
			buttons().forEach( function ( b ) {
				b.disabled = locked;
				b.classList.toggle( 'mcgh-locked', locked );
				b.setAttribute( 'aria-disabled', locked ? 'true' : 'false' );
				b.title = locked ? ( TEXT.locked || '' ) : ( TEXT.unlocked || '' );
			} );
			var n = watched.filter( function ( id ) {
				return done[ id ];
			} ).length;
			message.hidden = ! locked;
			message.textContent = locked && watched.length > 1 && n
				? ( TEXT.message || '' ) + ' ' + format( TEXT.progress, n, watched.length )
				: ( TEXT.message || '' );
		}

		function markDone( id ) {
			if ( done[ id ] ) {
				return;
			}
			done[ id ] = true;
			setLocked( ! evaluate( rule ) );
		}

		// --------------------------------------------------------------------------------------------------------
		// 1. xAPI: what H5P reports (H5P passes it up to this page even from its frames)
		// --------------------------------------------------------------------------------------------------------
		function passed( verb, r ) {
			if ( r.success === true ) {
				return true;
			}
			if ( r.success === false ) {
				return false;
			}
			// no passed/failed from H5P: a score must reach the pass mark
			var sc = r.score || {};
			if ( typeof sc.raw === 'number' && typeof sc.max === 'number' && sc.max > 0 ) {
				return ( sc.raw / sc.max ) * 100 >= PASS - 1e-9;
			}
			return verb === 'completed' || r.completion === true;
		}

		function onXapi( event ) {
			var s = event && event.data && event.data.statement;
			if ( ! s || ! s.object || ! s.verb ) {
				return;
			}
			var ext = ( s.object.definition && s.object.definition.extensions ) || {};
			if ( ext[ SUB_ID ] ) {
				return; // a question inside an activity: wait for the activity itself
			}
			var id = String( ext[ LOCAL_ID ] || '' );
			if ( ! items[ id ] ) {
				return;
			}
			var verb = String( s.verb.id || '' ).split( '/' ).pop();
			if ( verb !== 'completed' && verb !== 'answered' ) {
				return;
			}
			if ( passed( verb, s.result || {} ) ) {
				markDone( id );
			}
		}

		// --------------------------------------------------------------------------------------------------------
		// 2. MutationObserver: the activity's own page, for the types that don't report
		// --------------------------------------------------------------------------------------------------------
		function each( root, sel, fn ) {
			Array.prototype.forEach.call( root.querySelectorAll( sel ), fn );
		}
		function visible( el ) {
			return !! el && !! ( el.offsetWidth || el.offsetHeight || el.getClientRects().length );
		}

		// Each rule: (root, state) -> true once the learner has finished. state keeps what was seen so far.
		var DOM_RULES = {
			accordion: function ( root, st, item, records ) { // every panel opened once
				st.open = st.open || {};
				var all = Array.prototype.slice.call( root.querySelectorAll( '.h5p-panel-button' ) );
				all.forEach( function ( b, k ) {
					if ( b.getAttribute( 'aria-expanded' ) === 'true' ) {
						st.open[ k ] = true;
					}
				} );
				// a panel opened and closed again between two looks: its old value says it was open
				( records || [] ).forEach( function ( r ) {
					if ( r.attributeName === 'aria-expanded' && ( r.oldValue === 'false' || r.oldValue === 'true' ) && all.indexOf( r.target ) !== -1 ) {
						st.open[ all.indexOf( r.target ) ] = true;
					}
				} );
				return all.length > 0 && Object.keys( st.open ).length >= all.length;
			},
			dialogcards: function ( root, st, item, records ) { // every card turned once, or the summary of the repetition mode shown
				st.turned = st.turned || {};
				// the cards are built as the learner goes: the total comes from the activity's settings
				if ( st.total === undefined ) {
					try {
						st.total = ( JSON.parse( item.params ).dialogs || [] ).length;
					} catch ( e ) {
						st.total = 0;
					}
				}
				var cards = Array.prototype.slice.call( root.querySelectorAll( '.h5p-dialogcards-card-content' ) );
				cards.forEach( function ( c, k ) {
					if ( c.classList.contains( 'h5p-dialogcards-turned' ) ) {
						st.turned[ k ] = true;
					}
				} );
				( records || [] ).forEach( function ( r ) {
					if ( r.attributeName === 'class' && / h5p-dialogcards-turned( |$)/.test( ' ' + ( r.oldValue || '' ) ) && cards.indexOf( r.target ) !== -1 ) {
						st.turned[ cards.indexOf( r.target ) ] = true;
					}
				} );
				var summary = root.querySelector( '.h5p-dialogcards-summary-screen' );
				if ( summary && ! summary.classList.contains( 'h5p-dialogcards-gone' ) && visible( summary ) ) {
					return true;
				}
				var total = Math.max( st.total || 0, cards.length );
				return total > 0 && Object.keys( st.turned ).length >= total;
			},
			guesstheanswer: function ( root ) { // the answer revealed
				var b = root.querySelector( '.show-solution-button' );
				return !! b && b.classList.contains( 'hidden' );
			},
			audio: function ( root, st ) { // played to the end
				return !! st.ended;
			},
			interactivevideo: function ( root, st ) { // a video with no questions: watched to the end
				return !! st.ended && maxScoreOf( st.win, st.id ) === 0;
			}
		};

		// Types we don't know: the learner worked with it (a click or key that changed it), or, when there's nothing
		// to work with, it has been on screen for two seconds.
		function generic( root, st ) {
			return !! st.engaged || !! st.seen;
		}
		function interactive( root ) {
			var found = false;
			each( root, 'button, input, select, textarea, a[href], [role="button"], [tabindex]', function ( el ) {
				if ( ! el.closest( '.h5p-actions' ) && visible( el ) ) {
					found = true;
				}
			} );
			return found;
		}

		// where an activity lives: in its frame (WordPress's usual embed) or in a div on this page
		function locate( id ) {
			var frame = document.querySelector( 'iframe.h5p-iframe[data-content-id="' + id + '"]' );
			if ( frame ) {
				var doc;
				try {
					doc = frame.contentDocument;
				} catch ( e ) {
					return null;
				}
				var r = doc && doc.querySelector( '.h5p-content' );
				return r && r.querySelector( '.h5p-container' ) ? { root: r, win: frame.contentWindow, box: frame } : null;
			}
			var div = document.querySelector( '.h5p-content[data-content-id="' + id + '"]' );
			return div && div.querySelector( '.h5p-container' ) ? { root: div, win: window, box: div } : null;
		}

		function maxScoreOf( win, id ) {
			var list = ( win.H5P && win.H5P.instances ) || [];
			for ( var k = 0; k < list.length; k++ ) {
				if ( String( list[ k ].contentId ) === String( id ) && typeof list[ k ].getMaxScore === 'function' ) {
					try {
						return list[ k ].getMaxScore();
					} catch ( e ) {
						return null;
					}
				}
			}
			return null;
		}

		function watch( id ) {
			var item = items[ id ];
			var reports = REPORTS.indexOf( item.type ) !== -1;
			var rule = DOM_RULES[ item.type ] || ( reports ? null : generic );
			if ( ! rule ) {
				return; // reports over xAPI: nothing to watch
			}
			var tries = 0;
			( function find() {
				var at = locate( id );
				if ( ! at ) {
					if ( ++tries < 240 ) {
						setTimeout( find, 250 );
					}
					return;
				}
				var st = { win: at.win, id: id };
				var root = at.root;
				function check( records ) {
					if ( ! done[ id ] && rule( root, st, item, records ) ) {
						markDone( id );
						observer.disconnect();
					}
				}
				function hookMedia() {
					each( root, 'audio, video', function ( m ) {
						if ( ! m.mcghHooked ) {
							m.mcghHooked = true;
							m.addEventListener( 'ended', function () {
								st.ended = true;
								check();
							} );
						}
					} );
				}
				var observer = new MutationObserver( function ( records ) {
					if ( st.acted && Date.now() - st.acted < 1500 ) {
						st.engaged = true; // the learner's click or key changed the activity
					}
					hookMedia();
					check( records );
				} );
				observer.observe( root, { subtree: true, childList: true, attributes: true, attributeOldValue: true, characterData: true } );
				var act = function ( e ) {
					if ( ! ( e.target && e.target.closest && e.target.closest( '.h5p-actions' ) ) ) {
						st.acted = Date.now();
					}
				};
				root.addEventListener( 'click', act, true );
				root.addEventListener( 'keydown', act, true );
				hookMedia();

				// display-only content of a type we don't know: on screen for two seconds
				if ( rule === generic && ! interactive( root ) && 'IntersectionObserver' in window ) {
					var timer = null;
					new IntersectionObserver( function ( entries ) {
						var on = entries.some( function ( en ) {
							return en.isIntersecting && en.intersectionRatio >= 0.5;
						} );
						clearTimeout( timer );
						if ( on ) {
							timer = setTimeout( function () {
								st.seen = true;
								check();
							}, 2000 );
						}
					}, { threshold: [ 0, 0.5, 1 ] } ).observe( at.box );
				}
				check();
			}() );
		}

		setLocked( true );
		watched.forEach( watch );

		// H5P's dispatcher arrives with its scripts: wait for it (up to a minute)
		var tries = 0;
		( function listen() {
			if ( window.H5P && window.H5P.externalDispatcher ) {
				window.H5P.externalDispatcher.on( 'xAPI', onXapi );
				return;
			}
			if ( ++tries < 240 ) {
				setTimeout( listen, 250 );
			} else {
				setLocked( false ); // H5P never loaded: don't leave the learner stuck
			}
		}() );
	}

	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', start );
	} else {
		start();
	}
}() );
