import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  activeCategory: "All courses",
  search: "",
  activePage: "Overview",
  courses: [
    {
      id: "product-design",
      title: "Product Design",
      subtitle: "From idea to interface",
      instructor: "Olivia Rhye",
      category: "Design",
      progress: 68,
      lessonsComplete: 12,
      lessonsTotal: 18,
      accent: "lavender",
      artwork: "✳",
      nextLesson: "Design systems that scale",
    },
    {
      id: "javascript",
      title: "JavaScript Mastery",
      subtitle: "Build for the modern web",
      instructor: "Lana Steiner",
      category: "Development",
      progress: 42,
      lessonsComplete: 8,
      lessonsTotal: 19,
      accent: "peach",
      artwork: "{ }",
      nextLesson: "Working with async code",
    },
    {
      id: "brand-strategy",
      title: "Brand Strategy",
      subtitle: "Make brands unforgettable",
      instructor: "Phoenix Baker",
      category: "Business",
      progress: 25,
      lessonsComplete: 4,
      lessonsTotal: 16,
      accent: "mint",
      artwork: "✺",
      nextLesson: "Finding your brand voice",
    },
  ],
  liveClasses: [
    {
      id: "live-1",
      title: "Design critique: portfolio edition",
      instructor: "Olivia Rhye",
      time: "Today, 2:30 PM",
      attendees: 24,
      initials: "OR",
      color: "violet",
    },
    {
      id: "live-2",
      title: "JavaScript Q&A: ask me anything",
      instructor: "Lana Steiner",
      time: "Tomorrow, 11:00 AM",
      attendees: 38,
      initials: "LS",
      color: "orange",
    },
  ],
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
});

export const { setCategory, setSearch, setActivePage, completeNextLesson } = coursesSlice.actions;
export default coursesSlice.reducer;
