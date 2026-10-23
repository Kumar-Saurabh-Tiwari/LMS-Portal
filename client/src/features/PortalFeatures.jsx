import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest, API_BASE_URL } from "../api.js";
import { useDispatch, useSelector } from "react-redux";
import { authenticate } from "./authSlice.js";

function Modal({ title, onClose, children }) {
  return (
    <div className="portal-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="portal-modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="portal-modal-heading"><h2>{title}</h2><button aria-label="Close" onClick={onClose}>×</button></div>
        {children}
      </section>
    </div>
  );
}

export function AuthDialog({ onClose }) {
  const dispatch = useDispatch();
  const { status, error } = useSelector((state) => state.auth);
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState("");
  const busy = status === "loading";

  async function submit(event) {
    event.preventDefault();
    setFormError("");
    try {
      await dispatch(authenticate({ mode, name, email, password })).unwrap();
      onClose();
    } catch (submitError) {
      setFormError(submitError.message);
    }
  }

  return (
    <Modal title={mode === "login" ? "Welcome back" : "Create your student account"} onClose={onClose}>
      <form className="portal-form" onSubmit={submit}>
        {mode === "register" && <label>Name<input required maxLength="120" value={name} onChange={(event) => setName(event.target.value)} /></label>}
        <label>Email<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <label>Password<input required type="password" minLength="12" autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        {(formError || error) && <p className="portal-error" role="alert">{formError || error}</p>}
        <button className="dialog-primary" disabled={busy}>{busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}</button>
        <button className="portal-text-button" type="button" onClick={() => { setMode(mode === "login" ? "register" : "login"); setFormError(""); }}>
          {mode === "login" ? "New here? Create a student account" : "Already have an account? Sign in"}
        </button>
      </form>
    </Modal>
  );
}

export function QuizDialog({ lessonId, token, onClose, onCompleted }) {
  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    apiRequest(`/lessons/${lessonId}/quiz`, { token })
      .then(({ quiz: loadedQuiz }) => { if (active) setQuiz(loadedQuiz); })
      .catch((loadError) => { if (active) setError(loadError.message); });
    return () => { active = false; };
  }, [lessonId, token]);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const payload = await apiRequest(`/lessons/${lessonId}/quiz/submit`, {
        token,
        method: "POST",
        body: JSON.stringify({ answers: Object.entries(answers).map(([questionId, selectedOption]) => ({ questionId, selectedOption: Number(selectedOption) })) }),
      });
      setResult(payload);
      if (payload.passed) onCompleted();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={quiz?.title ?? "Quiz"} onClose={onClose}>
      {!quiz && !error && <p role="status">Loading quiz…</p>}
      {error && <p className="portal-error" role="alert">{error}</p>}
      {quiz && !result && <form className="portal-form quiz-form" onSubmit={submit}>
        {quiz.questions.map((question, index) => (
          <fieldset key={question.id}>
            <legend>{index + 1}. {question.prompt}</legend>
            {question.options.map((option, optionIndex) => (
              <label className="quiz-option" key={optionIndex}>
                <input
                  type="radio"
                  name={question.id}
                  value={optionIndex}
                  required
                  checked={Number(answers[question.id]) === optionIndex}
                  onChange={() => setAnswers((previous) => ({ ...previous, [question.id]: optionIndex }))}
                />
                {option}
              </label>
            ))}
          </fieldset>
        ))}
        <button className="dialog-primary" disabled={busy}>{busy ? "Grading…" : "Submit answers"}</button>
      </form>}
      {result && <div className="quiz-result">
        <strong className={result.passed ? "quiz-pass" : "portal-error"}>{result.passed ? "Passed" : "Not passed"} · {result.score}%</strong>
        <p>Passing score: {result.passingScore}%</p>
        {result.results.map((item, index) => <p key={item.questionId}>Question {index + 1}: {item.correct ? "Correct" : "Incorrect"}{item.explanation ? ` — ${item.explanation}` : ""}</p>)}
        <button className="dialog-primary" onClick={onClose}>Done</button>
      </div>}
    </Modal>
  );
}

export function VideoDialog({ url, onClose, onComplete }) {
  const videoRef = useRef(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !url) return undefined;
    let hls;
    let cancelled = false;
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = url;
    } else {
      import("hls.js").then(({ default: Hls }) => {
        if (cancelled) return;
        if (!Hls.isSupported()) {
          setError("This browser does not support HLS video playback.");
          return;
        }
        hls = new Hls();
        hls.loadSource(url);
        hls.attachMedia(video);
        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) setError("Video playback failed. Check the media delivery configuration.");
        });
      }).catch((loadError) => setError(loadError.message));
    }
    return () => {
      cancelled = true;
      hls?.destroy();
    };
  }, [url]);

  return <Modal title="Course video" onClose={onClose}>
    {error && <p className="portal-error" role="alert">{error}</p>}
    <video
      className="course-video-player"
      ref={videoRef}
      controls
      playsInline
      onEnded={(event) => onComplete(event.currentTarget.currentTime)}
    />
  </Modal>;
}

export function InstructorPanel({ token, onRefresh }) {
  const [courses, setCourses] = useState([]);
  const [revenue, setRevenue] = useState(null);
  const [selectedCourse, setSelectedCourse] = useState("");
  const [selectedLesson, setSelectedLesson] = useState("");
  const [courseTitle, setCourseTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("0");
  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonType, setLessonType] = useState("video");
  const [textContent, setTextContent] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [quizQuestion, setQuizQuestion] = useState("");
  const [quizOptions, setQuizOptions] = useState("");
  const [correctOption, setCorrectOption] = useState("0");
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const fileInput = useRef(null);
  const chosenCourse = courses.find((item) => item.id === selectedCourse);
  const lessons = chosenCourse?.lessons ?? [];
  const hasProcessingVideo = lessons.some((lesson) => ["queued", "processing"].includes(lesson.videoStatus));

  const loadInstructorData = useCallback(async () => {
    const [coursePayload, revenuePayload] = await Promise.all([
      apiRequest("/instructor/courses", { token }),
      apiRequest("/instructor/revenue", { token }),
    ]);
    setCourses(coursePayload.courses);
    setRevenue(revenuePayload);
    setSelectedCourse((current) => current || coursePayload.courses[0]?.id || "");
  }, [token]);

  useEffect(() => {
    loadInstructorData().catch((loadError) => setError(loadError.message));
  }, [loadInstructorData]);

  useEffect(() => {
    if (!hasProcessingVideo) return undefined;
    const timer = window.setInterval(() => {
      loadInstructorData().catch((loadError) => setError(loadError.message));
    }, 5000);
    return () => window.clearInterval(timer);
  }, [hasProcessingVideo, loadInstructorData]);

  async function submitCourse(event) {
    event.preventDefault();
    setMessage("");
    setError("");
    try {
      const pricing = Number(price) > 0
        ? { type: "paid", amount: Number(price), currency: "USD" }
        : { type: "free", amount: 0, currency: "USD" };
      const { course } = await apiRequest("/courses", {
        token,
        method: "POST",
        body: JSON.stringify({ title: courseTitle, description, category, pricing }),
      });
      await loadInstructorData();
      setSelectedCourse(String(course._id));
      setCourseTitle("");
      setDescription("");
      setMessage("Draft course created. Add lessons, then publish it.");
    } catch (submitError) {
      setError(submitError.message);
    }
  }

  async function submitLesson(event) {
    event.preventDefault();
    setMessage("");
    setError("");
    try {
      const { lesson } = await apiRequest(`/courses/${selectedCourse}/lessons`, {
        token,
        method: "POST",
        body: JSON.stringify({
          title: lessonTitle,
          type: lessonType,
          ...(lessonType === "text" ? { textContent } : {}),
          ...(lessonType === "live" && startsAt ? { liveClass: { startsAt: new Date(startsAt).toISOString() } } : {}),
        }),
      });
      setSelectedLesson(String(lesson._id));
      setLessonTitle("");
      setTextContent("");
      setMessage(`Lesson created. ${lessonType === "video" ? "Upload a video below." : "Configure the lesson before publishing."}`);
      await loadInstructorData();
    } catch (submitError) {
      setError(submitError.message);
    }
  }

  async function uploadVideo(event) {
    const file = event.target.files?.[0];
    if (!file || !selectedLesson) return;
    setMessage("");
    setError("");
    try {
      const body = new FormData();
      body.append("video", file);
      const result = await apiRequest(`/lessons/${selectedLesson}/video`, { token, method: "POST", body });
      setMessage(`Video queued for processing (job ${result.jobId}).`);
      await loadInstructorData();
    } catch (uploadError) {
      setError(uploadError.message);
    } finally {
      event.target.value = "";
    }
  }

  async function addQuizQuestion() {
    const options = quizOptions.split("|").map((option) => option.trim()).filter(Boolean);
    const correct = Number(correctOption);
    if (!quizQuestion.trim() || options.length < 2 || !Number.isInteger(correct) || correct < 0 || correct >= options.length) {
      setError("Provide a question, at least two options separated by |, and a valid zero-based correct option.");
      return;
    }
    const questions = [...quizQuestions, { prompt: quizQuestion.trim(), options, correctOption: correct }];
    setQuizQuestions(questions);
    setQuizQuestion("");
    setQuizOptions("");
    setError("");
    try {
      await apiRequest(`/lessons/${selectedLesson}/quiz`, {
        token,
        method: "PUT",
        body: JSON.stringify({ title: lessons.find((lesson) => lesson.id === selectedLesson)?.title ?? "Course quiz", questions }),
      });
      setMessage(`Quiz saved with ${questions.length} question${questions.length === 1 ? "" : "s"}.`);
    } catch (saveError) {
      setQuizQuestions(questions.slice(0, -1));
      setError(saveError.message);
    }
  }

  async function publishLesson(lessonId) {
    setError("");
    try {
      await apiRequest(`/lessons/${lessonId}/publish`, { token, method: "PATCH" });
      await loadInstructorData();
      await onRefresh();
      setMessage("Lesson published.");
    } catch (publishError) {
      setError(publishError.message);
    }
  }

  async function publishCourse() {
    setError("");
    try {
      await apiRequest(`/courses/${selectedCourse}`, {
        token,
        method: "PATCH",
        body: JSON.stringify({ status: "published" }),
      });
      await loadInstructorData();
      await onRefresh();
      setMessage("Course published.");
    } catch (publishError) {
      setError(publishError.message);
    }
  }

  return (
    <section className="portal-workspace">
      <div className="portal-section-heading"><div><div className="section-kicker">INSTRUCTOR WORKSPACE</div><h2>Manage courses</h2></div></div>
      {error && <p className="portal-error" role="alert">{error}</p>}
      {message && <p className="portal-success" role="status">{message}</p>}
      <div className="portal-panel-grid">
        <form className="portal-panel portal-form" onSubmit={submitCourse}>
          <h3>Create a course</h3>
          <label>Course title<input required maxLength="200" value={courseTitle} onChange={(event) => setCourseTitle(event.target.value)} /></label>
          <label>Description<textarea required maxLength="10000" value={description} onChange={(event) => setDescription(event.target.value)} /></label>
          <label>Category<input value={category} onChange={(event) => setCategory(event.target.value)} /></label>
          <label>Price in USD (0 for free)<input required type="number" min="0" step="1" value={price} onChange={(event) => setPrice(event.target.value)} /></label>
          <button className="dialog-primary">Create draft</button>
        </form>
        <div className="portal-panel portal-form">
          <h3>Add a lesson</h3>
          <label>Course<select value={selectedCourse} onChange={(event) => { setSelectedCourse(event.target.value); setSelectedLesson(""); setQuizQuestions([]); }}>
            <option value="">Select a course</option>
            {courses.map((course) => <option key={course.id} value={course.id}>{course.title} · {course.status}</option>)}
          </select></label>
          <form onSubmit={submitLesson}>
            <label>Lesson title<input required maxLength="200" disabled={!selectedCourse} value={lessonTitle} onChange={(event) => setLessonTitle(event.target.value)} /></label>
            <label>Type<select disabled={!selectedCourse} value={lessonType} onChange={(event) => setLessonType(event.target.value)}>
              <option value="video">Video</option><option value="text">Text</option><option value="quiz">Quiz</option><option value="live">Live class</option>
            </select></label>
            {lessonType === "text" && <label>Lesson content<textarea required maxLength="50000" value={textContent} onChange={(event) => setTextContent(event.target.value)} /></label>}
            {lessonType === "live" && <label>Starts at<input required type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} /></label>}
            <button className="dialog-primary" disabled={!selectedCourse}>Add lesson</button>
          </form>
          {lessonType === "video" && selectedLesson && lessons.find((lesson) => lesson.id === selectedLesson)?.type === "video" && <label>Upload video<input ref={fileInput} type="file" accept="video/mp4,video/webm,video/quicktime,video/x-matroska" onChange={uploadVideo} /></label>}
          {lessonType === "quiz" && selectedLesson && lessons.find((lesson) => lesson.id === selectedLesson)?.type === "quiz" && <div className="quiz-builder">
            <label>Question<input value={quizQuestion} onChange={(event) => setQuizQuestion(event.target.value)} /></label>
            <label>Options (separate with |)<input value={quizOptions} onChange={(event) => setQuizOptions(event.target.value)} /></label>
            <label>Correct option (zero-based)<input type="number" min="0" value={correctOption} onChange={(event) => setCorrectOption(event.target.value)} /></label>
            <button type="button" className="dialog-primary" onClick={addQuizQuestion}>Add and save question</button>
          </div>}
        </div>
      </div>
      {chosenCourse && <section className="portal-panel">
        <div className="portal-list-heading"><h3>{chosenCourse.title}</h3><button className="dialog-primary" onClick={publishCourse} disabled={!lessons.length || chosenCourse.status === "published"}>{chosenCourse.status === "published" ? "Published" : "Publish course"}</button></div>
        {lessons.map((lesson) => <div className="portal-lesson-row" key={lesson.id}>
          <span>{lesson.title} · {lesson.type}{lesson.videoStatus ? ` · ${lesson.videoStatus}` : ""}</span>
          <button className="portal-secondary" disabled={!lesson.id || lesson.isPublished || (lesson.type === "video" && lesson.videoStatus !== "ready")} onClick={() => { setSelectedLesson(lesson.id); publishLesson(lesson.id); }}>
            {lesson.isPublished ? "Published" : "Publish lesson"}
          </button>
        </div>)}
      </section>}
      <section className="portal-panel">
        <h3>Revenue (gross test-mode sales)</h3>
        {revenue ? <>
          <p>{Object.entries(revenue.totals).map(([currency, total]) => `${currency} ${total.toFixed(2)}`).join(" · ") || "No paid enrollments yet."}</p>
          {revenue.courses.map((item) => <div className="portal-lesson-row" key={`${item.courseId}-${item.currency}`}><span>{item.title}</span><strong>{item.currency} {item.grossRevenue.toFixed(2)} · {item.paidEnrollments} enrollments</strong></div>)}
          <small>{revenue.note}</small>
        </> : <p>Loading revenue…</p>}
      </section>
    </section>
  );
}

export function triggerCertificateDownload(enrollmentId, token) {
  return fetch(`${API_BASE_URL}/api/enrollments/${enrollmentId}/certificate`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then(async (response) => {
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(payload?.error ?? "Certificate could not be downloaded.");
    }
    const objectUrl = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = "course-certificate.pdf";
    link.click();
    URL.revokeObjectURL(objectUrl);
  });
}
