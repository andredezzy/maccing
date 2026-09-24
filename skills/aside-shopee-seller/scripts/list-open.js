/**
 * shpListOpen() tells whether an option list is open. An open list sits at the
 * end of the snapshot tree as a top-level "- list:".
 *
 * Needs: no other helper.
 */

globalThis.shpListOpen = (tree) => /\n- list:/.test(tree);
