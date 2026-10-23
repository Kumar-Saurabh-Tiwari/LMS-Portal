import { useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  ArrowDownRight,
  ArrowRight,
  Bell,
  BookOpen,
  CalendarDays,
  ChevronDown,
  CircleHelp,
  Clock3,
  Compass,
  Flame,
  LayoutDashboard,
  Search,
  Settings,
  Sparkles,
  Video,
} from "lucide-react";
import { completeNextLesson, setActivePage, setCategory, setSearch } from "./features/coursesSlice.js";

const categories = ["All courses", "Design", "Development", "Business"];

function Sidebar() {
  const dispatch = useDispatch();
  const activePage = useSelector((state) => state.courses.activePage);
  const links = [
    { label: "Overview", icon: LayoutDashboard },
    { label: "My courses", icon: BookOpen },
    { label: "Live classes", icon: Video },
    { label: "Explore", icon: Compass },
  ];

  return (
    <aside className="sidebar">
      <a className="brand" href="#" onClick={(event) => event.preventDefault()}>
        <span className="brand-mark"><Sparkles size={19} strokeWidth={2.6} /></span>
        <span>learnspace</span>
      </a>
      <div className="workspace-label">LEARNING SPACE</div>
      <nav className="side-nav" aria-label="Main navigation">
        {links.map(({ label, icon: Icon }) => (
          <button
            className={`nav-link ${activePage === label ? "active" : ""}`}
            key={label}
            onClick={() => dispatch(setActivePage(label))}
          >
            <Icon size={18} strokeWidth={1.8} />
            <span>{label}</span>
            {label === "Live classes" && <span className="nav-count">2</span>}
          </button>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="streak-card">
          <div className="streak-icon"><Flame size={18} fill="currentColor" /></div>
          <div>
            <strong>5 day streak</strong>
            <span>You’re on a roll!</span>
          </div>
          <ArrowDownRight size={16} className="streak-arrow" />
        </div>
        <button className="nav-link utility-link"><CircleHelp size={18} /><span>Help center</span></button>
        <button className="nav-link utility-link"><Settings size={18} /><span>Settings</span></button>
        <div className="profile">
          <div className="profile-avatar">JD</div>
          <div className="profile-copy"><strong>Jordan Davis</strong><span>Free plan</span></div>
          <ChevronDown size={16} className="profile-chevron" />
        </div>
      </div>
    </aside>
  );
}

function Header() {
  const dispatch = useDispatch();
  const search = useSelector((state) => state.courses.search);
  return (
    <header className="topbar">
      <div className="breadcrumb"><span>Workspace</span><span className="crumb-slash">/</span><strong>Overview</strong></div>
      <div className="topbar-actions">
        <label className="search-box">
          <Search size={17} />
          <input
            aria-label="Search courses"
            placeholder="Search anything..."
            value={search}
            onChange={(event) => dispatch(setSearch(event.target.value))}
          />
          <kbd>⌘ K</kbd>
        </label>
        <button className="icon-button notification-button" aria-label="Notifications">
          <Bell size={19} /><span className="notification-dot" />
        </button>
        <div className="top-avatar">JD</div>
      </div>
    </header>
  );
}

function WelcomeBanner({ completed, total }) {
  return (
    <section className="welcome-banner">
      <div className="welcome-copy">
        <div className="eyebrow"><span className="eyebrow-dot" /> FRIDAY, OCTOBER 23, 2026</div>
        <h1>Keep that momentum,<br /><span>Jordan.</span></h1>
        <p>You’re making great progress. A little learning every day goes a long way.</p>
        <div className="welcome-stats">
          <div className="welcome-stat"><span className="stat-icon purple"><BookOpen size={16} /></span><strong>{total}</strong><span>courses in progress</span></div>
          <div className="stat-divider" />
          <div className="welcome-stat"><span className="stat-icon orange"><Flame size={16} /></span><strong>{completed}</strong><span>lessons completed</span></div>
        </div>
      </div>
      <div className="banner-art" aria-hidden="true">
        <div className="art-sun" />
        <div className="art-orbit orbit-one" />
        <div className="art-orbit orbit-two" />
        <div className="art-book"><span>✳</span><i /><i /><i /></div>
        <div className="art-star star-one">✦</div>
        <div className="art-star star-two">✳</div>
        <div className="art-dot dot-one" />
        <div className="art-dot dot-two" />
      </div>
      <div className="banner-note"><span>✦</span> Your next chapter starts here</div>
    </section>
  );
}

function CourseCard({ course, onContinue }) {
  return (
    <article className="course-card">
      <div className={`course-art ${course.accent}`}>
        <div className="art-label">{course.category.toUpperCase()}</div>
        <div className="course-art-symbol">{course.artwork}</div>
        <div className="art-squiggle" />
        <span className="art-orbit-small" />
      </div>
      <div className="course-card-body">
        <div className="course-heading">
          <div><h3>{course.title}</h3><p>{course.subtitle}</p></div>
          <button className="more-button" aria-label={`More options for ${course.title}`}>···</button>
        </div>
        <div className="instructor-row">
          <div className="instructor-avatar">{course.instructor.split(" ").map((part) => part[0]).join("")}</div>
          <span>{course.instructor}</span>
          <span className="lesson-count">{course.lessonsComplete}/{course.lessonsTotal} lessons</span>
        </div>
        <div className="progress-meta"><span>Your progress</span><strong>{course.progress}%</strong></div>
        <div className="progress-track"><span style={{ width: `${course.progress}%` }} /></div>
        <div className="next-lesson"><div><span className="next-label">UP NEXT</span><strong>{course.nextLesson}</strong></div>
          <button className="continue-button" onClick={() => onContinue(course.id)} aria-label={`Complete next lesson in ${course.title}`}><ArrowRight size={17} /></button>
        </div>
      </div>
    </article>
  );
}

function LiveClasses({ classes }) {
  return (
    <section className="live-section">
      <div className="section-title-row">
        <div><div className="section-kicker"><span className="live-indicator" /> LEARN TOGETHER</div><h2>Live classes</h2></div>
        <button className="text-button">View schedule <ArrowRight size={15} /></button>
      </div>
      <div className="live-list">
        {classes.map((item, index) => (
          <article className="live-card" key={item.id}>
            <div className={`live-date ${index === 0 ? "today" : ""}`}><span>{index === 0 ? "OCT" : "OCT"}</span><strong>{index === 0 ? "23" : "24"}</strong></div>
            <div className="live-details"><h3>{item.title}</h3><div className="live-meta"><span className={`live-avatar ${item.color}`}>{item.initials}</span><span>{item.instructor}</span><span className="meta-separator">·</span><Clock3 size={13} /><span>{item.time}</span></div></div>
            <div className="attendees"><div className="attendee-stack"><i>JD</i><i>AK</i><i>+</i></div><span>{item.attendees} going</span></div>
            <button className={`remind-button ${index === 0 ? "join-button" : ""}`}>{index === 0 ? "Join class" : "Remind me"}</button>
          </article>
        ))}
      </div>
    </section>
  );
}

function App() {
  const dispatch = useDispatch();
  const { courses, activeCategory, search, liveClasses } = useSelector((state) => state.courses);
  const filteredCourses = useMemo(() => courses.filter((course) => {
    const matchesCategory = activeCategory === "All courses" || course.category === activeCategory;
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || `${course.title} ${course.subtitle} ${course.instructor}`.toLowerCase().includes(query);
    return matchesCategory && matchesSearch;
  }), [courses, activeCategory, search]);
  const completedLessons = courses.reduce((sum, course) => sum + course.lessonsComplete, 0);

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-area">
        <Header />
        <div className="page-content">
          <WelcomeBanner completed={completedLessons} total={courses.length} />
          <section className="courses-section">
            <div className="section-title-row courses-title-row">
              <div><div className="section-kicker">YOUR LEARNING JOURNEY</div><h2>Pick up where you left off</h2></div>
              <button className="text-button">All courses <ArrowRight size={15} /></button>
            </div>
            <div className="course-toolbar">
              <div className="filter-tabs" role="group" aria-label="Filter courses">
                {categories.map((category) => (
                  <button key={category} className={`filter-tab ${activeCategory === category ? "selected" : ""}`} onClick={() => dispatch(setCategory(category))}>{category}</button>
                ))}
              </div>
              <button className="sort-button"><CalendarDays size={15} /> Recently active <ChevronDown size={14} /></button>
            </div>
            {filteredCourses.length ? (
              <div className="course-grid">
                {filteredCourses.map((course) => <CourseCard key={course.id} course={course} onContinue={(id) => dispatch(completeNextLesson(id))} />)}
              </div>
            ) : (
              <div className="empty-state"><Search size={22} /><strong>No courses found</strong><span>Try another search or category.</span></div>
            )}
          </section>
          <LiveClasses classes={liveClasses} />
          <footer className="page-footer"><span>Made for curious minds <span className="footer-heart">♥</span></span><span>Need a hand? <a href="mailto:hello@learnspace.example">We’re here to help</a></span></footer>
        </div>
      </main>
    </div>
  );
}

export default App;
