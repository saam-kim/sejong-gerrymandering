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
  getDistrictCountReview,
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

function MissionSeats({ targetSeats, missionType = DEFAULT_MISSION_TYPE }) {
  if (missionType !== "target_seats") {
    const missionConfig = MISSION_TYPES[missionType] || MISSION_TYPES[DEFAULT_MISSION_TYPE];
    return <span className="bo-pill px-3 py-2 text-lg">{missionConfig.name}</span>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {PARTY_IDS.map((partyId) => (
        <span key={partyId} className="bo-pill px-3 py-2 text-lg">
          {partyName(partyId)} {targetSeats?.[partyId] ?? 0}석
        </span>
      ))}
    </div>
  );
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
    <div className="grid gap-2 text-sm font-bold text-[var(--color-text)]">
      <p>의석: 민주 {submission.seats?.DEM || 0}석 · 국힘 {submission.seats?.PPP || 0}석</p>
      <p>점수: {submission.finalScore ?? evaluation.finalScore}점 · 유리한 정당: {partyName(submission.advantagedParty || evaluation.advantagedParty)}</p>
      <p>비례성 {evaluation.proportionalityScore.toFixed(2)} · 왜곡 {evaluation.distortionScore.toFixed(2)}</p>
      <p>위반: 인구 {submission.violations?.population ?? evaluation.populationViolations.length}개 · packing {submission.violations?.packing ?? evaluation.packingViolations.length}개</p>
    </div>
  );
}

function ReviewMap({ title, submission }) {
  if (!submission) {
    return (
      <div className="bo-card flex min-h-[360px] items-center justify-center p-8 text-center text-lg font-extrabold text-[var(--color-text-faint)]">
        팀을 선택하면 지도가 표시됩니다.
      </div>
    );
  }

  return (
    <div className="bo-card p-4">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="bo-label">{title}</p>
          <h2 className="bo-heading mt-1 text-2xl">{submission.teamName}</h2>
        </div>
        <span className="bo-pill px-3 py-1 text-sm">점수 {submission.finalScore || 0}</span>
      </div>
      <SejongMap assignments={submission.assignments || {}} compact />
      <div className="mt-3">
        <ScoreSummary
          submission={submission}
          electionDatasetId={submission.electionDatasetId}
          missionType={submission.missionType}
        />
      </div>
    </div>
  );
}

export default function TeacherBoard({ pin, db, defaultTargetSeats = { DEM: 3, PPP: 2 } }) {
  const [targetSeats, setTargetSeats] = useState(defaultTargetSeats);
  const [electionDatasetId, setElectionDatasetId] = useState(DEFAULT_ELECTION_DATASET_ID);
  const [missionType, setMissionType] = useState(DEFAULT_MISSION_TYPE);
  const [selectedTeamId, setSelectedTeamId] = useState(null);
  const [compareTeamId, setCompareTeamId] = useState(null);
  const { mission, leaderboard, setMission, resetRound, error } = useGerrymandering({
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

  const selectedSubmission = useMemo(() => {
    return leaderboard.find((entry) => entry.teamId === selectedTeamId) || leaderboard[0] || null;
  }, [leaderboard, selectedTeamId]);

  const compareSubmission = useMemo(() => {
    return leaderboard.find((entry) => entry.teamId === compareTeamId) || null;
  }, [compareTeamId, leaderboard]);

  const populationRange = getPopulationRange(DISTRICTS.length);
  const districtCountReview = useMemo(() => getDistrictCountReview(), []);
  const selectedElectionDataset = getElectionDataset(mission?.electionDatasetId || electionDatasetId);
  const selectedMissionType = mission?.missionType || missionType;
  const selectedMissionConfig = MISSION_TYPES[selectedMissionType] || MISSION_TYPES[DEFAULT_MISSION_TYPE];

  async function startMission() {
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
  }

  function updateSeatTarget(partyId, value) {
    setTargetSeats((current) => ({
      ...current,
      [partyId]: Math.max(0, Math.min(DISTRICTS.length, Number(value))),
    }));
  }

  return (
    <main className="bo-page">
      <section className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-5">
        <section className="rounded-xl bg-[var(--color-brand-ink)] p-5 text-white shadow-[var(--shadow-md)]">
          <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
            <div>
              <p className="text-xs font-extrabold tracking-[0.08em] text-blue-100">TEACHER DASHBOARD</p>
              <h1 className="mt-2 whitespace-nowrap text-[clamp(1.65rem,3vw,2.75rem)] font-black leading-none">
                세종시 게리맨더링 시뮬레이션
              </h1>
              <p className="mt-3 max-w-3xl text-sm font-bold leading-6 text-blue-100">
                모든 읍·면·동을 {RECOMMENDED_DISTRICT_COUNT}개 선거구에 배정하고, 각 선거구는 반드시 인접한 하나의 영역이어야 합니다.
              </p>
            </div>
            <div className="rounded-xl bg-white p-4 text-[var(--color-brand-ink)] shadow-sm">
              <p className="text-sm font-black text-[var(--color-text-muted)]">학생 입장 PIN</p>
              <p className="mt-1 text-center text-5xl font-black tracking-[0.16em]">{pin}</p>
              <p className="mt-2 text-center text-xs font-extrabold text-[var(--color-text-muted)]">학생 태블릿 첫 화면에 입력</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr]">
            <div className="rounded-lg bg-white/10 px-4 py-3">
              <p className="text-xs font-black text-blue-100">현재 미션</p>
              <p className="mt-1 text-lg font-black">미션: {selectedMissionConfig.name}</p>
              <div className="mt-2">
                <MissionSeats targetSeats={mission?.target_seats || targetSeats} missionType={selectedMissionType} />
              </div>
            </div>
            <div className="rounded-lg bg-white/10 px-4 py-3">
              <p className="text-xs font-black text-blue-100">수업용 데이터</p>
              <p className="mt-1 text-lg font-black">{selectedElectionDataset.name}</p>
              <p className="mt-1 text-sm font-bold text-blue-100">{selectedMissionConfig.description}</p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[430px_1fr]">
        <aside className="flex flex-col gap-4">
          <section className="bo-card p-4">
            <p className="bo-label">MISSION CONTROL</p>
            <h2 className="bo-heading mt-1 text-xl">미션 설정</h2>
            <label className="mt-3 grid gap-1 text-sm font-extrabold text-[var(--color-text-muted)]">
              미션 유형
              <select
                value={missionType}
                onChange={(event) => setMissionType(event.target.value)}
                className="bo-input h-11 px-3 text-sm font-black"
              >
                {Object.values(MISSION_TYPES).map((missionItem) => (
                  <option key={missionItem.id} value={missionItem.id}>
                    {missionItem.name}
                  </option>
                ))}
              </select>
            </label>
            <p className="mt-2 text-xs font-bold leading-5 text-[var(--color-text-muted)]">
              {(MISSION_TYPES[missionType] || MISSION_TYPES[DEFAULT_MISSION_TYPE]).description}
            </p>
            <label className="mt-3 grid gap-1 text-sm font-extrabold text-[var(--color-text-muted)]">
              선거 데이터
              <select
                value={electionDatasetId}
                onChange={(event) => setElectionDatasetId(event.target.value)}
                className="bo-input h-11 px-3 text-sm font-black"
              >
                {Object.values(ELECTION_DATASETS).map((dataset) => (
                  <option key={dataset.id} value={dataset.id}>
                    {dataset.name} · {dataset.sourceLabel}
                  </option>
                ))}
              </select>
            </label>
            <p className="mt-2 text-xs font-bold leading-5 text-[var(--color-text-muted)]">
              {getElectionDataset(electionDatasetId).description}
            </p>
            <div className="mt-3 rounded-lg bg-[var(--color-bg-soft)] p-3">
              <p className="text-xs font-black text-[var(--color-text)]">
                권장 선거구 수: {RECOMMENDED_DISTRICT_COUNT}개
              </p>
              <p className="mt-1 text-xs font-bold leading-5 text-[var(--color-text-muted)]">
                24개 읍·면·동을 20분 수업 안에 조합하기에는 5개 선거구가 가장 균형적입니다. 4개는 왜곡 실험의 경우의 수가 줄고, 6개는 작은 동지역 때문에 인구 균등 조건이 너무 까다로워집니다.
              </p>
              <div className="mt-2 grid gap-1 text-xs font-bold text-[var(--color-text-muted)]">
                {districtCountReview.map((item) => (
                  <div
                    key={item.districtCount}
                    className={`flex items-center justify-between rounded-md px-2 py-1 ${
                      item.recommended ? "bg-white text-[var(--color-brand-ink)] ring-1 ring-[var(--color-brand)]" : "bg-white/60"
                    }`}
                  >
                    <span>{item.districtCount}개</span>
                    <span>
                      평균 {Math.round(item.averagePopulation).toLocaleString("ko-KR")}명 · 권장{" "}
                      {Math.round(item.minPopulation).toLocaleString("ko-KR")}~{Math.round(item.maxPopulation).toLocaleString("ko-KR")}명
                    </span>
                  </div>
                ))}
              </div>
            </div>
            {missionType === "target_seats" && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {PARTY_IDS.map((partyId) => (
                  <label key={partyId} className="grid gap-1 text-sm font-extrabold text-[var(--color-text-muted)]">
                    {partyName(partyId)}
                    <input
                      type="number"
                      min="0"
                      max={DISTRICTS.length}
                      value={targetSeats[partyId]}
                      onChange={(event) => updateSeatTarget(partyId, event.target.value)}
                      className="bo-input h-11 px-3 text-lg font-black"
                    />
                  </label>
                ))}
              </div>
            )}
            <p className="mt-3 text-xs font-bold leading-5 text-[var(--color-text-muted)]">
              인구 기준: 선거구당 {Math.round(populationRange.averagePopulation).toLocaleString("ko-KR")}명,
              허용 범위 ±10%
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" onClick={startMission} className="bo-button-primary px-4 py-3 text-sm">
                라운드 시작
              </button>
              <button type="button" onClick={resetRound} className="bo-button-secondary px-4 py-3 text-sm">
                제출 초기화
              </button>
            </div>
            {error && <p className="bo-callout-blue mt-3 p-3 text-sm font-bold">{error.message}</p>}
          </section>

          <section className="bo-card p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="bo-label">SCORE RANKING</p>
                <h2 className="bo-heading mt-1 text-xl">팀별 점수 순위</h2>
              </div>
              <span className="bo-pill px-2 py-1 text-xs">PIN {pin}</span>
            </div>
            <div className="mt-3 grid gap-2">
              {leaderboard.length === 0 && (
                <p className="rounded-lg bg-[var(--color-bg-soft)] p-4 text-center text-sm font-bold text-[var(--color-text-faint)]">
                  아직 제출 현황이 없습니다.
                </p>
              )}
              {leaderboard.map((entry, index) => (
                <div key={entry.teamId} className="bo-card grid gap-3 p-3">
                  <button
                    type="button"
                    onClick={() => setSelectedTeamId(entry.teamId)}
                    className="grid grid-cols-[42px_1fr_auto] items-center gap-3 text-left"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-brand-soft)] text-sm font-black text-[var(--color-brand-ink)]">
                      {index + 1}
                    </span>
                    <span>
                      <span className="block text-sm font-black text-[var(--color-text)]">{entry.teamName}</span>
                      <span className="block text-xs font-bold text-[var(--color-text-muted)]">
                        민주 {entry.seats?.DEM || 0}, 국힘 {entry.seats?.PPP || 0} · 점수 {entry.finalScore || 0}
                      </span>
                    </span>
                    <span
                      className={`rounded-md px-2 py-1 text-xs font-black ${
                        entry.status === "contiguity_error"
                          ? "bg-rose-50 text-rose-800"
                          : entry.status === "submitted" || entry.status === "mission_success"
                            ? "bg-emerald-50 text-emerald-800"
                            : "bg-[var(--color-bg-soft)] text-[var(--color-text-muted)]"
                      }`}
                    >
                      {STATUS_LABEL[entry.status] || entry.status}
                    </span>
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setSelectedTeamId(entry.teamId)} className="bo-button-secondary px-3 py-2 text-xs">
                      지도 보기
                    </button>
                    <button type="button" onClick={() => setCompareTeamId(entry.teamId)} className="bo-button-secondary px-3 py-2 text-xs">
                      비교에 올리기
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </aside>

        <section className="grid gap-4 2xl:grid-cols-2">
          <ReviewMap title="TEAM MAP" submission={selectedSubmission} />
          <ReviewMap title="COMPARE MAP" submission={compareSubmission} />
        </section>
        </section>
      </section>
    </main>
  );
}
