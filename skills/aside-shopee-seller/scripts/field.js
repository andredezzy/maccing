/**
 * shpField() finds the field under a label in a snapshot tree. Returns
 * { multi, role, shows, ref }, or null.
 *
 * The label is matched as the end of a text node: the first attribute's label
 * shares a node with the section header, and a multi-select's label ends in a
 * counter such as " 1/5".
 *
 * Needs: escape.js.
 */

globalThis.shpField = (tree, label) => {
  const m = tree.match(new RegExp(`${shpEscape(label)}( \\d+/\\d+)?"\\n\\s*- (\\w+) "([^"]*)" \\[ref=(e\\d+)\\]`));
  return m && { multi: Boolean(m[1]), role: m[2], shows: m[3], ref: m[4] };
};
