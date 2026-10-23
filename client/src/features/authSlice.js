import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { apiRequest } from "../api.js";

const storedToken = typeof sessionStorage === "undefined" ? null : sessionStorage.getItem("lms-token");

export const authenticate = createAsyncThunk("auth/authenticate", async (credentials) => {
  const payload = await apiRequest(`/auth/${credentials.mode}`, {
    method: "POST",
    body: JSON.stringify(credentials),
  });
  if (typeof sessionStorage !== "undefined") sessionStorage.setItem("lms-token", payload.token);
  return payload;
});

export const restoreSession = createAsyncThunk("auth/restoreSession", async (_, { getState, rejectWithValue }) => {
  try {
    const payload = await apiRequest("/auth/me", { token: getState().auth.token });
    return payload.user;
  } catch (error) {
    const clearToken = error.status === 401;
    if (clearToken && typeof sessionStorage !== "undefined") sessionStorage.removeItem("lms-token");
    return rejectWithValue({ message: error.message, clearToken });
  }
});

const authSlice = createSlice({
  name: "auth",
  initialState: {
    token: storedToken,
    user: null,
    status: "idle",
    error: null,
  },
  reducers: {
    signOut(state) {
      state.token = null;
      state.user = null;
      state.status = "idle";
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(authenticate.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(authenticate.fulfilled, (state, action) => {
        state.token = action.payload.token;
        state.user = action.payload.user;
        state.status = "succeeded";
      })
      .addCase(authenticate.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.error.message ?? "Unable to authenticate.";
      })
      .addCase(restoreSession.fulfilled, (state, action) => {
        state.user = action.payload;
        state.status = "succeeded";
        state.error = null;
      })
      .addCase(restoreSession.rejected, (state, action) => {
        if (action.payload?.clearToken) {
          state.token = null;
          state.user = null;
        }
        state.status = "failed";
        state.error = action.payload?.message ?? action.error.message ?? "Unable to restore your session.";
      });
  },
});

export const { signOut } = authSlice.actions;
export default authSlice.reducer;
