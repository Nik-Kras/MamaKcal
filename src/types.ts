export type Unit = "g" | "pcs";

/** A product in the picker: from the MacroTrack spreadsheet, or one she added. */
export interface Food {
  id: string;
  /** Ukrainian name, shown to her. */
  name: string;
  /** English name and aliases: what the photo model's answers are matched against. */
  nameEn?: string;
  aliases?: string[];
  /** Ukrainian aliases, for search. */
  aliasesUa?: string[];
  /** kcal per 100 g, as served. */
  kcal100: number;
  /** Grams in one piece. Set only for foods counted in pieces (eggs, varenyky…). */
  pcGrams?: number;
  custom?: boolean;
}

/**
 * One line of a meal. Values are a snapshot taken when the meal is made, so
 * later changes to the food list never rewrite what she already logged.
 */
export interface Item {
  key: string;
  /** The food this line is; missing while an unrecognised line waits for her pick. */
  foodId?: string;
  name: string;
  kcal100: number;
  pcGrams?: number;
  unit: Unit;
  /** Digits only, as typed. Grams for "g", a count for "pcs". */
  amount: string;
  /** false = the model's guess ("на око"), true = she weighed or set it. */
  weighed: boolean;
  /** What the photo model called this food, in English. Used to learn from her corrections. */
  aiName?: string;
  /** The food the app matched that name to; differs from foodId once she corrected it. */
  aiFoodId?: string;
  /** The model named something that matches no food: she has to pick one or remove the line. */
  unknown?: boolean;
}

export interface Meal {
  id: string;
  /** Local day, YYYY-MM-DD. */
  date: string;
  /** Local time, HH:mm. */
  time: string;
  dishName: string;
  /** file:// URI of the stored photo. */
  photo?: string;
  items: Item[];
  createdAt: number;
}

/** The meal being checked on the review screen. */
export interface Draft {
  /** Identifies this draft, so a screen only clears its own. */
  id: string;
  /** Set when editing an already logged meal. */
  mealId?: string;
  photo?: string;
  dishName: string;
  items: Item[];
  /** true once she changed anything, so Back can warn before discarding. */
  dirty: boolean;
}

export interface Settings {
  /** Daily calorie target. */
  norm: number;
}
