import { useCallback, useReducer } from 'react';
import { historyReducer, initialHistory } from '../lib/history';
export { historyReducer } from '../lib/history';
export function useHistory<T>(initial: T) {
    const [state, dispatch] = useReducer(historyReducer<T>, initial, initialHistory<T>);
    return {
        value: state.present, canUndo: !!state.past.length, canRedo: !!state.future.length,
        set: useCallback((value: T) => dispatch({ type: 'set', value }), []),
        preview: useCallback((value: T) => dispatch({ type: 'preview', value }), []),
        reset: useCallback((value: T) => dispatch({ type: 'reset', value }), []),
        begin: useCallback(() => dispatch({ type: 'begin' }), []),
        commit: useCallback(() => dispatch({ type: 'commit' }), []),
        cancel: useCallback(() => dispatch({ type: 'cancel' }), []),
        undo: useCallback(() => dispatch({ type: 'undo' }), []),
        redo: useCallback(() => dispatch({ type: 'redo' }), []),
    };
}
