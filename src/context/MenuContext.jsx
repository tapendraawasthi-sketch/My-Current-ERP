import React, { createContext, useContext, useReducer, useCallback } from 'react';

const MenuContext = createContext(null);

const initialState = {
  activeMenu: null,        // 'company' | 'data' | 'exchange' | 'import' | 'export' | 'share' | 'print' | 'help' | null
  activeModal: null,       // string identifier of which modal is open, e.g. 'selectCompany'
  modalProps: {},          // props to pass to the open modal
  isGoToOpen: false,
  isSwitchToOpen: false,
  goToQuery: '',
  switchToQuery: '',
  recentActions: [],       // array of { label, screen, action } for recently used items in GoTo
};

function menuReducer(state, action) {
  switch (action.type) {
    case 'OPEN_MENU':
      return { ...state, activeMenu: action.payload, isGoToOpen: false, isSwitchToOpen: false };
    case 'CLOSE_MENU':
      return { ...state, activeMenu: null };
    case 'TOGGLE_MENU':
      return { ...state, activeMenu: state.activeMenu === action.payload ? null : action.payload };
    case 'OPEN_MODAL':
      return { ...state, activeModal: action.payload.name, modalProps: action.payload.props || {}, activeMenu: null };
    case 'CLOSE_MODAL':
      return { ...state, activeModal: null, modalProps: {} };
    case 'OPEN_GOTO':
      return { ...state, isGoToOpen: true, isSwitchToOpen: false, goToQuery: '', activeMenu: null };
    case 'CLOSE_GOTO':
      return { ...state, isGoToOpen: false, goToQuery: '' };
    case 'OPEN_SWITCHTO':
      return { ...state, isSwitchToOpen: true, isGoToOpen: false, switchToQuery: '', activeMenu: null };
    case 'CLOSE_SWITCHTO':
      return { ...state, isSwitchToOpen: false, switchToQuery: '' };
    case 'SET_GOTO_QUERY':
      return { ...state, goToQuery: action.payload };
    case 'SET_SWITCHTO_QUERY':
      return { ...state, switchToQuery: action.payload };
    case 'ADD_RECENT_ACTION':
      const filtered = state.recentActions.filter(a => a.label !== action.payload.label);
      return { ...state, recentActions: [action.payload, ...filtered].slice(0, 10) };
    case 'CLOSE_ALL':
      return { ...state, activeMenu: null, isGoToOpen: false, isSwitchToOpen: false };
    default:
      return state;
  }
}

export function MenuProvider({ children }) {
  const [state, dispatch] = useReducer(menuReducer, initialState);

  const openMenu = useCallback((menuName) => dispatch({ type: 'OPEN_MENU', payload: menuName }), []);
  const closeMenu = useCallback(() => dispatch({ type: 'CLOSE_MENU' }), []);
  const toggleMenu = useCallback((menuName) => dispatch({ type: 'TOGGLE_MENU', payload: menuName }), []);
  const openModal = useCallback((name, props = {}) => dispatch({ type: 'OPEN_MODAL', payload: { name, props } }), []);
  const closeModal = useCallback(() => dispatch({ type: 'CLOSE_MODAL' }), []);
  const openGoTo = useCallback(() => dispatch({ type: 'OPEN_GOTO' }), []);
  const closeGoTo = useCallback(() => dispatch({ type: 'CLOSE_GOTO' }), []);
  const openSwitchTo = useCallback(() => dispatch({ type: 'OPEN_SWITCHTO' }), []);
  const closeSwitchTo = useCallback(() => dispatch({ type: 'CLOSE_SWITCHTO' }), []);
  const setGoToQuery = useCallback((q) => dispatch({ type: 'SET_GOTO_QUERY', payload: q }), []);
  const setSwitchToQuery = useCallback((q) => dispatch({ type: 'SET_SWITCHTO_QUERY', payload: q }), []);
  const addRecentAction = useCallback((action) => dispatch({ type: 'ADD_RECENT_ACTION', payload: action }), []);
  const closeAll = useCallback(() => dispatch({ type: 'CLOSE_ALL' }), []);

  return (
    <MenuContext.Provider value={{
      ...state,
      openMenu, closeMenu, toggleMenu,
      openModal, closeModal,
      openGoTo, closeGoTo,
      openSwitchTo, closeSwitchTo,
      setGoToQuery, setSwitchToQuery,
      addRecentAction, closeAll,
      dispatch,
    }}>
      {children}
    </MenuContext.Provider>
  );
}

export function useMenu() {
  const context = useContext(MenuContext);
  if (!context) throw new Error('useMenu must be used inside MenuProvider');
  return context;
}

export default MenuContext;
