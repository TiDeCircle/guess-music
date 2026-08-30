import type { CategoryId } from "@/shared/types";
import { THAI_ARTISTS } from "./thai";
import { INTL_ARTISTS } from "./intl";
import { KPOP_ARTISTS } from "./kpop";

export type CategoryDef = {
  id: CategoryId;
  /** Storefront to search. Thai acts are only properly indexed under TH. */
  country: string;
  artists: readonly string[];
};

export const CATEGORIES: Record<CategoryId, CategoryDef> = {
  thai: { id: "thai", country: "TH", artists: THAI_ARTISTS },
  intl: { id: "intl", country: "TH", artists: INTL_ARTISTS },
  kpop: { id: "kpop", country: "TH", artists: KPOP_ARTISTS },
};

export const CATEGORY_ORDER: CategoryId[] = ["thai", "intl", "kpop"];
export const DEFAULT_CATEGORY: CategoryId = "thai";
