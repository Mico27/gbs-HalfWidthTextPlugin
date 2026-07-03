const id = "EVENT_HWT_RESET_CACHE";
const name = "Half-Width Text: Reset Tile Cache";
const groups = ["EVENT_GROUP_DIALOGUE"];
const autoLabel = (fetchArg) => {
  return `Half-Width Text: Reset Tile Cache`;
};
const fields = [
  {
    type: "label",
    label:
      "Forgets all cached character-pair tiles. Call this in each scene's On Init (or after anything that reloads background tiles) so stale tiles are not reused.",
  },
];
const compile = (input, helpers) => {
  const { _callNative, _addComment, _addNL } = helpers;
  _addComment("Half-Width Text: Reset Tile Cache");
  _callNative("hwt_reset_cache");
  _addNL();
};
module.exports = {
  id,
  name,
  autoLabel,
  groups,
  fields,
  compile,
  waitUntilAfterInitFade: false,
};
