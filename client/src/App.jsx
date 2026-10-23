import { useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
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
import { completeNextLesson, fetchDashboard, setActivePage, setCategory, setSearch } from "./features/coursesSlice.js";

function Sidebar({ onOpenHelp, onOpenSettings }) {
  const dispatch = useDispatch();
  const activePage = useSelector((state) => state.courses.activePage);
  const liveClassCount = useSelector((state) => state.courses.liveClasses.length);
  const links = [
    { label: "Overview", icon: LayoutDashboard },
    { label: "Courses", icon: BookOpen },
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
            aria-label={label}
            aria-current={activePage === label ? "page" : undefined}
          >
            <Icon size={18} strokeWidth={1.8} />
            <span>{label}</span>
            {label === "Live classes" && liveClassCount > 0 && <span className="nav-count">{liveClassCount}</span>}
          </button>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <button className="nav-link utility-link" aria-label="Help center" onClick={onOpenHelp}><CircleHelp size={18} /><span>Help center</span></button>
        <button className="nav-link utility-link" aria-label="Settings" onClick={onOpenSettings}><Settings size={18} /><span>Settings</span></button>
        <div className="profile">
          <div className="profile-avatar">L</div>
          <div className="profile-copy"><strong>Learner</strong><span>Student</span></div>
          <ChevronDown size={16} className="profile-chevron" />
        </div>
      </div>
    </aside>
  );
}

function Header({ searchInputRef, notifications, notificationsOpen, notificationsRead, remindersEnabled, onToggleNotifications, onMarkNotificationsRead, onViewSchedule }) {
  const dispatch = useDispatch();
  const { search, activePage } = useSelector((state) => state.courses);
  return (
    <header className="topbar">
      <div className="breadcrumb"><span>Workspace</span><span className="crumb-slash">/</span><strong>{activePage}</strong></div>
      <div className="topbar-actions">
        <label className="search-box">
          <Search size={17} />
          <input
            ref={searchInputRef}
            aria-label="Search courses"
            placeholder="Search anything..."
            value={search}
            onChange={(event) => dispatch(setSearch(event.target.value))}
          />
          <kbd>Ctrl/⌘ K</kbd>
        </label>
        <div className="notification-container">
          <button
            className="icon-button notification-button"
            aria-label="Notifications"
            aria-expanded={notificationsOpen}
            onClick={onToggleNotifications}
          >
            <Bell size={19} />
            {remindersEnabled && notifications.length > 0 && !notificationsRead && <span className="notification-dot" />}
          </button>
          {notificationsOpen && (
            <section className="notification-panel" aria-label="Notifications">
              <div className="panel-heading">
                <strong>Notifications</strong>
                {notifications.length > 0 && !notificationsRead && (
                  <button className="panel-action" onClick={onMarkNotificationsRead}>Mark all read</button>
                )}
              </div>
              {!remindersEnabled ? (
                <p className="panel-empty">Class reminders are turned off in Settings.</p>
              ) : notifications.length ? (
                <>
                  <div className="notification-list">
                    {notifications.map((item) => (
                      <div className="notification-item" key={item.id}>
                        <span className="notification-item-icon"><CalendarDays size={16} /></span>
                        <div>
                          <strong>{item.title}</strong>
                          <span>{item.instructor} · {new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(item.startsAt))}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button className="panel-link" onClick={onViewSchedule}>View live class schedule <ArrowRight size={14} /></button>
                </>
              ) : <p className="panel-empty">You’re all caught up. There are no upcoming live classes.</p>}
            </section>
          )}
        </div>
        <div className="top-avatar">L</div>
      </div>
    </header>
  );
}

function WelcomeBanner({ completed, total }) {
  const today = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "2-digit",
    year: "numeric",
  }).format(new Date()).toUpperCase();

  return (
    <section className="welcome-banner">
      <div className="welcome-copy">
        <div className="eyebrow"><span className="eyebrow-dot" /> {today}</div>
        <h1>Keep your learning<br /><span>momentum.</span></h1>
        <p>A little learning every day goes a long way.</p>
        <div className="welcome-stats">
          <div className="welcome-stat"><span className="stat-icon purple"><BookOpen size={16} /></span><strong>{total}</strong><span>published courses</span></div>
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

function CourseCard({ course, isSaved, onContinue, onToggleSaved, onViewDetails }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <article className="course-card">
      <div className={`course-art ${course.accent} ${course.thumbnailUrl ? "has-thumbnail" : ""}`}>
        {course.thumbnailUrl && <img className="course-thumbnail" src={course.thumbnailUrl} alt="" />}
        <div className="art-label">{course.category.toUpperCase()}</div>
        <div className="course-art-symbol">{course.artwork}</div>
        <div className="art-squiggle" />
        <span className="art-orbit-small" />
      </div>
      <div className="course-card-body">
        <div className="course-heading">
          <div><h3>{course.title}</h3><p>{course.subtitle}</p></div>
          <div className="course-menu">
            <button
              className="more-button"
              aria-label={`More options for ${course.title}`}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
            >···</button>
            {menuOpen && (
              <div className="course-menu-popover" role="menu">
                <button role="menuitem" onClick={() => { onToggleSaved(course.id); setMenuOpen(false); }}>
                  {isSaved ? "Remove from saved" : "Save course"}
                </button>
                <button role="menuitem" onClick={() => { onViewDetails(course.id); setMenuOpen(false); }}>
                  View course details
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="instructor-row">
          <div className="instructor-avatar">{course.instructor.split(" ").map((part) => part[0]).join("")}</div>
          <span>{course.instructor}</span>
          <span className="lesson-count">{course.lessonsComplete}/{course.lessonsTotal} lessons</span>
        </div>
        <div className="progress-meta"><span>Your progress</span><strong>{course.progress}%</strong></div>
        <div className="progress-track"><span style={{ width: `${course.progress}%` }} /></div>
        <div className="next-lesson"><div><span className="next-label">UP NEXT</span><strong>{course.nextLesson}</strong></div>
          <button
            className="continue-button"
            onClick={() => onContinue(course.id)}
            disabled={course.lessonsComplete >= course.lessonsTotal}
            aria-label={`Complete next lesson in ${course.title}`}
          ><ArrowRight size={17} /></button>
        </div>
      </div>
    </article>
  );
}

function Dialog({ title, onClose, children }) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="dialog-card" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
        <div className="dialog-heading">
          <h2 id="dialog-title">{title}</h2>
          <button className="dialog-close" aria-label="Close dialog" onClick={onClose}>×</button>
        </div>
        {children}
      </section>
    </div>
  );
}

function CourseDetailsDialog({ course, onClose, onContinue }) {
  return (
    <Dialog title={course.title} onClose={onClose}>
      <div className="course-details">
        <span className="details-category">{course.category}</span>
        <p>{course.subtitle}</p>
        <dl>
          <div><dt>Instructor</dt><dd>{course.instructor}</dd></div>
          <div><dt>Progress</dt><dd>{course.lessonsComplete} of {course.lessonsTotal} lessons ({course.progress}%)</dd></div>
          <div><dt>Next lesson</dt><dd>{course.nextLesson}</dd></div>
        </dl>
        <button
          className="dialog-primary"
          onClick={() => onContinue(course.id)}
          disabled={course.lessonsComplete >= course.lessonsTotal}
        >
          {course.lessonsComplete >= course.lessonsTotal ? "Course completed" : "Complete next lesson"}
        </button>
      </div>
    </Dialog>
  );
}

function HelpDialog({ onClose }) {
  return (
    <Dialog title="Help center" onClose={onClose}>
      <div className="help-content">
        <p>Make the most of your learning space.</p>
        <ul>
          <li>Search by course title, topic, or instructor using the search box.</li>
          <li>Filter courses by category and use the sort control to arrange them by title.</li>
          <li>Use the arrow on a course card to mark its next lesson complete.</li>
          <li>Open Notifications to review upcoming live classes.</li>
        </ul>
        <a className="dialog-primary dialog-link" href="mailto:hello@learnspace.example">Contact learner support</a>
      </div>
    </Dialog>
  );
}

function SettingsDialog({ remindersEnabled, reducedMotion, onClose, onToggleReminders, onToggleReducedMotion }) {
  return (
    <Dialog title="Learning preferences" onClose={onClose}>
      <div className="settings-content">
        <p>These preferences apply for this session.</p>
        <label className="settings-option">
          <span><strong>Live class reminders</strong><small>Show upcoming classes in Notifications.</small></span>
          <input type="checkbox" checked={remindersEnabled} onChange={onToggleReminders} />
        </label>
        <label className="settings-option">
          <span><strong>Reduce motion</strong><small>Turn off animated loading and hover effects.</small></span>
          <input type="checkbox" checked={reducedMotion} onChange={onToggleReducedMotion} />
        </label>
      </div>
    </Dialog>
  );
}

function LiveClasses({ classes }) {
  const dispatch = useDispatch();

  return (
    <section className="live-section">
      <div className="section-title-row">
        <div><div className="section-kicker"><span className="live-indicator" /> LEARN TOGETHER</div><h2>Live classes</h2></div>
        <button className="text-button" onClick={() => dispatch(setActivePage("Live classes"))}>View schedule <ArrowRight size={15} /></button>
      </div>
      {classes.length ? <div className="live-list">
        {classes.map((item) => {
          const startsAt = new Date(item.startsAt);
          const month = new Intl.DateTimeFormat(undefined, { month: "short" }).format(startsAt).toUpperCase();
          const day = new Intl.DateTimeFormat(undefined, { day: "2-digit" }).format(startsAt);
          const time = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(startsAt);
          const initials = item.instructor.split(" ").map((part) => part[0]).join("").slice(0, 2);
          return (
          <article className="live-card" key={item.id}>
            <div className={`live-date ${item.status === "live" ? "today" : ""}`}><span>{month}</span><strong>{day}</strong></div>
            <div className="live-details"><h3>{item.title}</h3><div className="live-meta"><span className={`live-avatar ${item.status === "live" ? "violet" : "orange"}`}>{initials}</span><span>{item.instructor}</span><span className="meta-separator">·</span><Clock3 size={13} /><span>{time}</span></div></div>
            <button className={`remind-button ${item.status === "live" ? "join-button" : ""}`} disabled title="Class access requires an authenticated session">{item.status === "live" ? "Live now" : "Upcoming"}</button>
          </article>
          );
        })}
      </div> : <div className="empty-state live-empty-state"><CalendarDays size={22} /><strong>No upcoming live classes</strong><span>Check back later for the next session.</span></div>}
    </section>
  );
}

function DashboardLoading() {
  return (
    <div className="dashboard-loading" role="status" aria-label="Loading your learning dashboard" aria-busy="true">
      <div className="loading-banner"><span className="loading-spinner" /><span>Loading your learning dashboard…</span></div>
      <section className="loading-section">
        <div className="loading-heading" />
        <div className="loading-course-grid">
          {[0, 1, 2].map((item) => <div className="loading-course-card" key={item}><div className="loading-course-art" /><div className="loading-line" /><div className="loading-line short" /><div className="loading-line" /></div>)}
        </div>
      </section>
      <section className="loading-section"><div className="loading-heading short" /><div className="loading-live-card" /><div className="loading-live-card" /></section>
    </div>
  );
}

function App() {
  const dispatch = useDispatch();
  const { courses, activeCategory, search, liveClasses, activePage, status, error } = useSelector((state) => state.courses);
  const searchInputRef = useRef(null);
  const [sortByTitle, setSortByTitle] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsRead, setNotificationsRead] = useState(false);
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [savedCourseIds, setSavedCourseIds] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    if (status === "idle") dispatch(fetchDashboard());
  }, [dispatch, status]);

  useEffect(() => {
    const handleSearchShortcut = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleSearchShortcut);
    return () => window.removeEventListener("keydown", handleSearchShortcut);
  }, []);

  const categories = useMemo(
    () => ["All courses", ...new Set(courses.map((course) => course.category).filter(Boolean))],
    [courses]
  );
  const filteredCourses = useMemo(() => {
    const matchingCourses = courses.filter((course) => {
      const matchesCategory = activeCategory === "All courses" || course.category === activeCategory;
      const query = search.trim().toLowerCase();
      const matchesSearch = !query || `${course.title} ${course.subtitle} ${course.instructor}`.toLowerCase().includes(query);
      return matchesCategory && matchesSearch;
    });
    return sortByTitle ? matchingCourses.sort((first, second) => first.title.localeCompare(second.title)) : matchingCourses;
  }, [courses, activeCategory, search, sortByTitle]);
  const completedLessons = courses.reduce((sum, course) => sum + course.lessonsComplete, 0);
  const selectedCourse = courses.find((course) => course.id === selectedCourseId);
  const isLoading = status === "idle" || status === "loading";

  return (
    <div className={`app-shell ${reducedMotion ? "reduced-motion" : ""}`}>
      <Sidebar onOpenHelp={() => setHelpOpen(true)} onOpenSettings={() => setSettingsOpen(true)} />
      <main className="main-area">
        <Header
          searchInputRef={searchInputRef}
          notifications={liveClasses}
          notificationsOpen={notificationsOpen}
          notificationsRead={notificationsRead}
          remindersEnabled={remindersEnabled}
          onToggleNotifications={() => setNotificationsOpen((open) => !open)}
          onMarkNotificationsRead={() => setNotificationsRead(true)}
          onViewSchedule={() => {
            dispatch(setActivePage("Live classes"));
            setNotificationsOpen(false);
          }}
        />
        <div className="page-content">
          {isLoading ? <DashboardLoading /> : status === "failed" ? (
            <section className="load-error" role="alert">
              <strong>We couldn’t load your learning dashboard.</strong>
              <span>{error}</span>
              <button className="retry-button" onClick={() => dispatch(fetchDashboard())}>Try again</button>
            </section>
          ) : <>
          {activePage === "Overview" && <WelcomeBanner completed={completedLessons} total={courses.length} />}
          {activePage !== "Live classes" && <section className="courses-section">
            <div className="section-title-row courses-title-row">
              <div><div className="section-kicker">YOUR LEARNING JOURNEY</div><h2>Explore published courses</h2></div>
              <button
                className="text-button"
                onClick={() => {
                  dispatch(setCategory("All courses"));
                  dispatch(setSearch(""));
                }}
              >All courses <ArrowRight size={15} /></button>
            </div>
            <div className="course-toolbar">
              <div className="filter-tabs" role="group" aria-label="Filter courses">
                {categories.map((category) => (
                  <button key={category} className={`filter-tab ${activeCategory === category ? "selected" : ""}`} onClick={() => dispatch(setCategory(category))}>{category}</button>
                ))}
              </div>
              <button className="sort-button" onClick={() => setSortByTitle((current) => !current)} aria-pressed={sortByTitle}>
                <CalendarDays size={15} /> {sortByTitle ? "Title A–Z" : "Recently updated"} <ChevronDown size={14} />
              </button>
            </div>
            {filteredCourses.length ? (
              <div className="course-grid">
                {filteredCourses.map((course) => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    isSaved={savedCourseIds.includes(course.id)}
                    onContinue={(id) => dispatch(completeNextLesson(id))}
                    onToggleSaved={(id) => setSavedCourseIds((saved) => (
                      saved.includes(id) ? saved.filter((savedId) => savedId !== id) : [...saved, id]
                    ))}
                    onViewDetails={setSelectedCourseId}
                  />
                ))}
              </div>
            ) : courses.length === 0 ? (
              <div className="empty-state"><BookOpen size={22} /><strong>No courses available yet</strong><span>Published courses will appear here.</span></div>
            ) : (
              <div className="empty-state"><Search size={22} /><strong>No courses found</strong><span>Try another search or category.</span></div>
            )}
          </section>}
          {activePage !== "Courses" && activePage !== "Explore" && <LiveClasses classes={liveClasses} />}
          <footer className="page-footer"><span>Made for curious minds <span className="footer-heart">♥</span></span><span>Need a hand? <a href="mailto:hello@learnspace.example">We’re here to help</a></span></footer>
          </>}
        </div>
      </main>
      {selectedCourse && (
        <CourseDetailsDialog
          course={selectedCourse}
          onClose={() => setSelectedCourseId(null)}
          onContinue={(id) => dispatch(completeNextLesson(id))}
        />
      )}
      {helpOpen && <HelpDialog onClose={() => setHelpOpen(false)} />}
      {settingsOpen && (
        <SettingsDialog
          remindersEnabled={remindersEnabled}
          reducedMotion={reducedMotion}
          onClose={() => setSettingsOpen(false)}
          onToggleReminders={(event) => setRemindersEnabled(event.target.checked)}
          onToggleReducedMotion={(event) => setReducedMotion(event.target.checked)}
        />
      )}
    </div>
  );
}

export default App;
