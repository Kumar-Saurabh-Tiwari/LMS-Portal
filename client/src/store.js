import { configureStore } from "@reduxjs/toolkit";
import coursesReducer from "./features/coursesSlice.js";
import authReducer from "./features/authSlice.js";

export const store = configureStore({
  reducer: {
    courses: coursesReducer,
    auth: authReducer,
  },
});
