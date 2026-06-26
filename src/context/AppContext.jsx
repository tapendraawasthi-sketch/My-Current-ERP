import React, { createContext, useContext, useReducer, useCallback } from 'react';

const AppContext = createContext(null);

const initialState = {
  activeCompany: null,         // { id, name, financialYear, gstin, currency, features: {} }
  currentUser: null,           // { id, username, fullName, role, permissions: [] }
  currentScreen: 'dashboard',  // string: 'dashboard' | 'ledger' | 'balanceSheet' | 'salesVoucher' | etc.
  currentDocument: null,       // { type: 'voucher'|'report'|'master', id, name, data: {} }
  hasUnsavedChanges: false,
  openedCompanies: [],         // array of company objects for multi-company mode
  isLoading: false,
  error: null,
  permissions: {},             // { canCreateCompany: bool, canBackup: bool, ... }
};

function appReducer(state, action) {
  switch (action.type) {
    case 'SET_ACTIVE_COMPANY':
      return { ...state, activeCompany: action.payload, hasUnsavedChanges: false };
    case 'SET_CURRENT_USER':
      return { ...state, currentUser: action.payload, permissions: action.payload?.permissions || {} };
    case 'SET_CURRENT_SCREEN':
      return { ...state, currentScreen: action.payload.screen, currentDocument: action.payload.document || null };
    case 'SET_UNSAVED_CHANGES':
      return { ...state, hasUnsavedChanges: action.payload };
    case 'ADD_OPENED_COMPANY':
      return {
        ...state,
        openedCompanies: [...state.openedCompanies.filter(c => c.id !== action.payload.id), action.payload],
      };
    case 'REMOVE_OPENED_COMPANY':
      return {
        ...state,
        openedCompanies: state.openedCompanies.filter(c => c.id !== action.payload),
        activeCompany: state.activeCompany?.id === action.payload ? null : state.activeCompany,
      };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'CLEAR_COMPANY':
      return { ...state, activeCompany: null, hasUnsavedChanges: false, currentDocument: null };
    default:
      return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  const setActiveCompany = useCallback((company) => {
    dispatch({ type: 'SET_ACTIVE_COMPANY', payload: company });
  }, []);

  const setCurrentUser = useCallback((user) => {
    dispatch({ type: 'SET_CURRENT_USER', payload: user });
  }, []);

  const setCurrentScreen = useCallback((screen, document = null) => {
    dispatch({ type: 'SET_CURRENT_SCREEN', payload: { screen, document } });
  }, []);

  const setUnsavedChanges = useCallback((value) => {
    dispatch({ type: 'SET_UNSAVED_CHANGES', payload: value });
  }, []);

  const shutCompany = useCallback((companyId) => {
    dispatch({ type: 'REMOVE_OPENED_COMPANY', payload: companyId });
  }, []);

  const addOpenedCompany = useCallback((company) => {
    dispatch({ type: 'ADD_OPENED_COMPANY', payload: company });
  }, []);

  const clearCompany = useCallback(() => {
    dispatch({ type: 'CLEAR_COMPANY' });
  }, []);

  const setLoading = useCallback((val) => dispatch({ type: 'SET_LOADING', payload: val }), []);
  const setError = useCallback((err) => dispatch({ type: 'SET_ERROR', payload: err }), []);

  return (
    <AppContext.Provider value={{
      ...state,
      setActiveCompany,
      setCurrentUser,
      setCurrentScreen,
      setUnsavedChanges,
      shutCompany,
      addOpenedCompany,
      clearCompany,
      setLoading,
      setError,
      dispatch,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used inside AppProvider');
  return context;
}

export default AppContext;
