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
    const match = rawText.match(new RegExp(`["']?${key}["']?\\s*:\\s*["']([^"']*)["']`));
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

function BackButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="fixed left-5 top-5 z-20 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-black text-white/80 shadow-lg backdrop-blur transition hover:bg-white/20"
    >
      처음으로
    </button>
  );
}

function PinDigitRow({ value, length, onChange, accent = "blue", autoFocus = false }) {
  const digits = Array.from({ length }, (_, index) => value[index] || "");
  const focusInput = (index) => {
    const input = document.querySelector(`[data-pin-index="${accent}-${index}"]`);
    input?.focus();
  };

  return (
    <div className="flex justify-center gap-1.5 sm:gap-2">
      {digits.map((digit, index) => (
        <input
          key={index}
          data-pin-index={`${accent}-${index}`}
          inputMode="numeric"
          maxLength={1}
          autoFocus={autoFocus && index === 0}
          value={digit}
          onChange={(event) => {
            const clean = event.target.value.replace(/\D/g, "");
            if (!clean) {
              onChange(value.slice(0, index) + value.slice(index + 1));
              return;
            }

            const nextDigits = [...digits];
            clean
              .slice(0, length - index)
              .split("")
              .forEach((char, offset) => {
                nextDigits[index + offset] = char;
              });
            onChange(nextDigits.join("").slice(0, length));
            focusInput(Math.min(index + clean.length, length - 1));
          }}
          onKeyDown={(event) => {
            if (event.key === "Backspace" && !digit && index > 0) focusInput(index - 1);
            if (event.key === "ArrowLeft" && index > 0) focusInput(index - 1);
            if (event.key === "ArrowRight" && index < length - 1) focusInput(index + 1);
          }}
          onPaste={(event) => {
            event.preventDefault();
            onChange(event.clipboardData.getData("text").replace(/\D/g, "").slice(0, length));
          }}
          onFocus={(event) => event.target.select()}
          className={`h-14 w-11 rounded-xl border-2 bg-white/[0.08] text-center text-2xl font-black text-white outline-none transition sm:h-[58px] sm:w-[46px] ${
            digit ? "border-white/35" : "border-white/15"
          } ${accent === "teal" ? "focus:border-teal-500 focus:bg-teal-500/15" : "focus:border-blue-500 focus:bg-blue-500/15"}`}
        />
      ))}
    </div>
  );
}

function Home() {
  const [screen, setScreen] = useState("landing");
  const [studentPin, setStudentPin] = useState("");
  const [teamName, setTeamName] = useState("");
  const [teacherPin, setTeacherPin] = useState("");
  const [teacherPinError, setTeacherPinError] = useState("");
  const [teacherModalOpen, setTeacherModalOpen] = useState(false);

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

function LandingHome() {
  const [screen, setScreen] = useState("landing");
  const [studentPin, setStudentPin] = useState("");
  const [teamName, setTeamName] = useState("");
  const [teacherPin, setTeacherPin] = useState("");
  const [teacherPinError, setTeacherPinError] = useState("");
  const [teacherModalOpen, setTeacherModalOpen] = useState(false);

  function createTeacherRoom() {
    if (teacherPin !== TEACHER_PIN) {
      setTeacherPinError("교사용 PIN을 다시 확인해주세요.");
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
    <main className="min-h-screen overflow-hidden bg-[#0f172a] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(37,99,235,0.28),transparent_70%)]" />
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.03) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      {screen === "landing" ? (
        <section className="relative z-10 flex min-h-screen items-center justify-center px-5 py-10">
          <div className="w-full max-w-3xl text-center">
            <span className="inline-flex rounded-full border border-blue-500/40 bg-blue-600/20 px-4 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-blue-200">
              BOOONG CLASSROOM GAME
            </span>
            <h1 className="mt-6 text-5xl font-black leading-[1.08] tracking-normal text-white sm:text-7xl">
              지도를 훔친 아이들
            </h1>
            <p className="mt-4 text-xl font-black text-blue-200 sm:text-2xl">게리맨더링의 마법</p>
            <p className="mx-auto mt-5 max-w-xl text-base font-semibold leading-7 text-white/55">
              세종시 읍·면·동 지도를 다시 나누며 같은 표가 선거구 획정에 따라 전혀 다른 결과로
              바뀌는 순간을 직접 실험합니다.
            </p>

            <div className="mx-auto mt-10 grid max-w-xl gap-4 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setScreen("student")}
                className="group relative overflow-hidden rounded-[20px] border border-transparent bg-gradient-to-br from-blue-700 to-blue-600 p-7 text-left shadow-[0_8px_32px_rgba(37,99,235,.38)] hover:-translate-y-1 hover:shadow-[0_14px_42px_rgba(37,99,235,.5)]"
              >
                <span className="text-3xl" aria-hidden="true">🗺️</span>
                <span className="mt-4 block text-xl font-black">학생으로 입장</span>
                <span className="mt-2 block text-sm font-bold leading-6 text-white/75">
                  PIN을 입력하고 모둠과 함께 지도를 그려보세요.
                </span>
                <span className="absolute right-5 top-1/2 -translate-y-1/2 text-2xl font-black text-white/35 group-hover:text-white/60">
                  →
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setTeacherModalOpen(true);
                  setTeacherPin("");
                  setTeacherPinError("");
                }}
                className="group relative overflow-hidden rounded-[20px] border border-white/12 bg-white/[0.06] p-7 text-left shadow-[0_4px_20px_rgba(0,0,0,.3)] hover:-translate-y-1 hover:bg-white/[0.1] hover:shadow-[0_10px_32px_rgba(0,0,0,.4)]"
              >
                <span className="text-3xl" aria-hidden="true">📺</span>
                <span className="mt-4 block text-xl font-black">교사로 시작</span>
                <span className="mt-2 block text-sm font-bold leading-6 text-white/60">
                  수업 방을 만들고 모둠 결과를 비교하세요.
                </span>
                <span className="absolute right-5 top-1/2 -translate-y-1/2 text-2xl font-black text-white/30 group-hover:text-white/55">
                  →
                </span>
              </button>
            </div>

            <div className="mx-auto mt-6 max-w-xl text-left">
              <FirebaseSettingsPanel />
            </div>
          </div>
        </section>
      ) : null}

      {screen === "student" ? (
        <section className="relative z-10 flex min-h-screen items-center justify-center px-5 py-16">
          <BackButton onClick={() => setScreen("landing")} />
          <form onSubmit={joinStudentRoom} className="w-full max-w-[400px]">
            <div className="text-center">
              <h1 className="text-2xl font-black text-blue-200">지도를 훔친 아이들</h1>
              <p className="mt-2 text-sm font-bold text-white/35">교사가 알려준 PIN을 입력하세요</p>
            </div>

            <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.06] p-7 shadow-2xl backdrop-blur">
              <label className="block">
                <span className="mb-3 block text-xs font-black uppercase tracking-[0.08em] text-white/50">
                  수업 PIN 6자리
                </span>
                <PinDigitRow value={studentPin} length={6} onChange={setStudentPin} />
              </label>

              <div className="my-6 h-px bg-white/[0.08]" />

              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-[0.08em] text-white/50">
                  모둠 이름
                </span>
                <input
                  value={teamName}
                  onChange={(event) => setTeamName(event.target.value)}
                  className="h-[52px] w-full rounded-xl border-2 border-white/15 bg-white/[0.08] px-4 text-base font-extrabold text-white outline-none transition placeholder:text-white/25 focus:border-blue-500"
                  placeholder="예: 1모둠"
                />
              </label>

              <button
                type="submit"
                disabled={studentPin.length !== 6 || !teamName.trim()}
                className="mt-6 flex h-[54px] w-full items-center justify-center rounded-[14px] bg-blue-600 text-base font-black text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/30 disabled:shadow-none"
              >
                입장하기
              </button>
            </div>

            <p className="mt-5 text-center text-xs font-bold leading-6 text-white/30">
              이름은 같은 모둠이 모두 동일하게 입력해야 같은 모둠으로 묶입니다.
            </p>
          </form>
        </section>
      ) : null}

      {teacherModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 px-5 backdrop-blur-md"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setTeacherModalOpen(false);
          }}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              createTeacherRoom();
            }}
            className="w-full max-w-[360px] rounded-3xl border border-white/12 bg-slate-800 p-7 shadow-[0_24px_64px_rgba(0,0,0,.5)]"
          >
            <h2 className="text-lg font-black">교사 인증</h2>
            <p className="mt-2 text-sm font-bold leading-6 text-white/40">교사용 PIN 4자리를 입력하세요.</p>

            <div className="mt-6">
              <PinDigitRow
                value={teacherPin}
                length={4}
                onChange={(nextPin) => {
                  setTeacherPin(nextPin);
                  setTeacherPinError("");
                }}
                accent="teal"
                autoFocus
              />
            </div>

            {teacherPinError ? (
              <p className="mt-4 min-h-[18px] text-center text-sm font-black text-red-400">{teacherPinError}</p>
            ) : (
              <div className="mt-4 h-[18px]" />
            )}

            <button
              type="submit"
              disabled={teacherPin.length !== 4}
              className="mt-3 h-12 w-full rounded-xl bg-teal-700 text-base font-black text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/25"
            >
              확인
            </button>
            <button
              type="button"
              onClick={() => setTeacherModalOpen(false)}
              className="mt-3 h-12 w-full rounded-xl border border-white/12 bg-transparent text-sm font-black text-white/50 hover:bg-white/[0.06]"
            >
              취소
            </button>
          </form>
        </div>
      ) : null}
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

  if (route.segments.length === 0) return <LandingHome />;

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
