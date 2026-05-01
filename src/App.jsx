import React, { useEffect, useState } from "react";
import StudentMap from "./components/StudentMap";
import TeacherBoard from "./components/TeacherBoard";

function generatePin() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function navigateTo(path) {
  window.location.hash = path;
  window.dispatchEvent(new HashChangeEvent("hashchange"));
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

function Home() {
  const [studentPin, setStudentPin] = useState("");
  const [teamName, setTeamName] = useState("");

  function createTeacherRoom() {
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
        </form>
      </section>
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
    return <TeacherBoard key={`teacher-${pin}`} pin={pin} />;
  }

  if (role === "student" && pin && teamId) {
    const teamName = route.query.get("name") || teamId;
    return <StudentMap key={`student-${pin}-${teamId}`} pin={pin} teamId={teamId} teamName={teamName} />;
  }

  return <NotFound />;
}
