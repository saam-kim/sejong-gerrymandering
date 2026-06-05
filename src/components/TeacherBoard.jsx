import React, { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_ELECTION_DATASET_ID,
  DEFAULT_MISSION_TYPE,
  DISTRICTS,
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

function FullscreenCompareView({ leftSubmission, rightSubmission, onClose }) {
  const panes = [
    { title: "비교 A", submission: leftSubmission, placeholder: "팀을 선택하세요" },
    { title: "비교 B", submission: rightSubmission, placeholder: "팀을 선택하세요" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-white">
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 px-5">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-blue-300">Comparison View</p>
          <h2 className="text-lg font-black">지도 비교</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-white/15 bg-white/10 px-4 py-2 text-sm font-black text-white hover:bg-white/20"
        >
          닫기
        </button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-2 gap-px bg-white/10">
        {panes.map((pane) => (
          <section key={pane.title} className="flex min-h-0 flex-col bg-slate-100 text-slate-900">
            <div className="flex h-12 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4">
              <span className="text-xs font-black text-slate-500">{pane.title}</span>
              <span className="truncate text-base font-black">{pane.submission?.teamName || pane.placeholder}</span>
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-slate-50 p-4">
              {pane.submission ? (
                <div className="w-full max-w-[760px]">
                  <SejongMap assignments={pane.submission.assignments || {}} showVoteCallouts={false} />
                </div>
              ) : (
                <p className="text-sm font-bold text-slate-400">팀 카드에서 비교 버튼을 누르면 표시됩니다.</p>
              )}
            </div>
            <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-2">
              {pane.submission ? (
                <ScoreSummary
                  submission={pane.submission}
                  electionDatasetId={pane.submission.electionDatasetId}
                  missionType={pane.submission.missionType}
                />
              ) : (
                <span className="text-[11px] font-extrabold text-slate-400">선택 대기 중</span>
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function TeacherRoundBadge({ missionConfig, active = false }) {
  return (
    <div className={`mr-3 flex items-center gap-2 rounded-xl border px-3 py-1.5 ${
      active ? "border-blue-400 bg-blue-600/25" : "border-white/10 bg-white/5"
    }`}>
      <span className="rounded-lg bg-blue-600 px-2 py-1 text-xs font-black text-white">{missionConfig.round || 1}R</span>
      <span className="whitespace-nowrap text-xs font-black text-white">{missionConfig.name}</span>
    </div>
  );
}

function ClosingBriefingModal({ onClose }) {
  const cards = [
    {
      title: "생각해보기",
      accent: "var(--color-brand)",
      soft: "var(--color-brand-soft)",
      icon: "⌘",
      items: [
        "선거구 획정의 기본 규칙을 모두 지켰다면, 그 결과도 자동으로 공정하다고 볼 수 있을까요?",
        "2라운드와 3라운드 중 어떤 방식의 선거구 획정이 더 민주적이라고 느껴졌나요? 그 이유는 무엇인가요?",
        "선거구 획정 방식이 의석 결과를 크게 바꿀 수 있다는 점은 민주주의에 어떤 영향을 미칠까요?",
      ],
    },
    {
      title: "같은 표심, 다른 결과",
      accent: "#c2410c",
      soft: "#fff1e7",
      icon: "↯",
      items: [
        "유권자의 지지도가 같아도 선거구를 어떻게 획정하느냐에 따라 정당의 최종 의석수는 극단적으로 달라질 수 있음.",
        "특정 정당이나 후보자에게 유리하도록 선거구를 조정하는 '게리맨더링(Gerrymandering)'이 민주주의의 결과를 어떻게 왜곡하는지 확인함.",
      ],
    },
    {
      title: "투표만큼 중요한 '규칙'",
      accent: "var(--color-case-border)",
      soft: "var(--color-case-bg)",
      icon: "⚖",
      items: [
        "민주주의에서 선거는 스포츠와 유사함. 선수가 아무리 열심히 뛰어도 '게임의 룰(선거구 획정 등 선거 제도)'이 불공정하다면 결과는 정의로울 수 없음.",
        "투표 행위 자체뿐만 아니라, 투표를 의석으로 환산하는 '제도'가 매우 중요함.",
      ],
    },
    {
      title: "공정한 선거를 위한 제도",
      accent: "#b7791f",
      soft: "#fff7e6",
      icon: "▣",
      items: [
        "선거구 법정주의: 법에 따라 선거구를 획정하는 방식",
        "선거 공영제: 국가와 지자체가 선거 과정을 운영하고 규율하며, 선거 비용 일부를 국가 또는 지자체가 부담할 수 있도록 만든 제도",
        "선거 관리 위원회: 정치적으로 중립적인 헌법상의 독립 기관으로, 각종 선거와 국민 투표의 공정한 관리, 정당에 관한 사무를 담당",
      ],
    },
    {
      title: "잊지 말아야 할 우리의 역할",
      accent: "var(--color-brand-deep)",
      soft: "var(--color-question-bg)",
      icon: "◎",
      items: [
        "완벽하게 공정한 선거구는 존재하기 어려움. 그렇기 때문에 우리는 끊임없이 더 공정한 제도를 고민해야 함.",
        "민주주의를 지키는 것은 투표장으로 향하는 것에서 끝나지 않음. 우리의 뜻이 제도를 통해 왜곡 없이 대표되고 있는지 감시하는 깨어있는 시민 의식이 필요함.",
      ],
    },
  ];
  const topCards = cards.slice(0, 3);
  const bottomCards = cards.slice(3);

  return (
    <div className="fixed inset-0 z-50 bg-[var(--color-bg-soft)] p-4 text-[var(--color-text)]">
      <section className="flex h-full w-full flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-strong)] bg-[var(--color-bg-soft)] shadow-2xl">
        <div className="flex shrink-0 items-center justify-between px-8 pb-5 pt-7">
          <div>
            <p className="bo-label text-sm">Class Wrap-up</p>
            <h2 className="bo-heading mt-2 text-4xl">공정한 선거를 위한 노력</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="bo-button-secondary px-6 py-3 text-lg"
          >
            닫기
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-rows-[1fr_0.86fr_auto] gap-5 px-8 pb-8">
        <div className="grid min-h-0 gap-5 lg:grid-cols-3">
          {topCards.map((card) => (
            <article
              key={card.title}
              className="bo-card flex min-h-0 flex-col overflow-hidden"
              style={{ borderTop: `6px solid ${card.accent}` }}
            >
              <div className="flex shrink-0 items-center gap-4 px-6 pt-5">
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-[var(--radius)] text-lg font-black"
                  style={{ backgroundColor: card.soft, color: card.accent }}
                >
                  {card.icon}
                </span>
                <h3 className="text-2xl font-black text-[var(--color-text)]">{card.title}</h3>
              </div>
              <ul className="min-h-0 overflow-y-auto grid gap-4 px-6 pb-6 pt-5 text-[20px] font-bold leading-9 text-[var(--color-text-muted)]">
                {card.items.map((item) => (
                  <li key={item} className="grid grid-cols-[12px_minmax(0,1fr)] gap-2">
                    <span className="mt-[0.7em] h-2 w-2 rounded-full" style={{ backgroundColor: card.accent }} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <div className="grid min-h-0 gap-5 md:grid-cols-2">
          {bottomCards.map((card) => (
            <article
              key={card.title}
              className="bo-card flex min-h-0 flex-col overflow-hidden"
              style={{ borderTop: `6px solid ${card.accent}` }}
            >
              <div className="flex shrink-0 items-center gap-4 px-6 pt-5">
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-[var(--radius)] text-lg font-black"
                  style={{ backgroundColor: card.soft, color: card.accent }}
                >
                  {card.icon}
                </span>
                <h3 className="text-2xl font-black text-[var(--color-text)]">{card.title}</h3>
              </div>
              <ul className="min-h-0 overflow-y-auto grid gap-4 px-6 pb-6 pt-5 text-[20px] font-bold leading-9 text-[var(--color-text-muted)]">
                {card.items.map((item) => (
                  <li key={item} className="grid grid-cols-[12px_minmax(0,1fr)] gap-2">
                    <span className="mt-[0.7em] h-2 w-2 rounded-full" style={{ backgroundColor: card.accent }} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <div className="shrink-0">
          <div className="bo-card px-6 py-5 text-center">
            <p className="text-3xl font-black text-[var(--color-text)]">“선거는 민주주의의 시작일 뿐, 완성은 아니다.”</p>
          </div>
        </div>
        </div>
      </section>
    </div>
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
  const [panelTab, setPanelTab] = useState("mission");
  const [compareExpanded, setCompareExpanded] = useState(false);
  const [closingOpen, setClosingOpen] = useState(false);
  const [now, setNow] = useState(Date.now());
  const { db: connectedDb, mission, room, teams, roundProgress, leaderboard, setMission, resetRound, confirmTeams, pauseTimer, resumeTimer, addTime, resetTimer, error } = useGerrymandering({
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

  const roundMissionItems = useMemo(
    () => Object.values(MISSION_TYPES).sort((left, right) => (left.round || 0) - (right.round || 0)),
    [],
  );

  const submissionByTeamId = useMemo(
    () => new Map(leaderboard.map((entry) => [entry.teamId, entry])),
    [leaderboard],
  );

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
  const activeMissionTypeForNext = hasMission ? mission?.missionType : missionType;
  const currentRoundIndex = roundMissionItems.findIndex((item) => item.id === activeMissionTypeForNext);
  const nextRoundItem = hasMission ? (roundMissionItems[currentRoundIndex + 1] ?? null) : null;
  const hasSubmission = leaderboard.length > 0;
  const submittedCount = leaderboard.filter((entry) => entry.status === "submitted" || entry.status === "mission_success").length;
  const successCount = leaderboard.filter((entry) => entry.status === "mission_success" || entry.missionSuccess).length;
  const teamCount = teamEntries.length;
  const progressTotal = Math.max(teamCount, leaderboard.length, 1);
  const progressWidth = `${Math.min(100, (submittedCount / progressTotal) * 100)}%`;
  const remainingTime = mission?.paused
    ? (mission.pausedRemainingMs ?? 0)
    : mission?.endsAt ? mission.endsAt - now : null;

  useEffect(() => {
    setRestartArmed(false);
    setResetArmed(false);
  }, [electionDatasetId, leaderboard.length, mission?.startedAtClient, missionType, targetSeats.DEM, targetSeats.PPP]);

  async function startMission() {
    if (hasMission && !restartArmed) {
      setRestartArmed(true);
      return;
    }

    const activeMissionType = hasMission ? mission.missionType : missionType;
    const currentIndex = roundMissionItems.findIndex((item) => item.id === activeMissionType);
    const nextItem = hasMission ? roundMissionItems[currentIndex + 1] : null;
    const resolvedMissionType = nextItem ? nextItem.id : missionType;

    const dataset = getElectionDataset(electionDatasetId);
    const missionConfig = MISSION_TYPES[resolvedMissionType] || MISSION_TYPES[DEFAULT_MISSION_TYPE];
    await setMission({
      targetSeats,
      electionDatasetId,
      missionType: resolvedMissionType,
      durationSeconds: missionConfig.durationSeconds || 300,
      title: `${missionConfig.name}: ${dataset.name}`,
    });
    if (nextItem) setMissionType(resolvedMissionType);
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
      <header className="grid h-[60px] shrink-0 grid-cols-[auto_auto_minmax(0,1fr)_auto_auto_auto] items-center bg-slate-950 text-white">
        <div className="flex h-full flex-col justify-center border-r border-white/10 px-5">
          <span className="text-[9px] font-black uppercase tracking-[0.12em] text-blue-300">Teacher Dashboard</span>
          <span className="text-[15px] font-black">지도를 훔친 자들</span>
        </div>

        <div className="flex h-full min-w-[180px] flex-col justify-center border-r border-white/10 px-5">
          <span className="text-[9px] font-black uppercase tracking-[0.12em] text-blue-300">학생 입장 PIN</span>
          <span className="mt-0.5 text-[26px] font-black leading-none tracking-[0.18em] text-white">{pin}</span>
        </div>

        <nav className="flex min-w-0 items-center gap-0 px-5">
          <TeacherRoundBadge missionConfig={selectedMissionConfig} active={hasMission} />
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
                    onClick={() => setClosingOpen(true)}
                    className="ml-1 rounded-lg border border-white/20 bg-white/10 px-3 py-1 text-xs font-black text-white transition hover:bg-white/20"
                  >
                    수업 마무리
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
              ["settings", "가이드"],
              ["teams", "모둠"],
              ["mission", "미션"],
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
                <section className="rounded-xl border border-blue-200 bg-blue-50 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h2 className="text-sm font-black text-blue-950">교사용 수업 안내</h2>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black text-blue-700">3라운드 활동</span>
                  </div>
                  <div className="grid gap-2 text-[11px] font-bold leading-5 text-blue-900">
                    <p><strong>1라운드</strong>는 인접 조건과 인구 조건을 지키며 5개 선거구를 완성하는 연습입니다.</p>
                    <p><strong>2라운드</strong>는 같은 표심에서도 선거구 획정에 따라 의석 결과가 크게 달라질 수 있음을 확인합니다.</p>
                    <p><strong>3라운드</strong>는 득표율과 의석 비율의 차이를 줄이며 더 공정한 획정안을 찾아보는 활동입니다.</p>
                  </div>
                </section>

                <section className="rounded-xl border border-slate-200 bg-white p-3">
                  <h2 className="mb-2 text-sm font-black text-slate-900">수업 운영 팁</h2>
                  <ul className="grid gap-2 text-[11px] font-bold leading-5 text-slate-600">
                    <li>모둠 입장 후 먼저 <strong>모둠 탭</strong>에서 참여 모둠을 확정하세요.</li>
                    <li>라운드 시작 전 이 탭에서 라운드를 선택하고, 시작 후에는 <strong>미션 탭</strong>에서 조건과 진행 현황을 확인하세요.</li>
                    <li>제출된 지도는 카드의 좌측/우측 비교 버튼으로 비교 슬롯에 띄우고, 필요하면 <strong>비교 크게 보기</strong>로 전체 화면에서 설명하세요.</li>
                  </ul>
                </section>

                <section className="rounded-xl border border-slate-200 bg-white">
                  <div className="flex flex-col gap-3 p-3">
                    <label className="grid gap-1.5">
                      <span className="text-[11px] font-black text-slate-500">라운드 확인</span>
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

                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                      <span className="text-[11px] font-black text-slate-500">사용 선거 데이터</span>
                      <p className="mt-1 text-sm font-black text-slate-900">
                        {selectedElectionDataset.name} · {selectedElectionDataset.sourceLabel}
                      </p>
                      <p className="mt-1 text-[11px] font-bold leading-5 text-slate-500">
                        {selectedElectionDataset.description}
                      </p>
                    </div>

                    {missionType === "round2_extreme" ? (
                      <div className="rounded-xl border border-purple-200 bg-purple-50 px-3 py-2 text-[11px] font-extrabold leading-5 text-purple-900">
                        성공 조건: 민주당 4석·국민의힘 1석 또는 민주당 1석·국민의힘 4석
                      </div>
                    ) : null}

                    <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-[11px] font-extrabold leading-5 text-blue-900">
                      인구 기준: {Math.round(populationRange.minPopulation).toLocaleString("ko-KR")}명~{Math.round(populationRange.maxPopulation).toLocaleString("ko-KR")}명
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold leading-5 text-slate-500">
                      {selectedMissionConfig.description} 권장 선거구 수는 {RECOMMENDED_DISTRICT_COUNT}개입니다.
                    </div>
                  </div>
                </section>

              </>
            ) : null}

            {panelTab === "teams" ? (
              <>
                <section>
                  <div className="mb-2 flex items-center justify-between">
                    <h2 className="text-sm font-black text-slate-900">입장 모둠</h2>
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-black text-blue-800">{teamEntries.length}팀</span>
                  </div>
                  <div className="grid gap-1.5">
                    {teamEntries.length === 0 ? (
                      <p className="rounded-lg bg-slate-50 p-4 text-center text-sm font-bold text-slate-400">아직 입장한 모둠이 없습니다.</p>
                    ) : (
                      teamEntries.map((team) => {
                        const currentSubmission = submissionByTeamId.get(team.teamId);
                        const clearedCount = roundMissionItems.filter((roundItem) => {
                          const savedRound = roundProgress?.[team.teamId]?.[roundItem.id];
                          const currentRoundCleared =
                            currentSubmission?.missionType === roundItem.id &&
                            (currentSubmission.status === "mission_success" || currentSubmission.missionSuccess);
                          return savedRound?.success || currentRoundCleared;
                        }).length;

                        return (
                          <div key={team.teamId} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="min-w-0 truncate text-sm font-black text-slate-900">{team.teamName}</span>
                              <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black ${team.online ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"}`}>
                                {team.online ? "접속 중" : "오프라인"}
                              </span>
                            </div>
                            <div className="mt-2 flex items-center justify-between gap-1.5">
                              <div className="flex flex-wrap gap-1">
                                {roundMissionItems.map((roundItem) => {
                                  const savedRound = roundProgress?.[team.teamId]?.[roundItem.id];
                                  const currentRoundCleared =
                                    currentSubmission?.missionType === roundItem.id &&
                                    (currentSubmission.status === "mission_success" || currentSubmission.missionSuccess);
                                  const cleared = savedRound?.success || currentRoundCleared;
                                  return (
                                    <span
                                      key={roundItem.id}
                                      className={`rounded-md border px-1.5 py-0.5 text-[10px] font-black ${
                                        cleared
                                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                          : "border-slate-200 bg-white text-slate-400"
                                      }`}
                                    >
                                      {roundItem.round}R {cleared ? "완료" : "대기"}
                                    </span>
                                  );
                                })}
                              </div>
                              <span className="shrink-0 text-[10px] font-black text-slate-400">{clearedCount}/{roundMissionItems.length}</span>
                            </div>
                          </div>
                        );
                      })
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

            {panelTab === "mission" ? (
              <>
                <section className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <h2 className="text-sm font-black text-slate-900">현재 미션</h2>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-black ${
                      hasMission ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                    }`}>
                      {hasMission ? "진행 중" : "시작 전"}
                    </span>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-[11px] font-black text-slate-500">현재 라운드</span>
                      <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[11px] font-black text-white">
                        {selectedMissionConfig.round || 1}라운드
                      </span>
                    </div>
                    <span className="text-sm font-black text-slate-900">{selectedMissionConfig.name}</span>
                    <p className="mt-1 text-[12px] font-bold leading-5 text-slate-600">{selectedMissionConfig.description}</p>
                  </div>

                  {selectedMissionType === "round2_extreme" ? (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-center">
                        <span className="block text-[10px] font-black text-slate-500">가능 목표 A</span>
                        <span className="mt-1 block text-lg font-black text-[#1B6BFF]">민주 4석</span>
                        <span className="block text-lg font-black text-[#E34848]">국힘 1석</span>
                      </div>
                      <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-center">
                        <span className="block text-[10px] font-black text-slate-500">가능 목표 B</span>
                        <span className="mt-1 block text-lg font-black text-[#1B6BFF]">민주 1석</span>
                        <span className="block text-lg font-black text-[#E34848]">국힘 4석</span>
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-[11px] font-extrabold leading-5 text-blue-900">
                    인구 기준: {Math.round(populationRange.minPopulation).toLocaleString("ko-KR")}명~{Math.round(populationRange.maxPopulation).toLocaleString("ko-KR")}명
                  </div>
                </section>

                <section className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <h2 className="text-sm font-black text-slate-900">진행 현황</h2>
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-black text-blue-800">
                      {successCount}/{Math.max(teamCount, leaderboard.length)} 성공
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-slate-50 px-3 py-2 text-center">
                      <span className="block text-[10px] font-black text-slate-400">제출 완료</span>
                      <span className="mt-1 block text-xl font-black text-slate-900">{submittedCount}</span>
                    </div>
                    <div className="rounded-lg bg-slate-50 px-3 py-2 text-center">
                      <span className="block text-[10px] font-black text-slate-400">남은 시간</span>
                      <span className="mt-1 block text-xl font-black text-slate-900">{formatTime(remainingTime)}</span>
                    </div>
                  </div>
                </section>

                {hasMission ? (
                  <section className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <h2 className="text-sm font-black text-slate-900">타이머 조절</h2>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-black ${mission?.paused ? "bg-yellow-100 text-yellow-800" : "bg-emerald-50 text-emerald-700"}`}>
                        {mission?.paused ? "일시정지" : "진행 중"}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={mission?.paused ? resumeTimer : pauseTimer}
                        className={`rounded-lg px-3 py-2 text-xs font-black ${mission?.paused ? "bg-emerald-600 text-white hover:bg-emerald-700" : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"}`}
                      >
                        {mission?.paused ? "▶ 재개" : "⏸ 일시정지"}
                      </button>
                      <button
                        type="button"
                        onClick={resetTimer}
                        className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-100"
                      >
                        ↺ 시간 초기화
                      </button>
                      <button
                        type="button"
                        onClick={() => addTime(10)}
                        className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-black text-blue-800 hover:bg-blue-100"
                      >
                        +10초
                      </button>
                      <button
                        type="button"
                        onClick={() => addTime(30)}
                        className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-black text-blue-800 hover:bg-blue-100"
                      >
                        +30초
                      </button>
                      <button
                        type="button"
                        onClick={() => addTime(60)}
                        className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-black text-blue-800 hover:bg-blue-100"
                      >
                        +1분
                      </button>
                      <button
                        type="button"
                        onClick={() => addTime(-60)}
                        className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-red-700 hover:bg-red-100"
                      >
                        -1분
                      </button>
                    </div>
                  </section>
                ) : null}
                <button
                  type="button"
                  onClick={startMission}
                  className={`rounded-xl px-4 py-3 text-sm font-black ${
                    hasMission && !restartArmed
                      ? "border border-yellow-200 bg-yellow-50 text-yellow-800"
                      : "bg-blue-600 text-white hover:bg-blue-800"
                  }`}
                >
                  {!hasMission
                    ? "라운드 시작"
                    : restartArmed
                    ? `정말 ${nextRoundItem ? nextRoundItem.name : "다음 라운드"} 시작`
                    : nextRoundItem
                    ? `다음 라운드 시작 (${nextRoundItem.name})`
                    : "다음 라운드 시작"}
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
                    {nextRoundItem ? `${nextRoundItem.name}(으)로` : "다음 라운드로"} 넘어가면 현재 제출 현황이 초기화됩니다. 계속하려면 한 번 더 누르세요.
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

          <div className="flex h-[220px] shrink-0 flex-col border-t border-slate-200 bg-slate-200">
            <div className="flex h-10 shrink-0 items-center justify-center border-b border-slate-200 bg-slate-50">
              <button
                type="button"
                onClick={() => setCompareExpanded(true)}
                className="rounded-full border border-blue-200 bg-white px-3 py-1.5 text-[11px] font-black text-blue-700 shadow-sm hover:bg-blue-50"
              >
                비교 크게 보기
              </button>
            </div>
            <div className="grid min-h-0 flex-1 grid-cols-2 gap-px">
              <MiniCompareMap title="비교 A" submission={selectedSubmission} placeholder="팀을 선택하세요" />
              <MiniCompareMap title="비교 B" submission={compareSubmission} placeholder="팀을 선택하세요" />
            </div>
          </div>

          {compareExpanded ? (
            <FullscreenCompareView
              leftSubmission={selectedSubmission}
              rightSubmission={compareSubmission}
              onClose={() => setCompareExpanded(false)}
            />
          ) : null}
          {closingOpen ? (
            <ClosingBriefingModal
              populationRange={populationRange}
              onClose={() => setClosingOpen(false)}
            />
          ) : null}
        </section>
      </div>
    </main>
  );
}
