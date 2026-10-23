import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000";

export const fetchDashboard = createAsyncThunk(
  "courses/fetchDashboard",
  async () => {
    const response = await fetch(`${API_BASE_URL}/api/dashboard`);
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(payload?.error ?? "Unable to load your learning dashboard.");
    }
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
    completeNextLesson(state, action) {
      const course = state.courses.find((item) => item.id === action.payload);
      if (!course || course.lessonsComplete >= course.lessonsTotal) return;
      course.lessonsComplete += 1;
      course.progress = Math.round((course.lessonsComplete / course.lessonsTotal) * 100);
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

export const { setCategory, setSearch, setActivePage, completeNextLesson } = coursesSlice.actions;
export default coursesSlice.reducer;
