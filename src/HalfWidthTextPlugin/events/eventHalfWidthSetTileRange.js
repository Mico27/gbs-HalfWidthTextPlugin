const id = "EVENT_HWT_SET_TILE_RANGE";
const name = "Half-Width Text: Set Tile Range";
const groups = ["EVENT_GROUP_DIALOGUE"];
const autoLabel = (fetchArg) => {
  return `Half-Width Text: Set Tile Range (${fetchArg("firstTile")} - ${fetchArg(
    "lastTile"
  )})`;
};
const fields = [
  {
    type: "label",
    label:
      "Sets the VRAM background tile range reserved for composed character-pair tiles and resets the cache. At most 64 tiles are used.",
  },
  {
    key: "firstTile",
    label: "First Tile (0-255)",
    type: "number",
    min: 0,
    max: 255,
    width: "50%",
    defaultValue: 128,
  },
  {
    key: "lastTile",
    label: "Last Tile (0-255)",
    type: "number",
    min: 0,
    max: 255,
    width: "50%",
    defaultValue: 191,
  },
];
const compile = (input, helpers) => {
  const { _callNative, _addComment, _addNL, _stackPushConst, _stackPop } =
    helpers;
  _addComment("Half-Width Text: Set Tile Range");
  _stackPushConst(input.firstTile);
  _stackPushConst(input.lastTile);
  _callNative("hwt_set_tile_range");
  _stackPop(2);
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
