import React, { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_ELECTION_DATASET_ID,
  DEFAULT_MISSION_TYPE,
  DISTRICTS,
  ELECTION_DATASETS,
  MISSION_TYPES,
  PARTIES,
  PARTY_IDS,
  RECOMMENDED_DISTRICT_COUNT,
  getElectionDataset,
  getPopulationRange,
  validatePlan,
} from "../data/gerrymandering";
import useGerrymandering from "../hooks/useGerrymandering";
import SejongMap from "./SejongMap";

const STATUS_LABEL = {
  in_progress: "진행 중",
  contiguity_error: "인접성 오류",
  ready: "저장 가능",
  submitted: "저장 완료",
  mission_success: "미션 성공!",
};

function partyName(partyId) {
  return PARTIES.find((party) => party.id === partyId)?.name || partyId;
}

function formatTime(milliseconds) {
  if (!milliseconds || milliseconds <= 0) return "00:00";
  const totalSeconds = Math.ceil(milliseconds / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function statusClass(status) {
  if (status === "mission_success") return "bg-emerald-100 text-emerald-700";
  if (status === "submitted") return "bg-blue-100 text-blue-800";
  if (status === "contiguity_error") return "bg-red-100 text-red-700";
  if (status === "ready") return "bg-yellow-100 text-yellow-800";
  return "bg-slate-100 text-slate-500";
}

function rankClass(index) {
  if (index === 0) return "bg-yellow-100 text-yellow-800";
  if (index === 1) return "bg-slate-100 text-slate-600";
  if (index === 2) return "bg-orange-100 text-orange-800";
  return "bg-blue-50 text-blue-800";
}

function ScoreSummary({
  submission,
  electionDatasetId = DEFAULT_ELECTION_DATASET_ID,
  missionType = DEFAULT_MISSION_TYPE,
}) {
  const evaluation = useMemo(
    () => validatePlan(submission?.assignments || {}, null, { electionId: electionDatasetId, missionType }),
    [electionDatasetId, missionType, submission?.assignments],
  );

  if (!submission) return null;

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-extrabold text-slate-500">
      <span className="text-[#1B6BFF]">민주 {submission.seats?.DEM || 0}</span>
      <span className="text-[#E34848]">국힘 {submission.seats?.PPP || 0}</span>
      <span>왜곡 {evaluation.distortionScore.toFixed(2)}</span>
      <span>미션 {submission.missionScore || 0}점</span>
    </div>
  );
}

function MiniCompareMap({ title, submission, placeholder }) {
  return (
    <section className="flex min-h-0 flex-col overflow-hidden bg-white">
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2">
        <span className="text-[11px] font-black uppercase tracking-[0.08em] text-slate-500">{title}</span>
        <span className={`truncate text-sm font-black ${submission ? "text-slate-900" : "text-slate-400"}`}>
          {submission?.teamName || placeholder}
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden bg-slate-100">
        {submission ? (
          <div className="origin-top scale-[0.44]">
            <div className="w-[720px]">
              <SejongMap assignments={submission.assignments || {}} compact />
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center px-4 text-center text-xs font-bold text-slate-400">
            팀 카드에서 비교 버튼을 누르면 표시됩니다.
          </div>
        )}
      </div>
      <div className="shrink-0 border-t border-slate-200 px-3 py-2">
        {submission ? (
          <ScoreSummary
            submission={submission}
            electionDatasetId={submission.electionDatasetId}
            missionType={submission.missionType}
          />
        ) : (
          <span className="text-[11px] font-extrabold text-slate-400">선택 대기 중</span>
        )}
      </div>
    </section>
  );
}

export default function TeacherBoard({ pin, db, defaultTargetSeats = { DEM: 3, PPP: 2 } }) {
  const [targetSeats, setTargetSeats] = useState(defaultTargetSeats);
  const [electionDatasetId, setElectionDatasetId] = useState(DEFAULT_ELECTION_DATASET_ID);
  const [missionType, setMissionType] = useState(DEFAULT_MISSION_TYPE);
  const [selectedTeamId, setSelectedTeamId] = useState(null);
  const [compareTeamId, setCompareTeamId] = useState(null);
  const [restartArmed, setRestartArmed] = useState(false);
  const [resetArmed, setResetArmed] = useState(false);
  const [panelTab, setPanelTab] = useState("rank");
  const [now, setNow] = useState(Date.now());
  const { db: connectedDb, mission, room, teams, leaderboard, setMission, resetRound, confirmTeams, error } = useGerrymandering({
    pin,
    db,
    autoRegisterTeam: false,
  });

  useEffect(() => {
    if (mission?.electionDatasetId) setElectionDatasetId(mission.electionDatasetId);
  }, [mission?.electionDatasetId]);

  useEffect(() => {
    if (mission?.missionType) setMissionType(mission.missionType);
  }, [mission?.missionType]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const selectedSubmission = useMemo(() => {
    return leaderboard.find((entry) => entry.teamId === selectedTeamId) || leaderboard[0] || null;
  }, [leaderboard, selectedTeamId]);

  const compareSubmission = useMemo(() => {
    return leaderboard.find((entry) => entry.teamId === compareTeamId) || null;
  }, [compareTeamId, leaderboard]);

  const teamEntries = useMemo(
    () =>
      Object.entries(teams || {})
        .map(([teamId, value]) => ({
          teamId,
          teamName: value?.teamName || teamId,
          online: Boolean(value?.online),
          lastSeenAt: value?.lastSeenAt || null,
        }))
        .sort((left, right) => left.teamName.localeCompare(right.teamName, "ko")),
    [teams],
  );

  const populationRange = getPopulationRange(DISTRICTS.length);
  const selectedElectionDataset = getElectionDataset(mission?.electionDatasetId || electionDatasetId);
  const selectedMissionType = mission?.missionType || missionType;
  const selectedMissionConfig = MISSION_TYPES[selectedMissionType] || MISSION_TYPES[DEFAULT_MISSION_TYPE];
  const hasMission = Boolean(mission);
  const hasSubmission = leaderboard.length > 0;
  const submittedCount = leaderboard.filter((entry) => entry.status === "submitted" || entry.status === "mission_success").length;
  const successCount = leaderboard.filter((entry) => entry.status === "mission_success" || entry.missionSuccess).length;
  const teamCount = teamEntries.length;
  const progressTotal = Math.max(teamCount, leaderboard.length, 1);
  const progressWidth = `${Math.min(100, (submittedCount / progressTotal) * 100)}%`;
  const remainingTime = mission?.endsAt ? mission.endsAt - now : null;

  useEffect(() => {
    setRestartArmed(false);
    setResetArmed(false);
  }, [electionDatasetId, leaderboard.length, mission?.startedAtClient, missionType, targetSeats.DEM, targetSeats.PPP]);

  async function startMission() {
    if (hasMission && !restartArmed) {
      setRestartArmed(true);
      return;
    }

    const dataset = getElectionDataset(electionDatasetId);
    const missionConfig = MISSION_TYPES[missionType] || MISSION_TYPES[DEFAULT_MISSION_TYPE];
    await setMission({
      targetSeats,
      electionDatasetId,
      missionType,
      durationSeconds: 1200,
      title:
        missionType === "target_seats"
          ? `세종시 선거구 재획정: ${dataset.name}, 민주 ${targetSeats.DEM}석, 국힘 ${targetSeats.PPP}석`
          : `세종시 선거구 재획정: ${dataset.name}, ${missionConfig.name}`,
    });
    await resetRound();
    setSelectedTeamId(null);
    setCompareTeamId(null);
    setRestartArmed(false);
  }

  async function handleResetRound() {
    if (hasSubmission && !resetArmed) {
      setResetArmed(true);
      return;
    }

    await resetRound();
    setSelectedTeamId(null);
    setCompareTeamId(null);
    setResetArmed(false);
  }

  function updateSeatTarget(partyId, value) {
    setTargetSeats((current) => ({
      ...current,
      [partyId]: Math.max(0, Math.min(DISTRICTS.length, Number(value))),
    }));
  }

  const phaseSteps = [
    { label: "모둠 입장", done: teamEntries.length > 0, active: teamEntries.length === 0 },
    { label: "모둠 확정", done: Boolean(room?.teamsConfirmed), active: teamEntries.length > 0 && !room?.teamsConfirmed },
    { label: "미션 시작", done: hasMission, active: Boolean(room?.teamsConfirmed) && !hasMission },
    { label: "결과 비교", done: hasSubmission, active: hasMission },
  ];

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-slate-100 text-slate-800">
      <header className="grid h-[60px] shrink-0 grid-cols-[auto_minmax(0,1fr)_auto_auto_auto] items-center bg-slate-950 text-white">
        <div className="flex h-full flex-col justify-center border-r border-white/10 px-5">
          <span className="text-[9px] font-black uppercase tracking-[0.12em] text-blue-300">Teacher Dashboard</span>
          <span className="text-[15px] font-black">지도를 훔친 자들</span>
        </div>

        <nav className="flex min-w-0 items-center gap-0 px-5">
          {phaseSteps.map((step, index) => (
            <React.Fragment key={step.label}>
              <div className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 ${step.active ? "bg-blue-600/35" : ""}`}>
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black ${
                    step.done ? "bg-emerald-600" : step.active ? "bg-blue-600" : "bg-white/15"
                  }`}
                >
                  {step.done ? "✓" : index + 1}
                </span>
                <span className={`whitespace-nowrap text-xs font-extrabold ${step.active ? "text-white" : "text-white/60"}`}>
                  {step.label}
                </span>
                {index === 3 ? (
                  <button
                    type="button"
                    className="ml-1 rounded-lg border border-white/20 bg-white/10 px-3 py-1 text-xs font-black text-white transition hover:bg-white/20"
                  >
                    발표 모드 📺
                  </button>
                ) : null}
              </div>
              {index < phaseSteps.length - 1 ? <span className="mx-[-4px] text-sm text-white/20">›</span> : null}
            </React.Fragment>
          ))}
        </nav>

        <div className="flex h-full min-w-20 flex-col items-center justify-center border-l border-white/10 px-4">
          <div className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${connectedDb ? "bg-emerald-400 shadow-[0_0_0_3px_rgba(34,197,94,0.22)]" : "bg-yellow-500"}`} />
            <span className="text-xl font-black leading-none">{teamCount}</span>
          </div>
          <span className="mt-0.5 text-[10px] font-extrabold text-blue-300">모둠 접속</span>
        </div>
        <div className="flex h-full min-w-20 flex-col items-center justify-center border-l border-white/10 px-4">
          <span className="text-xl font-black leading-none text-emerald-300">
            {submittedCount}
            <span className="text-sm text-emerald-400">/{Math.max(teamCount, leaderboard.length)}</span>
          </span>
          <span className="mt-0.5 text-[10px] font-extrabold text-blue-300">제출 완료</span>
        </div>
        <div className="flex h-full min-w-24 flex-col items-center justify-center border-l border-white/10 px-4">
          <span className="tabular-nums text-[22px] font-black leading-none text-yellow-300">{formatTime(remainingTime)}</span>
          <span className="mt-0.5 text-[10px] font-extrabold text-blue-300">남은 시간</span>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[320px_minmax(0,1fr)] overflow-hidden">
        <aside className="flex min-h-0 flex-col overflow-hidden border-r border-slate-200 bg-white">
          <div className="grid shrink-0 grid-cols-3 border-b border-slate-200">
            {[
              ["settings", "설정"],
              ["teams", "모둠"],
              ["rank", "순위"],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setPanelTab(id)}
                className={`border-b-2 py-3 text-xs font-black ${
                  panelTab === id ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3.5">
            {panelTab === "settings" ? (
              <>
                <section className="rounded-xl border border-slate-200 bg-white">
                  <div className="flex flex-col gap-3 p-3">
                    <label className="grid gap-1.5">
                      <span className="text-[11px] font-black text-slate-500">미션 유형</span>
                      <select
                        value={missionType}
                        onChange={(event) => setMissionType(event.target.value)}
                        className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-extrabold outline-none focus:border-blue-600"
                      >
                        {Object.values(MISSION_TYPES).map((missionItem) => (
                          <option key={missionItem.id} value={missionItem.id}>
                            {missionItem.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="grid gap-1.5">
                      <span className="text-[11px] font-black text-slate-500">선거 데이터</span>
                      <select
                        value={electionDatasetId}
                        onChange={(event) => setElectionDatasetId(event.target.value)}
                        className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-extrabold outline-none focus:border-blue-600"
                      >
                        {Object.values(ELECTION_DATASETS).map((dataset) => (
                          <option key={dataset.id} value={dataset.id}>
                            {dataset.name} · {dataset.sourceLabel}
                          </option>
                        ))}
                      </select>
                      <span className="text-[11px] font-bold leading-5 text-slate-400">{selectedElectionDataset.description}</span>
                    </label>

                    {missionType === "target_seats" ? (
                      <div>
                        <span className="mb-2 block text-[11px] font-black text-slate-500">목표 의석</span>
                        <div className="grid grid-cols-2 gap-2">
                          {PARTY_IDS.map((partyId) => (
                            <label key={partyId} className="grid gap-1">
                              <span
                                className="text-[11px] font-black"
                                style={{ color: partyId === "DEM" ? "#1B6BFF" : "#E34848" }}
                              >
                                {partyName(partyId)}
                              </span>
                              <input
                                type="number"
                                min="0"
                                max={DISTRICTS.length}
                                value={targetSeats[partyId]}
                                onChange={(event) => updateSeatTarget(partyId, event.target.value)}
                                className={`h-12 rounded-xl border-2 bg-white text-center text-2xl font-black outline-none ${
                                  partyId === "DEM" ? "border-blue-200 text-[#1B6BFF]" : "border-red-200 text-[#E34848]"
                                }`}
                              />
                            </label>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-[11px] font-extrabold leading-5 text-blue-900">
                      인구 기준: 선거구당 {Math.round(populationRange.averagePopulation).toLocaleString("ko-KR")}명 · 허용 범위 ±10%
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold leading-5 text-slate-500">
                      {selectedMissionConfig.description} 권장 선거구 수는 {RECOMMENDED_DISTRICT_COUNT}개입니다.
                    </div>
                  </div>
                </section>

                <button
                  type="button"
                  onClick={startMission}
                  className={`rounded-xl px-4 py-3 text-sm font-black ${
                    hasMission && !restartArmed
                      ? "border border-yellow-200 bg-yellow-50 text-yellow-800"
                      : "bg-blue-600 text-white hover:bg-blue-800"
                  }`}
                >
                  {!hasMission ? "라운드 시작" : restartArmed ? "정말 다시 시작" : "다시 시작 준비"}
                </button>
                <button
                  type="button"
                  onClick={handleResetRound}
                  disabled={!hasSubmission}
                  className={`rounded-xl border px-4 py-2.5 text-xs font-black disabled:opacity-45 ${
                    resetArmed ? "border-red-200 bg-red-50 text-red-700" : "border-slate-200 bg-slate-50 text-slate-700"
                  }`}
                >
                  {resetArmed ? "정말 초기화" : "제출 초기화"}
                </button>
                {restartArmed ? (
                  <p className="rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 text-[11px] font-black leading-5 text-yellow-800">
                    다시 시작하면 현재 제출 현황이 초기화됩니다. 계속하려면 한 번 더 누르세요.
                  </p>
                ) : null}
                {resetArmed ? (
                  <p className="rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 text-[11px] font-black leading-5 text-yellow-800">
                    현재 제출 현황만 초기화됩니다. 계속하려면 한 번 더 누르세요.
                  </p>
                ) : null}
                {error ? <p className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-900">{error.message}</p> : null}
              </>
            ) : null}

            {panelTab === "teams" ? (
              <>
                <section className="rounded-2xl bg-slate-950 p-4 text-center">
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-blue-300">학생 입장 PIN</p>
                  <p className="mt-1 text-5xl font-black tracking-[0.18em] text-white">{pin}</p>
                  <p className="mt-2 text-[11px] font-extrabold text-blue-300">학생 태블릿 첫 화면에 입력</p>
                </section>

                <section>
                  <div className="mb-2 flex items-center justify-between">
                    <h2 className="text-sm font-black text-slate-900">입장 모둠</h2>
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-black text-blue-800">{teamEntries.length}팀</span>
                  </div>
                  <div className="grid gap-1.5">
                    {teamEntries.length === 0 ? (
                      <p className="rounded-lg bg-slate-50 p-4 text-center text-sm font-bold text-slate-400">아직 입장한 모둠이 없습니다.</p>
                    ) : (
                      teamEntries.map((team) => (
                        <div key={team.teamId} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                          <span className="text-sm font-black text-slate-900">{team.teamName}</span>
                          <span className={`rounded-full px-2 py-1 text-[10px] font-black ${team.online ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"}`}>
                            {team.online ? "접속 중" : "오프라인"}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </section>

                <button
                  type="button"
                  onClick={() => confirmTeams(teamEntries)}
                  disabled={teamEntries.length === 0 || room?.teamsConfirmed}
                  className={`rounded-xl px-4 py-3 text-sm font-black disabled:opacity-45 ${
                    room?.teamsConfirmed ? "border border-slate-200 bg-slate-50 text-slate-700" : "bg-blue-600 text-white hover:bg-blue-800"
                  }`}
                >
                  {room?.teamsConfirmed ? "참여 모둠 확정 완료" : "참여 모둠 확정"}
                </button>
                {room?.teamsConfirmed ? (
                  <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-black leading-5 text-emerald-700">
                    확정 완료: {(room.confirmedTeamNames || []).join(", ") || `${teamEntries.length}팀`}
                  </p>
                ) : null}
              </>
            ) : null}

            {panelTab === "rank" ? (
              <>
                <section>
                  <div className="mb-2 flex items-center justify-between">
                    <h2 className="text-sm font-black text-slate-900">미션 성공 순위</h2>
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-black text-blue-800">{successCount}/{Math.max(teamCount, leaderboard.length)} 성공</span>
                  </div>
                  <div className="grid gap-1">
                    {leaderboard.length === 0 ? (
                      <p className="rounded-lg bg-slate-50 p-4 text-center text-sm font-bold text-slate-400">아직 제출 현황이 없습니다.</p>
                    ) : (
                      leaderboard.map((entry, index) => (
                        <button
                          key={entry.teamId}
                          type="button"
                          onClick={() => setSelectedTeamId(entry.teamId)}
                          className="grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-2 rounded-lg px-2 py-2 text-left transition hover:bg-slate-50"
                        >
                          <span className={`flex h-7 w-7 items-center justify-center rounded-lg text-sm font-black ${rankClass(index)}`}>
                            {entry.missionRank || index + 1}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-black text-slate-900">{entry.teamName}</span>
                            <span className="block truncate text-[10px] font-bold text-slate-500">
                              민주 {entry.seats?.DEM || 0} · 국힘 {entry.seats?.PPP || 0} · 미션 {entry.missionScore || 0}점
                            </span>
                          </span>
                          <span className={`rounded-full px-2 py-1 text-[10px] font-black ${statusClass(entry.status)}`}>
                            {STATUS_LABEL[entry.status] || entry.status}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </section>
                <div className="h-px bg-slate-200" />
                <p className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-[11px] font-extrabold leading-5 text-blue-900">
                  지도 카드를 클릭하거나 순위 항목을 클릭하면 해당 모둠 지도를 아래 비교 슬롯에서 볼 수 있습니다.
                </p>
              </>
            ) : null}
          </div>
        </aside>

        <section className="flex min-h-0 flex-col overflow-hidden">
          <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5 py-3">
            <h1 className="text-base font-black text-slate-900">모둠별 제출 현황</h1>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5">
                <div className="h-1.5 w-20 overflow-hidden rounded-full bg-blue-100">
                  <div className="h-full rounded-full bg-blue-600" style={{ width: progressWidth }} />
                </div>
                <span className="text-xs font-black text-blue-900">
                  {submittedCount} / {Math.max(teamCount, leaderboard.length)} 제출
                </span>
              </div>
              <button type="button" className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-black text-slate-700">
                정렬: 점수순 ▾
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
              {leaderboard.length === 0 ? (
                <div className="col-span-full flex min-h-[240px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white text-sm font-bold text-slate-400">
                  학생 제출이 들어오면 이곳에 모둠 카드가 표시됩니다.
                </div>
              ) : (
                leaderboard.map((entry) => {
                  const totalVotes = (entry.districtResults || []).reduce((sum, result) => sum + (result.totalVotes || 0), 0);
                  const demVotes = (entry.districtResults || []).reduce((sum, result) => sum + (result.votes?.DEM || 0), 0);
                  const pppVotes = (entry.districtResults || []).reduce((sum, result) => sum + (result.votes?.PPP || 0), 0);
                  const demFlex = totalVotes > 0 ? demVotes : 1;
                  const pppFlex = totalVotes > 0 ? pppVotes : 1;
                  const selected = selectedSubmission?.teamId === entry.teamId;
                  const compared = compareSubmission?.teamId === entry.teamId;
                  const success = entry.status === "mission_success" || entry.missionSuccess;

                  return (
                    <article
                      key={entry.teamId}
                      onClick={() => setSelectedTeamId(entry.teamId)}
                      className={`cursor-pointer overflow-hidden rounded-2xl border bg-white transition hover:border-blue-500 hover:shadow-md ${
                        success ? "border-emerald-500" : "border-slate-200"
                      } ${selected || compared ? "ring-4 ring-blue-200" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-2 px-3.5 pb-2 pt-3">
                        <h2 className="truncate text-base font-black text-slate-900">{entry.teamName}</h2>
                        <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black ${statusClass(entry.status)}`}>
                          {success ? "미션 성공" : STATUS_LABEL[entry.status] || entry.status}
                        </span>
                      </div>
                      <div className="px-3.5 pb-3">
                        <div className="mt-1 flex items-center gap-2">
                          <div className="flex flex-1 flex-col items-center rounded-lg bg-blue-50 px-3 py-1.5">
                            <span className="text-2xl font-black leading-none text-[#1B6BFF]">{entry.seats?.DEM || 0}</span>
                            <span className="text-[9px] font-extrabold text-slate-500">민주</span>
                          </div>
                          <div className="flex flex-1 flex-col items-center rounded-lg bg-red-50 px-3 py-1.5">
                            <span className="text-2xl font-black leading-none text-[#E34848]">{entry.seats?.PPP || 0}</span>
                            <span className="text-[9px] font-extrabold text-slate-500">국힘</span>
                          </div>
                        </div>
                        <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-slate-200">
                          <div className="bg-[#1B6BFF] opacity-80" style={{ flex: demFlex }} />
                          <div className="bg-[#E34848] opacity-80" style={{ flex: pppFlex }} />
                        </div>
                        <p className="mt-2 text-[11px] font-extrabold text-slate-500">
                          미션 {entry.missionScore || 0}점 · 왜곡 {Number(entry.distortionScore || 0).toFixed(2)}석 · 인구 위반 {entry.violations?.population ?? 0}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 px-3.5 pb-3">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedTeamId(entry.teamId);
                          }}
                          className="rounded-lg bg-blue-600 px-3 py-2 text-[11px] font-black text-white hover:bg-blue-800"
                        >
                          좌측 비교
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setCompareTeamId(entry.teamId);
                          }}
                          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-black text-slate-700 hover:bg-slate-100"
                        >
                          우측 비교
                        </button>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </div>

          <div className="grid h-[220px] shrink-0 grid-cols-2 gap-px border-t border-slate-200 bg-slate-200">
            <MiniCompareMap title="비교 A" submission={selectedSubmission} placeholder="팀을 선택하세요" />
            <MiniCompareMap title="비교 B" submission={compareSubmission} placeholder="팀을 선택하세요" />
          </div>
        </section>
      </div>
    </main>
  );
}
