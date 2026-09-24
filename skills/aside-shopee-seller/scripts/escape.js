/**
 * shpEscape() escapes a label or option for use inside a RegExp.
 *
 * Needs: no other helper.
 */

globalThis.shpEscape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
