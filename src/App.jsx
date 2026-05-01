import React, { useEffect, useState } from "react";
import StudentMap from "./components/StudentMap";
import TeacherBoard from "./components/TeacherBoard";

const TEACHER_PIN = "1234";
const TEACHER_ACCESS_KEY = "gerrymanderingTeacherAccess";
const FIREBASE_CONFIG_STORAGE_KEY = "gerrymanderingFirebaseConfig";
const FIREBASE_CONFIG_TEMPLATE = `const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  databaseURL: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};`;

function generatePin() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function navigateTo(path) {
  window.location.hash = path;
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}

function hasTeacherAccess() {
  try {
    return window.sessionStorage.getItem(TEACHER_ACCESS_KEY) === "true";
  } catch {
    return false;
  }
}

function grantTeacherAccess() {
  try {
    window.sessionStorage.setItem(TEACHER_ACCESS_KEY, "true");
  } catch {
    // If session storage is blocked, the PIN screen will appear again on reload.
  }
}

function readStoredFirebaseConfig() {
  try {
    const raw = window.localStorage.getItem(FIREBASE_CONFIG_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function extractFirebaseConfig(rawText) {
  const keys = ["apiKey", "authDomain", "databaseURL", "projectId", "storageBucket", "messagingSenderId", "appId"];
  return keys.reduce((config, key) => {
    const match = rawText.match(new RegExp(`${key}\\s*:\\s*["']([^"']*)["']`));
    config[key] = match?.[1]?.trim() || "";
    return config;
  }, {});
}

function useRoute() {
  const [locationKey, setLocationKey] = useState(0);

  useEffect(() => {
    const handleChange = () => setLocationKey((key) => key + 1);
    window.addEventListener("popstate", handleChange);
    window.addEventListener("hashchange", handleChange);
    return () => {
      window.removeEventListener("popstate", handleChange);
      window.removeEventListener("hashchange", handleChange);
    };
  }, []);

  const url = new URL(window.location.href);
  const hashRoute = url.hash.startsWith("#/") ? url.hash.slice(1) : "";
  const [rawPath, hashQuery = ""] = hashRoute ? hashRoute.split("?") : [url.pathname, ""];
  const basePath = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
  const path =
    !hashRoute && basePath && rawPath.startsWith(basePath)
      ? rawPath.slice(basePath.length) || "/"
      : rawPath;
  const segments = path.split("/").filter(Boolean).map(decodeURIComponent);

  return {
    locationKey,
    segments,
    query: hashRoute ? new URLSearchParams(hashQuery) : url.searchParams,
  };
}

function makeTeamId(teamName) {
  const suffix = Date.now().toString(36).slice(-5);
  const safeName = teamName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 20);

  return `${safeName || "team"}-${suffix}`;
}

function FirebaseSettingsPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [configText, setConfigText] = useState(() => {
    const storedConfig = readStoredFirebaseConfig();
    return storedConfig ? `const firebaseConfig = ${JSON.stringify(storedConfig, null, 2)};` : FIREBASE_CONFIG_TEMPLATE;
  });
  const [status, setStatus] = useState(() => (readStoredFirebaseConfig() ? "firebase" : "local"));
  const [message, setMessage] = useState("");

  function saveFirebaseConfig() {
    const nextConfig = extractFirebaseConfig(configText);
    if (!nextConfig.apiKey || !nextConfig.databaseURL || !nextConfig.projectId) {
      setMessage("apiKey, databaseURL, projectId가 포함된 설정 객체를 붙여넣어 주세요.");
      return;
    }

    window.localStorage.setItem(FIREBASE_CONFIG_STORAGE_KEY, JSON.stringify(nextConfig));
    setStatus("firebase");
    setMessage("Firebase 설정을 저장했습니다. 새로고침하면 실시간 DB를 사용합니다.");
  }

  function clearFirebaseConfig() {
    window.localStorage.removeItem(FIREBASE_CONFIG_STORAGE_KEY);
    setConfigText(FIREBASE_CONFIG_TEMPLATE);
    setStatus("local");
    setMessage("저장된 Firebase 설정을 지웠습니다.");
  }

  return (
    <div className="mt-6 border-t border-[var(--color-border)] pt-5">
      <div className={`flex items-center justify-between gap-3 rounded-xl border-l-4 p-4 ${
        status === "firebase" ? "border-emerald-500 bg-emerald-50" : "border-rose-500 bg-rose-50"
      }`}>
        <p className={`text-base font-black ${status === "firebase" ? "text-emerald-900" : "text-rose-900"}`}>
          {status === "firebase" ? "Firebase 연결 설정 저장됨" : "현재는 로컬 데모 모드"}
        </p>
        <button
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-black text-[var(--color-text)] shadow-sm"
        >
          Firebase 설정
        </button>
      </div>

      {isOpen ? (
        <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-white p-4">
          <h3 className="text-lg font-black text-[var(--color-text)]">
            Firebase 콘솔의 웹 앱 설정 객체를 그대로 붙여넣으세요.
          </h3>
          <p className="mt-2 text-sm font-bold leading-6 text-[var(--color-text-muted)]">
            저장 후 새로고침하면 이 브라우저는 Realtime Database를 사용합니다. 학생 기기들도 같은 설정이 들어간 배포 주소나 같은 설정 저장이 필요합니다.
          </p>
          <textarea
            value={configText}
            onChange={(event) => {
              setConfigText(event.target.value);
              setMessage("");
            }}
            className="mt-3 h-48 w-full rounded-lg border border-[var(--color-border)] bg-white p-3 font-mono text-sm font-bold leading-5 outline-none focus:border-[var(--color-brand)] focus:ring-4 focus:ring-blue-100"
            spellCheck={false}
          />
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" onClick={saveFirebaseConfig} className="bo-button-primary px-4 py-3 text-sm">
              설정 저장
            </button>
            <button type="button" onClick={() => window.location.reload()} className="bo-button-secondary px-4 py-3 text-sm">
              새로고침
            </button>
            <button type="button" onClick={clearFirebaseConfig} className="bo-button-secondary px-4 py-3 text-sm">
              저장 설정 지우기
            </button>
          </div>
          {message ? <p className="mt-3 text-sm font-black text-[var(--color-brand-ink)]">{message}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function Home() {
  const [studentPin, setStudentPin] = useState("");
  const [teamName, setTeamName] = useState("");
  const [teacherPin, setTeacherPin] = useState("");
  const [teacherPinError, setTeacherPinError] = useState("");

  function createTeacherRoom() {
    if (teacherPin !== TEACHER_PIN) {
      setTeacherPinError("교사용 PIN을 확인해 주세요.");
      return;
    }

    grantTeacherAccess();
    navigateTo(`/teacher/${generatePin()}`);
  }

  function joinStudentRoom(event) {
    event.preventDefault();
    const cleanPin = studentPin.replace(/\D/g, "").slice(0, 6);
    const cleanTeamName = teamName.trim();
    if (cleanPin.length !== 6 || !cleanTeamName) return;

    const teamId = makeTeamId(cleanTeamName);
    navigateTo(`/student/${cleanPin}/${teamId}?name=${encodeURIComponent(cleanTeamName)}`);
  }

  return (
    <main className="bo-page">
      <section className="mx-auto grid min-h-screen max-w-6xl content-center gap-6 px-5 py-8 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="flex flex-col justify-center">
          <p className="bo-label">BOOONG CLASSROOM GAME</p>
          <h1 className="bo-title-display mt-4 max-w-3xl text-5xl sm:text-6xl">
            지도를 훔친 자들
          </h1>
          <p className="mt-3 text-2xl font-extrabold text-[var(--color-brand-ink)]">
            게리맨더링의 마법
          </p>
          <p className="bo-muted mt-6 max-w-2xl text-lg font-semibold leading-8">
            우리는 세종시 읍·면·동 지도를 다시 나누며, 같은 득표가 어떤 선거구에서는 전혀 다른 의석 결과로 바뀌는지 실험합니다.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={createTeacherRoom}
              className="bo-button-primary px-5 py-3 text-base"
            >
              교사용 방 만들기
            </button>
          </div>
          <label className="mt-5 grid max-w-md gap-2 text-sm font-extrabold text-[var(--color-text-muted)]">
            교사용 PIN
            <input
              inputMode="numeric"
              maxLength={4}
              value={teacherPin}
              onChange={(event) => {
                setTeacherPin(event.target.value.replace(/\D/g, "").slice(0, 4));
                setTeacherPinError("");
              }}
              className="bo-input h-[70px] px-4 text-2xl font-black tracking-wide"
              placeholder="교사용 PIN 4자리"
            />
            {teacherPinError ? <span className="text-sm font-black text-red-500">{teacherPinError}</span> : null}
          </label>
        </div>

        <form onSubmit={joinStudentRoom} className="bo-card self-center p-5">
          <p className="bo-label">STUDENT JOIN</p>
          <h2 className="bo-heading mt-2 text-2xl">학생 모둠 접속</h2>
          <label className="mt-5 grid gap-2 text-sm font-extrabold text-[var(--color-text-muted)]">
            6자리 PIN
            <input
              inputMode="numeric"
              maxLength={6}
              value={studentPin}
              onChange={(event) => setStudentPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
              className="bo-input h-12 px-3 text-xl font-black tracking-widest"
              placeholder="123456"
            />
          </label>
          <label className="mt-4 grid gap-2 text-sm font-extrabold text-[var(--color-text-muted)]">
            모둠명
            <input
              value={teamName}
              onChange={(event) => setTeamName(event.target.value)}
              className="bo-input h-12 px-3 text-base font-bold"
              placeholder="1모둠"
            />
          </label>
          <button
            type="submit"
            disabled={studentPin.length !== 6 || !teamName.trim()}
            className="bo-button-primary mt-5 w-full px-4 py-3 text-base"
          >
            입장하기
          </button>
          <FirebaseSettingsPanel />
        </form>
      </section>
    </main>
  );
}

function TeacherLock({ pin }) {
  const [teacherPin, setTeacherPin] = useState("");
  const [teacherPinError, setTeacherPinError] = useState("");

  function unlockTeacherRoom(event) {
    event.preventDefault();
    if (teacherPin !== TEACHER_PIN) {
      setTeacherPinError("교사용 PIN을 확인해 주세요.");
      return;
    }

    grantTeacherAccess();
    navigateTo(`/teacher/${pin}`);
  }

  return (
    <main className="bo-page flex min-h-screen items-center justify-center p-5">
      <form onSubmit={unlockTeacherRoom} className="bo-card w-full max-w-md p-6">
        <p className="bo-label">TEACHER ACCESS</p>
        <h1 className="bo-heading mt-2 text-2xl">교사용 대시보드 잠금</h1>
        <label className="mt-6 grid gap-2 text-sm font-extrabold text-[var(--color-text-muted)]">
          교사용 PIN
          <input
            inputMode="numeric"
            maxLength={4}
            value={teacherPin}
            onChange={(event) => {
              setTeacherPin(event.target.value.replace(/\D/g, "").slice(0, 4));
              setTeacherPinError("");
            }}
            className="bo-input h-[70px] px-4 text-2xl font-black tracking-wide"
            placeholder="교사용 PIN 4자리"
            autoFocus
          />
        </label>
        {teacherPinError ? <p className="mt-3 text-sm font-black text-red-500">{teacherPinError}</p> : null}
        <button
          type="submit"
          disabled={teacherPin.length !== 4}
          className="bo-button-primary mt-5 w-full px-4 py-3 text-base"
        >
          대시보드 들어가기
        </button>
        <button
          type="button"
          onClick={() => navigateTo("/")}
          className="mt-3 w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-black text-[var(--color-brand-ink)]"
        >
          처음으로
        </button>
      </form>
    </main>
  );
}

function NotFound() {
  return (
    <main className="bo-page flex items-center justify-center p-5">
      <section className="bo-card p-6 text-center">
        <h1 className="bo-heading text-2xl">페이지를 찾을 수 없습니다</h1>
        <button
          type="button"
          onClick={() => navigateTo("/")}
          className="bo-button-primary mt-4 px-4 py-2 text-sm"
        >
          처음으로
        </button>
      </section>
    </main>
  );
}

export default function App() {
  const route = useRoute();
  const [role, pin, teamId] = route.segments;

  if (route.segments.length === 0) return <Home />;

  if (role === "teacher" && pin) {
    if (!hasTeacherAccess()) return <TeacherLock pin={pin} />;
    return <TeacherBoard key={`teacher-${pin}`} pin={pin} />;
  }

  if (role === "student" && pin && teamId) {
    const teamName = route.query.get("name") || teamId;
    return <StudentMap key={`student-${pin}-${teamId}`} pin={pin} teamId={teamId} teamName={teamName} />;
  }

  return <NotFound />;
}
