/**
 * Mark Complete Gate for H5P in LearnDash.
 *
 * When the page has H5P content, LearnDash's Mark Complete button is locked until every H5P activity on the page is
 * completed. Completion comes from H5P's own xAPI events (which H5P passes up to this page even from its iframes):
 * an activity counts when it reports "completed" or "answered" and, if it's scored, passed (result.success).
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

	function buttons() {
		return Array.prototype.slice.call( document.querySelectorAll( BUTTONS ) );
	}

	function format( s, a, b ) {
		return String( s || '' ).replace( '%1$d', a ).replace( '%2$d', b );
	}

	function start() {
		var contents = ( window.H5PIntegration && window.H5PIntegration.contents ) || {};
		var ignore = ( TEXT.ignore || [] ).map( String ); // [mark_complete_gate ignore="..."]
		var needed = Object.keys( contents ).map( function ( k ) {
			return String( k ).replace( 'cid-', '' );
		} ).filter( function ( id ) {
			return ignore.indexOf( id ) === -1;
		} );
		if ( ! needed.length || ! buttons().length ) {
			return; // no H5P here (or no button): leave the page alone
		}

		var done = {};
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
			if ( message ) {
				message.hidden = ! locked;
				message.textContent = locked && needed.length > 1 && Object.keys( done ).length
					? ( TEXT.message || '' ) + ' ' + format( TEXT.progress, Object.keys( done ).length, needed.length )
					: ( TEXT.message || '' );
			}
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
			if ( needed.indexOf( id ) === -1 ) {
				return;
			}
			var verb = String( s.verb.id || '' ).split( '/' ).pop();
			if ( verb !== 'completed' && verb !== 'answered' ) {
				return;
			}
			var r = s.result || {};
			var passed = r.success === true || ( r.success === undefined && ( verb === 'completed' || r.completion === true ) );
			if ( ! passed ) {
				return; // scored and not passed: the learner can retry
			}
			done[ id ] = true;
			var all = needed.every( function ( n ) {
				return done[ n ];
			} );
			setLocked( ! all );
		}

		setLocked( true );

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
