import { useEffect, useReducer } from "react";
import type { CartLine } from "../../../shared/contracts.js";
import { cartStorageKey, decodeStoredCart, encodeStoredCart, validateCartLines } from "../lib/cart-state.js";

export interface StorageNotice {
  kind: "corrupt" | "unavailable" | "unsaved" | "temporary";
  message: string;
}

interface DraftEntry {
  items: CartLine[];
  ready: boolean;
  persistent: boolean;
  dirty: boolean;
  version: number;
  notice: StorageNotice | null;
}

type Drafts = Record<string, DraftEntry>;
type Action =
  | { type: "loaded"; customerId: string; entry: DraftEntry }
  | { type: "change"; customerId: string; items: CartLine[] }
  | { type: "saved"; customerId: string; version: number; error: string | null }
  | { type: "recover"; customerId: string; temporary: boolean }
  | { type: "retry"; customerId: string };

function reducer(state: Drafts, action: Action): Drafts {
  const current = state[action.customerId];
  switch (action.type) {
    case "loaded":
      return current ? state : { ...state, [action.customerId]: action.entry };
    case "change":
      if (!current?.ready) return state;
      return {
        ...state,
        [action.customerId]: { ...current, items: action.items, dirty: current.persistent, version: current.version + 1 },
      };
    case "saved":
      if (!current || current.version !== action.version) return state;
      return {
        ...state,
        [action.customerId]: {
          ...current,
          dirty: false,
          notice: action.error ? {
            kind: "unsaved",
            message: `Your draft changed in this tab, but browser storage could not be updated. An older draft may return after reloading. ${action.error}`,
          } : null,
        },
      };
    case "recover":
      return {
        ...state,
        [action.customerId]: {
          items: [],
          ready: true,
          persistent: !action.temporary,
          dirty: !action.temporary,
          version: (current?.version ?? 0) + 1,
          notice: action.temporary ? {
            kind: "temporary",
            message: "This is a temporary cart, kept only in this tab. A previously saved draft may still exist and return after reloading.",
          } : null,
        },
      };
    case "retry": {
      if (!current) return state;
      if (current.ready) {
        return { ...state, [action.customerId]: { ...current, dirty: true, persistent: true, version: current.version + 1 } };
      }
      const next = { ...state };
      delete next[action.customerId];
      return next;
    }
  }
}

function storageError(error: unknown): string {
  return error instanceof Error ? error.message : "The browser did not provide an error description.";
}

export function useDraftCarts(customerId: string) {
  const [drafts, dispatch] = useReducer(reducer, {});

  useEffect(() => {
    if (!customerId || drafts[customerId]) return;
    let entry: DraftEntry;
    try {
      const restored = decodeStoredCart(window.localStorage.getItem(cartStorageKey(customerId)));
      entry = {
        items: restored.ok ? restored.items : [],
        ready: restored.ok,
        persistent: true,
        dirty: false,
        version: 0,
        notice: restored.ok ? null : {
          kind: "corrupt",
          message: `${restored.message} Nothing has been overwritten. Reset this customer's saved draft to start again.`,
        },
      };
    } catch (error) {
      entry = {
        items: [],
        ready: false,
        persistent: false,
        dirty: false,
        version: 0,
        notice: {
          kind: "unavailable",
          message: `This customer's saved cart could not be opened. Retry, or explicitly start a temporary cart. ${storageError(error)}`,
        },
      };
    }
    dispatch({ type: "loaded", customerId, entry });
  }, [customerId, drafts]);

  useEffect(() => {
    for (const [id, draft] of Object.entries(drafts)) {
      if (!draft.dirty || !draft.persistent) continue;
      let error: string | null = null;
      try {
        if (draft.items.length === 0) window.localStorage.removeItem(cartStorageKey(id));
        else window.localStorage.setItem(cartStorageKey(id), encodeStoredCart(draft.items));
      } catch (failure) {
        error = storageError(failure);
      }
      dispatch({ type: "saved", customerId: id, version: draft.version, error });
    }
  }, [drafts]);

  const active = drafts[customerId];
  return {
    items: active?.items ?? [],
    ready: active?.ready ?? false,
    loading: Boolean(customerId) && active === undefined,
    notice: active?.notice ?? null,
    replace: (id: string, items: CartLine[]) => {
      if (!drafts[id]?.ready) throw new Error("Recover this customer's saved cart before making changes.");
      if (!validateCartLines(items)) throw new Error("The draft contains invalid items or quantities.");
      dispatch({ type: "change", customerId: id, items });
    },
    reset: () => dispatch({ type: "recover", customerId, temporary: false }),
    useTemporary: () => dispatch({ type: "recover", customerId, temporary: true }),
    retryStorage: () => dispatch({ type: "retry", customerId }),
  };
}
