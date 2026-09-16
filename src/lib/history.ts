export interface HistoryState<T> {
    past: T[];
    present: T;
    future: T[];
    transaction: {
        before: T;
    } | null;
}
export type HistoryAction<T> = {
    type: 'set' | 'preview' | 'reset';
    value: T;
} | {
    type: 'undo' | 'redo' | 'begin' | 'commit' | 'cancel';
};
const HISTORY_LIMIT = 60;
export function initialHistory<T>(present: T): HistoryState<T> {
    return { past: [], present, future: [], transaction: null };
}
/** Gestures form one undo step; cancelled gestures never alter the undo stack. */
export function historyReducer<T>(state: HistoryState<T>, action: HistoryAction<T>): HistoryState<T> {
    switch (action.type) {
        case 'set': {
            const before = state.transaction ? state.transaction.before : state.present;
            if (Object.is(before, action.value))
                return { ...state, present: action.value, transaction: null };
            return { past: [...state.past, before].slice(-HISTORY_LIMIT), present: action.value, future: [], transaction: null };
        }
        case 'preview': return state.transaction ? { ...state, present: action.value } : state;
        case 'reset': return initialHistory(action.value);
        case 'begin': return state.transaction ? state : { ...state, transaction: { before: state.present } };
        case 'commit': {
            if (!state.transaction)
                return state;
            const before = state.transaction.before;
            if (Object.is(before, state.present))
                return { ...state, transaction: null };
            return { past: [...state.past, before].slice(-HISTORY_LIMIT), present: state.present, future: [], transaction: null };
        }
        case 'cancel': return state.transaction ? { ...state, present: state.transaction.before, transaction: null } : state;
        case 'undo': {
            if (state.transaction)
                return { ...state, present: state.transaction.before, transaction: null };
            if (!state.past.length)
                return state;
            return { past: state.past.slice(0, -1), present: state.past[state.past.length - 1], future: [state.present, ...state.future].slice(0, HISTORY_LIMIT), transaction: null };
        }
        case 'redo': {
            if (state.transaction || !state.future.length)
                return state;
            return { past: [...state.past, state.present].slice(-HISTORY_LIMIT), present: state.future[0], future: state.future.slice(1), transaction: null };
        }
    }
}
