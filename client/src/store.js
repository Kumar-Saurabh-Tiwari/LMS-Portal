import { configureStore } from "@reduxjs/toolkit";
import coursesReducer from "./features/coursesSlice.js";

export const store = configureStore({
  reducer: {
    courses: coursesReducer,
  },
});
