export type Shape = "ls" | "ss" | "jacket" | "vest" | "tie" | "hanger" | "pants" | "shoe" | "belt" | "watch";
export type Tone = "black" | "brown" | "any";

export interface Item {
  id: string;
  name: string;
  note?: string;
  color: string;
  shape: Shape;
  stroke?: string;
  kind?: "shirt" | "sweat" | "tee" | "jeans";
  sleeve?: "long" | "short";
  family?: "purple";
  suit?: boolean;
  sole?: string;
  tone?: Tone;
}

export interface Look {
  top: string;
  layer: string;
  vest: string;
  bottom: string;
  shoes: string;
  belt: string;
  watch: string;
  tie: string;
}

/** Id stored in an optional slot (jacket, waistcoat, tie) when nothing is worn. */
export const NONE = "none";

export const PATHS: Record<Shape, string> = {
  ls: "M17 6 L24 9 L31 6 L41 11 L46 32 L40 33 L35 18 L35 44 L13 44 L13 18 L8 33 L2 32 L7 11 Z",
  ss: "M17 7 L24 10 L31 7 L42 12 L39 21 L34 19 L34 43 L14 43 L14 19 L9 21 L6 12 Z",
  jacket: "M17 6 L24 22 L31 6 L41 11 L46 32 L40 33 L35 18 L35 44 L13 44 L13 18 L8 33 L2 32 L7 11 Z",
  vest: "M15 5 L20 5 L24 22 L28 5 L33 5 L37 13 L37 40 L28 45 L24 41 L20 45 L11 40 L11 13 Z",
  tie: "M20 4 H28 L26.5 10 L31 34 L24 43 L17 34 L21.5 10 Z",
  hanger: "M24 14 a4 4 0 1 1 4 -4 M24 14 L24 18 L5 32 L43 32 L24 18",
  pants: "M13 5 L35 5 L37 44 L27 44 L24 16 L21 44 L11 44 Z",
  shoe: "M4 34 L4 24 Q4 20 8 21 L18 25 Q24 27 32 27 L40 28 Q45 29 45 34 L45 37 L4 37 Z",
  belt: "M2 21 H30 V18 H38 V30 H30 V27 H2 Z",
  watch: "M19 3 H29 V15 H19 Z M17 15 H31 V33 H17 Z M19 33 H29 V45 H19 Z",
};

export const TOPS: Item[] = [
  { id: "shirt-white", name: "White shirt", note: "Long sleeve", color: "#F7F7F5", kind: "shirt", sleeve: "long", shape: "ls" },
  { id: "shirt-white-2", name: "White shirt 2", note: "Long sleeve", color: "#FBFBF9", kind: "shirt", sleeve: "long", shape: "ls" },
  { id: "shirt-lblue", name: "Light blue shirt", note: "Long sleeve", color: "#A9C8E8", kind: "shirt", sleeve: "long", shape: "ls" },
  { id: "shirt-purple", name: "Purple shirt", note: "Long sleeve", color: "#6B4C9A", kind: "shirt", sleeve: "long", shape: "ls", family: "purple" },
  { id: "shirt-olive", name: "Olive shirt", note: "Long sleeve", color: "#5F6B3A", kind: "shirt", sleeve: "long", shape: "ls" },
  { id: "shirt-carton", name: "Carton shirt", note: "Long sleeve", color: "#B98A57", kind: "shirt", sleeve: "long", shape: "ls" },
  { id: "shirt-blue-ss", name: "Blue shirt", note: "Short sleeve", color: "#3E6FB0", kind: "shirt", sleeve: "short", shape: "ss" },
  { id: "sweat-cream", name: "Cream sweatshirt", note: "Sweatshirt", color: "#EDE3CF", kind: "sweat", sleeve: "long", shape: "ls" },
  { id: "sweat-black", name: "Black sweatshirt", note: "Sweatshirt", color: "#1E1E20", kind: "sweat", sleeve: "long", shape: "ls" },
  { id: "tee-white", name: "White tee", note: "Round neck", color: "#FAFAFA", kind: "tee", sleeve: "short", shape: "ss" },
  { id: "tee-brown", name: "Brown tee", note: "Round neck", color: "#7A5236", kind: "tee", sleeve: "short", shape: "ss" },
  { id: "tee-cotton", name: "Cotton tee", note: "Round neck", color: "#E6DCC8", kind: "tee", sleeve: "short", shape: "ss" },
];

export const JACKETS: Item[] = [
  { id: "jacket-cream", name: "Cream jacket", note: "Suit", color: "#E9DFC9", shape: "jacket" },
];

export const VESTS: Item[] = [
  { id: "vest-black", name: "Black waistcoat", note: "Waistcoat", color: "#1C1C1E", shape: "vest" },
  { id: "vest-grey", name: "Grey waistcoat", note: "Waistcoat", color: "#7D7F83", shape: "vest" },
];

export const BOTTOMS: Item[] = [
  { id: "tr-black", name: "Black", note: "Trousers", color: "#1A1A1C", shape: "pants" },
  { id: "tr-navy", name: "Navy", note: "Trousers", color: "#1F2A44", shape: "pants" },
  { id: "tr-ash", name: "Ash", note: "Trousers", color: "#B9B4AA", shape: "pants" },
  { id: "tr-purple", name: "Purple", note: "Trousers", color: "#5A3F80", shape: "pants", family: "purple" },
  { id: "tr-cream", name: "Cream", note: "Suit trousers", color: "#E9DFC9", shape: "pants", suit: true },
  { id: "jeans", name: "Blue jeans", note: "Denim", color: "#3B5A80", shape: "pants", kind: "jeans" },
];

export const SHOES: Item[] = [
  { id: "shoe-black", name: "Black shoes", note: "Formal", color: "#141414", sole: "#141414", tone: "black", shape: "shoe" },
  { id: "shoe-loafer", name: "Brown loafers", note: "Smart", color: "#6B3F22", sole: "#3A2414", tone: "brown", shape: "shoe" },
  { id: "shoe-white", name: "White sneakers", note: "Casual", color: "#F4F4F2", sole: "#FFFFFF", tone: "any", shape: "shoe" },
  { id: "shoe-nb", name: "New Balance", note: "Blue-grey", color: "#7F8C99", sole: "#EDEDED", tone: "any", shape: "shoe" },
];

export const BELTS: Item[] = [
  { id: "belt-black", name: "Black belt", color: "#1A1A1A", tone: "black", shape: "belt" },
  { id: "belt-brown", name: "Brown belt", color: "#6B3F22", tone: "brown", shape: "belt" },
];

export const WATCHES: Item[] = [
  { id: "watch-black", name: "Black watch", color: "#1A1A1A", tone: "black", shape: "watch" },
  { id: "watch-brown", name: "Brown watch", color: "#7A4A2A", tone: "brown", shape: "watch" },
];

export const TIES: Item[] = [
  { id: "tie-navy", name: "Navy tie", color: "#22305A", shape: "tie" },
  { id: "tie-burgundy", name: "Burgundy tie", color: "#6D1F2C", shape: "tie" },
  { id: "tie-black", name: "Black tie", color: "#151517", shape: "tie" },
];

export const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

function L(top: string, layer: string, bottom: string, shoes: string, tone: "black" | "brown", vest = NONE, tie = NONE): Look {
  return { top, layer, vest, bottom, shoes, belt: "belt-" + tone, watch: "watch-" + tone, tie };
}

export const LOOKS: Look[][] = [
  [
    L("shirt-lblue", "jacket-cream", "tr-cream", "shoe-loafer", "brown"),
    L("shirt-lblue", NONE, "tr-ash", "shoe-loafer", "brown"),
    L("shirt-purple", NONE, "tr-black", "shoe-black", "black"),
    L("shirt-white", NONE, "tr-purple", "shoe-black", "black"),
    L("tee-brown", "jacket-cream", "jeans", "shoe-white", "brown"),
  ],
  [
    L("shirt-lblue", NONE, "tr-navy", "shoe-loafer", "brown"),
    L("shirt-purple", NONE, "tr-ash", "shoe-black", "black"),
    L("shirt-purple", NONE, "tr-cream", "shoe-loafer", "brown"),
    L("shirt-white", "jacket-cream", "tr-navy", "shoe-loafer", "brown"),
    L("tee-brown", NONE, "jeans", "shoe-nb", "brown"),
  ],
  [
    L("shirt-white", "jacket-cream", "tr-cream", "shoe-loafer", "brown"),
    L("shirt-lblue", NONE, "tr-black", "shoe-black", "black"),
    L("shirt-white", NONE, "tr-purple", "shoe-loafer", "brown"),
    L("sweat-black", NONE, "tr-ash", "shoe-white", "brown"),
    L("tee-white", NONE, "tr-cream", "shoe-nb", "brown"),
  ],
  [
    L("shirt-white-2", NONE, "tr-navy", "shoe-loafer", "brown", "vest-grey", "tie-burgundy"),
    L("shirt-olive", NONE, "tr-cream", "shoe-loafer", "brown"),
    L("shirt-carton", NONE, "tr-navy", "shoe-loafer", "brown"),
    L("shirt-white", NONE, "tr-black", "shoe-black", "black", "vest-black", "tie-black"),
    L("shirt-olive", NONE, "jeans", "shoe-white", "brown"),
  ],
];

export function find(list: Item[], id: string): Item {
  return list.find((it) => it.id === id) ?? list[0];
}

/** Lookup for optional slots: undefined when nothing (or an unknown id) is worn. */
export function findOpt(list: Item[], id: string): Item | undefined {
  return list.find((it) => it.id === id);
}
