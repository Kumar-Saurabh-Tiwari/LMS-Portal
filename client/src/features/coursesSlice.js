import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { apiRequest } from "../api.js";

export const fetchDashboard = createAsyncThunk(
  "courses/fetchDashboard",
  async (_, { getState }) => {
    const payload = await apiRequest("/dashboard", { token: getState().auth.token });
    if (!Array.isArray(payload?.courses) || !Array.isArray(payload?.liveClasses)) {
      throw new Error("The dashboard response is incomplete. Please try again.");
    }

    return payload;
  },
  {
    condition: (_, { getState }) => {
      const status = getState().courses.status;
      return status !== "loading" && status !== "succeeded";
    },
  }
);

const initialState = {
  activeCategory: "All courses",
  search: "",
  activePage: "Overview",
  courses: [],
  liveClasses: [],
  status: "idle",
  error: null,
};

const coursesSlice = createSlice({
  name: "courses",
  initialState,
  reducers: {
    setCategory(state, action) {
      state.activeCategory = action.payload;
    },
    setSearch(state, action) {
      state.search = action.payload;
    },
    setActivePage(state, action) {
      state.activePage = action.payload;
    },
    resetDashboard(state) {
      state.status = "idle";
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDashboard.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(fetchDashboard.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.courses = action.payload.courses;
        state.liveClasses = action.payload.liveClasses;
      })
      .addCase(fetchDashboard.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.error.message ?? "Unable to load your learning dashboard.";
      });
  },
});

export const { setCategory, setSearch, setActivePage, resetDashboard } = coursesSlice.actions;
export default coursesSlice.reducer;
