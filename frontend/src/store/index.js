import { configureStore, createSlice } from '@reduxjs/toolkit';

// Safe JSON parser for localStorage
const getLocalStorageUser = () => {
  try {
    const u = localStorage.getItem('user');
    return u ? JSON.parse(u) : null;
  } catch (err) {
    return null;
  }
};

// Auth Slice
const authSlice = createSlice({
  name: 'auth',
  initialState: {
    token: localStorage.getItem('token') || null,
    user: getLocalStorageUser(),
    isAuthenticated: !!localStorage.getItem('token') && !!localStorage.getItem('user')
  },
  reducers: {
    loginSuccess: (state, action) => {
      state.token = action.payload.token;
      state.user = action.payload.user;
      state.isAuthenticated = true;
      localStorage.setItem('token', action.payload.token);
      localStorage.setItem('user', JSON.stringify(action.payload.user));
    },
    logout: (state) => {
      state.token = null;
      state.user = null;
      state.isAuthenticated = false;
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
  }
});

// Reports Slice
const reportsSlice = createSlice({
  name: 'reports',
  initialState: {
    list: [],
    selectedReport: null,
    loading: false,
    error: null
  },
  reducers: {
    setReports: (state, action) => {
      state.list = action.payload;
    },
    selectReport: (state, action) => {
      state.selectedReport = action.payload;
    },
    updateReportStatus: (state, action) => {
      const idx = state.list.findIndex(r => r._id === action.payload.reportId);
      if (idx !== -1) {
        state.list[idx].status = action.payload.status;
      }
      if (state.selectedReport && state.selectedReport._id === action.payload.reportId) {
        state.selectedReport.status = action.payload.status;
      }
    },
    setLoading: (state, action) => {
      state.loading = action.payload;
    },
    setError: (state, action) => {
      state.error = action.payload;
    }
  }
});

export const { loginSuccess, logout } = authSlice.actions;
export const { setReports, selectReport, updateReportStatus, setLoading, setError } = reportsSlice.actions;

export const store = configureStore({
  reducer: {
    auth: authSlice.reducer,
    reports: reportsSlice.reducer
  }
});
