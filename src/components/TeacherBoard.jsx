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

function WorkflowStep({ step, title, description, active, done }) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        done
          ? "border-emerald-200 bg-emerald-50 text-emerald-900"
          : active
            ? "border-[var(--color-brand)] bg-blue-50 text-[var(--color-brand-ink)] shadow-[var(--shadow-focus-ring)]"
            : "border-[var(--color-border)] bg-white text-[var(--color-text-muted)]"
      }`}
    >
      <p className="text-xs font-black">STEP {step}</p>
      <h3 className="mt-1 text-sm font-black text-[var(--color-text)]">{title}</h3>
      <p className="mt-1 text-xs font-bold leading-5">{description}</p>
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
      <p>미션 점수: {submission.missionScore || 0}점{submission.missionRank ? ` · 성공 ${submission.missionRank}등` : ""}</p>
      <p>해설 지표: 비례성 {evaluation.proportionalityScore.toFixed(2)} · 왜곡 {evaluation.distortionScore.toFixed(2)} · 유리한 정당 {partyName(submission.advantagedParty || evaluation.advantagedParty)}</p>
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
        <span className="bo-pill px-3 py-1 text-sm">미션 점수 {submission.missionScore || 0}</span>
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
  const [restartArmed, setRestartArmed] = useState(false);
  const [resetArmed, setResetArmed] = useState(false);
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
  const districtCountReview = useMemo(() => getDistrictCountReview(), []);
  const selectedElectionDataset = getElectionDataset(mission?.electionDatasetId || electionDatasetId);
  const selectedMissionType = mission?.missionType || missionType;
  const selectedMissionConfig = MISSION_TYPES[selectedMissionType] || MISSION_TYPES[DEFAULT_MISSION_TYPE];
  const hasMission = Boolean(mission);
  const hasSubmission = leaderboard.length > 0;

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

        <section className="bo-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="bo-label">CLASS FLOW</p>
              <h2 className="bo-heading mt-1 text-xl">수업 진행 순서</h2>
            </div>
            <span className={`rounded-lg px-3 py-2 text-xs font-black ${connectedDb ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>
              {connectedDb ? "Firebase 실시간 연동 중" : "로컬 데모 모드"}
            </span>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-4">
            <WorkflowStep
              step="1"
              title="모둠 입장"
              description={`${teamEntries.length}개 모둠이 입장했습니다.`}
              active={teamEntries.length === 0}
              done={teamEntries.length > 0}
            />
            <WorkflowStep
              step="2"
              title="참여 모둠 확정"
              description={room?.teamsConfirmed ? "참여 모둠이 확정되었습니다." : "모둠 목록을 확인하고 확정하세요."}
              active={teamEntries.length > 0 && !room?.teamsConfirmed}
              done={Boolean(room?.teamsConfirmed)}
            />
            <WorkflowStep
              step="3"
              title="미션 시작"
              description={hasMission ? "현재 라운드 미션이 배포되었습니다." : "미션 유형과 목표를 정한 뒤 시작하세요."}
              active={Boolean(room?.teamsConfirmed) && !hasMission}
              done={hasMission}
            />
            <WorkflowStep
              step="4"
              title="결과 비교"
              description={hasSubmission ? "제출 지도를 선택해 비교할 수 있습니다." : "학생 제출을 기다리는 중입니다."}
              active={hasMission && !hasSubmission}
              done={hasSubmission}
            />
          </div>
          {!connectedDb && (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-black leading-5 text-amber-900 ring-1 ring-amber-200">
              비상용 로컬 모드입니다. 한 기기에서 시연은 가능하지만, 학생 태블릿과 교사 대시보드를 실시간으로 연결하려면 입장 화면에서 Firebase 설정을 저장하세요.
            </p>
          )}
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
            <p className="mt-2 rounded-lg bg-blue-50 px-3 py-2 text-xs font-black leading-5 text-[var(--color-brand-ink)] ring-1 ring-blue-100">
              데이터 안내: 이 앱의 선거 데이터는 수업용 시뮬레이션을 위해 읍·면·동 단위로 재구성한 자료입니다. 실제 선거 결과 설명보다 선거구 획정 원리와 의석 왜곡 효과를 체험하는 데 초점을 둡니다.
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
              <button
                type="button"
                onClick={startMission}
                className={`${hasMission && !restartArmed ? "bo-button-secondary" : "bo-button-primary"} px-4 py-3 text-sm`}
              >
                {!hasMission ? "라운드 시작" : restartArmed ? "정말 다시 시작" : "다시 시작 준비"}
              </button>
              <button
                type="button"
                onClick={handleResetRound}
                disabled={!hasSubmission}
                className={`${resetArmed ? "bo-button-primary" : "bo-button-secondary"} px-4 py-3 text-sm disabled:opacity-45`}
              >
                {resetArmed ? "정말 초기화" : "제출 초기화"}
              </button>
            </div>
            {restartArmed ? (
              <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-black leading-5 text-amber-900 ring-1 ring-amber-200">
                다시 시작하면 현재 제출 현황이 초기화됩니다. 계속하려면 한 번 더 누르세요.
              </p>
            ) : null}
            {resetArmed ? (
              <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-black leading-5 text-amber-900 ring-1 ring-amber-200">
                현재 제출 현황만 초기화됩니다. 계속하려면 한 번 더 누르세요.
              </p>
            ) : null}
            {error && <p className="bo-callout-blue mt-3 p-3 text-sm font-bold">{error.message}</p>}
          </section>

          <section className="bo-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="bo-label">TEAM CHECK-IN</p>
                <h2 className="bo-heading mt-1 text-xl">입장 모둠 확인</h2>
              </div>
              <span className="bo-pill px-3 py-1 text-sm">{teamEntries.length}팀</span>
            </div>
            <div className="mt-3 grid gap-2">
              {teamEntries.length === 0 ? (
                <p className="rounded-lg bg-[var(--color-bg-soft)] p-4 text-center text-sm font-bold text-[var(--color-text-faint)]">
                  아직 입장한 모둠이 없습니다.
                </p>
              ) : (
                teamEntries.map((team) => (
                  <div key={team.teamId} className="flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-white px-3 py-2">
                    <span className="text-sm font-black text-[var(--color-text)]">{team.teamName}</span>
                    <span className={`rounded-md px-2 py-1 text-xs font-black ${team.online ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-500"}`}>
                      입장
                    </span>
                  </div>
                ))
              )}
            </div>
            <button
              type="button"
              onClick={() => confirmTeams(teamEntries)}
              disabled={teamEntries.length === 0 || room?.teamsConfirmed}
              className={`${room?.teamsConfirmed ? "bo-button-secondary" : "bo-button-primary"} mt-3 w-full px-4 py-3 text-sm`}
            >
              {room?.teamsConfirmed ? "참여 모둠 확정 완료" : "참여 모둠 확정"}
            </button>
            {room?.teamsConfirmed ? (
              <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-800">
                참여 모둠 확정 완료: {(room.confirmedTeamNames || []).join(", ") || `${teamEntries.length}팀`}
              </p>
            ) : null}
          </section>

          <section className="bo-card p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="bo-label">SCORE RANKING</p>
                <h2 className="bo-heading mt-1 text-xl">미션 성공 순위</h2>
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
                        민주 {entry.seats?.DEM || 0}, 국힘 {entry.seats?.PPP || 0} · 미션 점수 {entry.missionScore || 0}점
                        {entry.missionRank ? ` · 성공 ${entry.missionRank}등` : ""}
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
