import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AREA_BY_ID,
  DEFAULT_ELECTION_DATASET_ID,
  DEFAULT_MISSION_TYPE,
  DISTRICT_THEME,
  DISTRICTS,
  MISSION_TYPES,
  PARTIES,
  PARTY_IDS,
  RECOMMENDED_DISTRICT_COUNT,
  SAMPLE_OPTIMIZED_ASSIGNMENTS,
  SEJONG_AREAS,
  getEmptyAssignments,
  getAreaVotes,
  getPopulationRange,
  getSelectableAreaIds,
  isAreaSetContiguous,
  normalizeAssignments,
  validatePlan,
} from "../data/gerrymandering";
import useGerrymandering from "../hooks/useGerrymandering";
import SejongMap from "./SejongMap";

function formatTime(milliseconds) {
  if (!milliseconds || milliseconds <= 0) return "00:00";
  const totalSeconds = Math.ceil(milliseconds / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function formatNumber(value) {
  return Math.round(value).toLocaleString("ko-KR");
}

function partyName(partyId) {
  return PARTIES.find((party) => party.id === partyId)?.name || partyId;
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return "0.0%";
  return `${(value * 100).toFixed(1)}%`;
}

function ResultChip({ partyId, value }) {
  const party = PARTIES.find((item) => item.id === partyId);

  return (
    <span
      className="rounded-md px-2.5 py-1 text-sm font-extrabold ring-1"
      style={{ backgroundColor: party.soft, color: party.color, borderColor: party.color }}
    >
      {party.name} {value}석
    </span>
  );
}

function getSubmitHints(evaluation) {
  const hints = [];

  if (evaluation.unassignedAreaIds.length > 0) {
    hints.push(`미배정 지역 ${evaluation.unassignedAreaIds.length}개를 선거구에 포함해야 합니다.`);
  }
  if (evaluation.emptyDistricts.length > 0) {
    hints.push(`비어 있는 선거구 ${evaluation.emptyDistricts.join(", ")}구가 있습니다.`);
  }
  if (evaluation.contiguity.errors.length > 0) {
    hints.push(...evaluation.contiguity.errors);
  }
  if (evaluation.populationViolations.length > 0) {
    hints.push(`인구 권장 범위를 벗어난 선거구 ${evaluation.populationViolations.length}개는 감점됩니다.`);
  }
  if (evaluation.packingViolations.length > 0) {
    hints.push(`한 정당이 75% 이상 몰린 선거구 ${evaluation.packingViolations.length}개는 packing 감점입니다.`);
  }
  if (hints.length === 0) {
    hints.push("모든 지역이 연결된 선거구로 배정되어 제출할 수 있습니다.");
  }

  return hints;
}

function ProportionalityPanel({ evaluation }) {
  const totalSeats = DISTRICTS.length;

  return (
    <section className="bo-card p-4">
      <div className="border-l-4 border-[var(--color-brand)] pl-3">
        <h2 className="bo-heading text-lg">결과 해설</h2>
      </div>
      <p className="mt-2 text-xs font-bold leading-5 text-[var(--color-text-muted)]">
        전체 득표율이 기대 의석이고, 실제 의석과의 차이가 의석 왜곡입니다. 같은 표라도 선거구를 어떻게 묶는지에 따라 의석률이 달라집니다.
      </p>
      <div className="mt-3 grid gap-3">
        {PARTIES.map((party) => {
          const voteShare = (evaluation.expectedSeats[party.id] || 0) / totalSeats;
          const seatShare = (evaluation.seats[party.id] || 0) / totalSeats;
          const distortion = (evaluation.distortionByParty[party.id] || 0).toFixed(2);

          return (
            <div key={party.id} className="rounded-lg bg-[var(--color-bg-soft)] p-3">
              <div className="flex items-center justify-between gap-2 text-xs font-black">
                <span style={{ color: party.color }}>{party.name}</span>
                <span className="text-[var(--color-text-muted)]">왜곡 {distortion}석</span>
              </div>
              <div className="mt-2 grid gap-1">
                <div>
                  <div className="flex justify-between text-[11px] font-bold text-[var(--color-text-muted)]">
                    <span>득표율</span>
                    <span>{formatPercent(voteShare)}</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-white">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, voteShare * 100)}%`, backgroundColor: party.color }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[11px] font-bold text-[var(--color-text-muted)]">
                    <span>의석률</span>
                    <span>{formatPercent(seatShare)}</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-white">
                    <div className="h-full rounded-full opacity-70" style={{ width: `${Math.min(100, seatShare * 100)}%`, backgroundColor: party.color }} />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

const HAPPY_CITY_AREA_IDS = new Set([
  "haemil",
  "areum",
  "dodam",
  "goun",
  "jongchon",
  "eojin",
  "dajeong",
  "saerom",
  "naseong",
  "hansol",
  "daepyeong",
  "boram",
  "sodam",
  "bangok",
]);

const AREA_GROUPS = [
  {
    title: "읍·면 지역",
    areaIds: ["sojeong", "jeonui", "jeondong", "yeonseo", "jochiwon", "yeondong", "janggun", "yeongi", "geumnam", "bugang"],
  },
  {
    title: "행복도시 동지역",
    areaIds: SEJONG_AREAS.filter((area) => HAPPY_CITY_AREA_IDS.has(area.id)).map((area) => area.id),
  },
];

const STUDENT_DRAFT_STORAGE_PREFIX = "gerrymanderingStudentDraft";

function getStudentDraftStorageKey(pin, teamId) {
  return `${STUDENT_DRAFT_STORAGE_PREFIX}:${pin || "no-pin"}:${teamId || "no-team"}`;
}

function hasAnyAssignment(assignments) {
  return Object.values(assignments || {}).some(Boolean);
}

function assignmentsEqual(left, right) {
  const normalizedLeft = normalizeAssignments(left);
  const normalizedRight = normalizeAssignments(right);
  return SEJONG_AREAS.every((area) => normalizedLeft[area.id] === normalizedRight[area.id]);
}

function readStoredAssignments(pin, teamId) {
  if (typeof window === "undefined") return getEmptyAssignments();

  try {
    const raw = window.localStorage.getItem(getStudentDraftStorageKey(pin, teamId));
    if (!raw) return getEmptyAssignments();
    const parsed = JSON.parse(raw);
    return normalizeAssignments(parsed?.assignments || parsed || getEmptyAssignments());
  } catch {
    return getEmptyAssignments();
  }
}

function readStoredDraft(pin, teamId) {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(getStudentDraftStorageKey(pin, teamId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeStoredAssignments(pin, teamId, assignments, missionStartedAt = null) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(
    getStudentDraftStorageKey(pin, teamId),
    JSON.stringify({
      assignments: normalizeAssignments(assignments),
      missionStartedAt,
      savedAt: Date.now(),
    }),
  );
}

export default function StudentMap({ pin, teamId, teamName = "우리 모둠", db }) {
  const [assignments, setAssignments] = useState(() => readStoredAssignments(pin, teamId));
  const [selectedAreaIds, setSelectedAreaIds] = useState([]);
  const [activeDistrict, setActiveDistrict] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [now, setNow] = useState(Date.now());
  const remoteDraftRestoredRef = useRef(false);
  const { db: connectedDb, mission, submissions, updateDraft, submitPlan, error } = useGerrymandering({
    pin,
    teamId,
    teamName,
    db,
  });

  const normalizedAssignments = useMemo(() => normalizeAssignments(assignments), [assignments]);
  const electionDatasetId = mission?.electionDatasetId || DEFAULT_ELECTION_DATASET_ID;
  const missionType = mission?.missionType || DEFAULT_MISSION_TYPE;
  const missionConfig = MISSION_TYPES[missionType] || MISSION_TYPES[DEFAULT_MISSION_TYPE];
  const evaluation = useMemo(
    () => validatePlan(normalizedAssignments, mission?.target_seats, { electionId: electionDatasetId, missionType }),
    [electionDatasetId, missionType, normalizedAssignments, mission?.target_seats],
  );
  const selectableAreaIds = useMemo(
    () => getSelectableAreaIds(selectedAreaIds, normalizedAssignments),
    [normalizedAssignments, selectedAreaIds],
  );
  const selectedContiguous = isAreaSetContiguous(selectedAreaIds);
  const remainingTime = mission?.endsAt ? mission.endsAt - now : null;
  const populationRange = getPopulationRange(DISTRICTS.length);
  const selectedPopulation = selectedAreaIds.reduce((sum, areaId) => sum + AREA_BY_ID[areaId].population, 0);
  const submitHints = useMemo(() => getSubmitHints(evaluation), [evaluation]);
  const missionStartedAt = mission?.startedAtClient || null;
  const currentSubmission = submissions?.[teamId] || null;
  const isSubmitted = currentSubmission?.status === "submitted" || currentSubmission?.status === "mission_success";
  const submittedMatchesCurrent = isSubmitted && assignmentsEqual(normalizedAssignments, currentSubmission.assignments);
  const submitDisabled = !evaluation.canSubmit || submitting || submittedMatchesCurrent;
  const submitLabel = submitting
    ? "저장 중"
    : submittedMatchesCurrent
      ? "제출 완료"
      : isSubmitted
        ? "다시 제출하기"
        : "최종 제출하기";

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!missionStartedAt) return;
    const storedDraft = readStoredDraft(pin, teamId);
    if (!storedDraft || storedDraft.missionStartedAt === missionStartedAt) return;

    setAssignments(getEmptyAssignments());
    setSelectedAreaIds([]);
    setMessage("새 라운드가 시작되어 이전 선거구 배정을 초기화했습니다.");
  }, [missionStartedAt, pin, teamId]);

  useEffect(() => {
    if (!missionStartedAt && connectedDb) return;
    if (missionStartedAt) {
      const storedDraft = readStoredDraft(pin, teamId);
      if (storedDraft?.missionStartedAt && storedDraft.missionStartedAt !== missionStartedAt) return;
    }
    writeStoredAssignments(pin, teamId, normalizedAssignments, missionStartedAt);
  }, [missionStartedAt, normalizedAssignments, pin, teamId]);

  useEffect(() => {
    if (remoteDraftRestoredRef.current) return;
    const remoteAssignments = submissions?.[teamId]?.assignments;
    if (!remoteAssignments || !hasAnyAssignment(remoteAssignments)) return;

    remoteDraftRestoredRef.current = true;
    setAssignments((current) => (hasAnyAssignment(current) ? current : normalizeAssignments(remoteAssignments)));
  }, [submissions, teamId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      updateDraft(normalizedAssignments).catch((caughtError) => setMessage(caughtError.message));
    }, 350);

    return () => window.clearTimeout(timer);
  }, [normalizedAssignments, updateDraft]);

  function toggleArea(areaId) {
    setMessage("");
    if (normalizedAssignments[areaId]) {
      setMessage("이미 선거구에 배정된 지역입니다. 선거구를 지운 뒤 다시 선택하세요.");
      return;
    }

    if (selectedAreaIds.includes(areaId)) {
      setSelectedAreaIds((current) => current.filter((id) => id !== areaId));
      return;
    }

    if (!selectableAreaIds.includes(areaId)) {
      setMessage("이미 선택된 지역과 인접한 읍·면·동만 추가할 수 있습니다.");
      return;
    }

    const nextSelection = [...selectedAreaIds, areaId];
    if (!isAreaSetContiguous(nextSelection)) {
      setMessage("선택한 지역은 서로 인접하지 않습니다.");
      return;
    }

    setSelectedAreaIds(nextSelection);
  }

  function createDistrict() {
    if (selectedAreaIds.length === 0) return;
    if (!selectedContiguous) {
      setMessage("선택한 지역은 서로 인접하지 않습니다.");
      return;
    }

    setAssignments((current) => {
      const next = { ...current };
      for (const areaId of selectedAreaIds) next[areaId] = activeDistrict;
      return next;
    });
    setSelectedAreaIds([]);
    setMessage(`${DISTRICT_THEME[activeDistrict].name}으로 묶었습니다.`);
  }

  function clearDistrict(districtId) {
    setAssignments((current) => {
      const next = { ...current };
      for (const area of SEJONG_AREAS) {
        if (next[area.id] === districtId) next[area.id] = null;
      }
      return next;
    });
    setSelectedAreaIds([]);
    setMessage(`${DISTRICT_THEME[districtId].name}을 초기화했습니다.`);
  }

  function resetAll() {
    setAssignments(getEmptyAssignments());
    setSelectedAreaIds([]);
    setMessage("모든 선거구를 초기화했습니다.");
  }

  function autoOptimize() {
    setAssignments(SAMPLE_OPTIMIZED_ASSIGNMENTS);
    setSelectedAreaIds([]);
    setMessage("수업용 자동 구획 예시를 불러왔습니다.");
  }

  async function handleSubmit() {
    setSubmitting(true);
    setMessage("");

    try {
      const result = connectedDb ? await submitPlan(normalizedAssignments) : { ...evaluation, missionSuccess: evaluation.missionSuccess };
      if (!result?.canSubmit) {
        setMessage(result?.errors?.[0] || "모든 읍·면·동을 연결된 선거구에 배정해야 합니다.");
      } else if (result.missionSuccess) {
        setMessage("미션 성공! 결과가 저장되었습니다.");
      } else if (!connectedDb) {
        setMessage("로컬 데모 제출 완료. Firebase를 연결하면 교사 대시보드에 실시간 저장됩니다.");
      } else {
        setMessage("결과를 저장했습니다. 교사용 화면에서 비교할 수 있습니다.");
      }
    } catch (caughtError) {
      setMessage(caughtError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="bo-page">
      <section className="mx-auto flex max-w-[1500px] flex-col gap-4 px-4 py-4">
        <header className="bo-card flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="bo-label">SEJONG GERRYMANDERING SIMULATION</p>
            <h1 className="bo-heading mt-1 text-3xl">지도를 훔친 자들</h1>
            <p className="bo-muted mt-1 text-sm font-bold">{teamName} · 세종특별자치시 읍·면·동 재획정</p>
          </div>
          <div className="rounded-lg bg-[var(--color-brand-ink)] px-4 py-2 text-right text-white shadow-sm">
            <p className="text-xs font-bold text-blue-100">남은 시간</p>
            <p className="tabular-nums text-2xl font-black">{formatTime(remainingTime)}</p>
          </div>
        </header>

        <section className="bo-callout-blue p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-extrabold">현재 예상 의석과 결과 지표</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {PARTY_IDS.map((partyId) => (
                  <ResultChip key={partyId} partyId={partyId} value={evaluation.seats[partyId]} />
                ))}
                <span className="bo-pill px-3 py-1 text-sm">의석 왜곡 {evaluation.distortionScore.toFixed(2)}석</span>
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <span className="bo-pill px-3 py-2 text-sm">미션: {missionConfig.name}</span>
              {missionType === "target_seats" ? (
                <span className="bo-pill px-3 py-2 text-sm">
                  민주 {mission?.target_seats?.DEM ?? 3}석, 국힘 {mission?.target_seats?.PPP ?? 2}석
                </span>
              ) : null}
            </div>
          </div>
          <div className="mt-3 grid gap-2 text-xs font-bold leading-5 text-[var(--color-brand-ink)] md:grid-cols-2">
            <p className="rounded-lg bg-white/70 px-3 py-2">
              선거구 획정 원칙: 모든 읍·면·동을 1~5구 중 하나에 배정하고, 같은 선거구의 지역들은 행정경계를 공유하며 하나로 연결되어야 합니다.
            </p>
            <p className="rounded-lg bg-white/70 px-3 py-2">
              인구 기준: 선거구별 인구는 평균 인구의 ±10% 권장 범위 안에 들어와야 하며, 벗어난 선거구마다 감점됩니다.
            </p>
            <p className="rounded-lg bg-white/70 px-3 py-2 md:col-span-2">
              점수 계산: 미션 성공 모둠이 5개라면 1등은 5점, 2등은 4점, 3등은 3점처럼 한 순위씩 1점 낮게 받습니다.
            </p>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="bo-card p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="bo-label">MAP</p>
                <h2 className="bo-heading text-xl">세종시 읍·면·동 지도</h2>
              </div>
              <p className="text-sm font-bold text-[var(--color-text-muted)]">
                {RECOMMENDED_DISTRICT_COUNT}개 선거구 기준 · 선택 인구 {formatNumber(selectedPopulation)}명 · 권장 {formatNumber(populationRange.minPopulation)}~{formatNumber(populationRange.maxPopulation)}명
              </p>
            </div>
            <p className="mb-3 rounded-lg bg-blue-50 px-3 py-2 text-xs font-extrabold leading-5 text-[var(--color-brand-ink)] ring-1 ring-blue-100">
              선거구 획정 단위는 행정동·읍·면 기준입니다. 예를 들어 가람동은 한솔동 묶음으로 처리되어 장군면과 연결될 수 있습니다.
            </p>
            <div className="mb-3 rounded-xl border border-[var(--color-border)] bg-white p-3 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="bo-label">BIND SELECTED AREAS</p>
                  <p className="mt-1 text-sm font-black text-[var(--color-text)]">
                    선택 {selectedAreaIds.length}곳 · {DISTRICT_THEME[activeDistrict].name}으로 묶기
                  </p>
                </div>
                <button
                  type="button"
                  disabled={selectedAreaIds.length === 0 || !selectedContiguous}
                  onClick={createDistrict}
                  className="bo-button-primary px-4 py-2.5 text-sm"
                >
                  선거구로 묶기
                </button>
              </div>
              <div className="mt-3 grid grid-cols-5 gap-2">
                {DISTRICTS.map((districtId) => (
                  <button
                    key={`map-${districtId}`}
                    type="button"
                    onClick={() => setActiveDistrict(districtId)}
                    className={`rounded-lg border px-2 py-2 text-sm font-black ${
                      activeDistrict === districtId
                        ? "border-[var(--color-brand)] shadow-[var(--shadow-focus-ring)]"
                        : "border-[var(--color-border)]"
                    }`}
                    style={{ backgroundColor: DISTRICT_THEME[districtId].soft, color: DISTRICT_THEME[districtId].color }}
                  >
                    {districtId}구
                  </button>
                ))}
              </div>
            </div>
            <SejongMap
              assignments={normalizedAssignments}
              selectedAreaIds={selectedAreaIds}
              selectableAreaIds={selectableAreaIds}
              electionDatasetId={electionDatasetId}
              showVoteCallouts
              onToggleArea={toggleArea}
            />
          </div>

          <aside className="flex flex-col gap-4">
            <section className="bo-card p-4">
              <button
                type="button"
                disabled={submitDisabled}
                onClick={handleSubmit}
                className="bo-button-primary w-full px-4 py-3 text-base"
              >
                {submitLabel}
              </button>
              {submittedMatchesCurrent ? (
                <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-black leading-5 text-emerald-800 ring-1 ring-emerald-100">
                  현재 선거구안은 이미 제출되었습니다. 지도를 수정하면 다시 제출할 수 있습니다.
                </p>
              ) : null}

              <div className="mt-3 grid grid-cols-2 overflow-hidden rounded-xl bg-[var(--color-brand)] text-white shadow-[var(--shadow-sm)]">
                <div className="border-r border-white/30 p-4 text-center">
                  <p className="text-xs font-black text-blue-100">민주당 의석</p>
                  <p className="mt-1 text-3xl font-black">{evaluation.seats.DEM}</p>
                </div>
                <div className="p-4 text-center">
                  <p className="text-xs font-black text-blue-100">국민의힘 의석</p>
                  <p className="mt-1 text-3xl font-black">{evaluation.seats.PPP}</p>
                </div>
              </div>

              {(message || error) && (
                <p className="bo-callout-blue mt-3 p-3 text-sm font-bold">
                  {message || error.message}
                </p>
              )}
              {!connectedDb && (
                <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-black leading-5 text-amber-900 ring-1 ring-amber-200">
                  로컬 데모 모드입니다. 이 기기에서는 새로고침해도 작업이 유지되지만, 교사 대시보드와 실시간 동기화하려면 Firebase 설정이 필요합니다.
                </p>
              )}
            </section>

            <section className="bo-card p-4">
              <div className="border-l-4 border-[var(--color-brand)] pl-3">
                <h2 className="bo-heading text-lg">제출 점검</h2>
              </div>
              <div className="mt-3 grid gap-2">
                {submitHints.map((hint, index) => (
                  <p
                    key={`${hint}-${index}`}
                    className={`rounded-lg px-3 py-2 text-xs font-black leading-5 ${
                      evaluation.canSubmit && index === 0
                        ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100"
                        : "bg-[var(--color-bg-soft)] text-[var(--color-text-muted)]"
                    }`}
                  >
                    {hint}
                  </p>
                ))}
              </div>
            </section>

            <ProportionalityPanel evaluation={evaluation} />

            <section className="bo-card p-4">
              <div className="border-l-4 border-[var(--color-brand)] pl-3">
                <h2 className="bo-heading text-lg">선거구 선택</h2>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {DISTRICTS.map((districtId) => (
                  <button
                    key={districtId}
                    type="button"
                    onClick={() => setActiveDistrict(districtId)}
                    className={`rounded-lg border px-3 py-3 text-sm font-black ${
                      activeDistrict === districtId
                        ? "border-[var(--color-brand)] shadow-[var(--shadow-focus-ring)]"
                        : "border-[var(--color-border)]"
                    }`}
                    style={{ backgroundColor: DISTRICT_THEME[districtId].soft, color: DISTRICT_THEME[districtId].color }}
                  >
                    {districtId}구 선택
                  </button>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => clearDistrict(activeDistrict)} className="bo-button-secondary px-3 py-2 text-sm">
                  실행 취소
                </button>
                <button type="button" onClick={resetAll} className="bo-button-secondary px-3 py-2 text-sm">
                  초기화
                </button>
              </div>
            </section>

            <section className="bo-card min-h-0 p-4">
              <div className="border-l-4 border-[var(--color-brand)] pl-3">
                <h2 className="bo-heading text-lg">선거구별 상세 통계</h2>
              </div>
              <div className="mt-3 max-h-[560px] space-y-3 overflow-y-auto pr-1">
                {evaluation.districtResults.map((result) => {
                  const demShare = result.totalVotes ? result.votes.DEM / result.totalVotes : 0;
                  const pppShare = result.totalVotes ? result.votes.PPP / result.totalVotes : 0;
                  const winnerLabel = result.winner ? `${partyName(result.winner)} 승리` : "미획정";

                  return (
                    <article
                      key={result.districtId}
                      className="rounded-lg bg-[var(--color-brand-soft)] p-3 text-sm font-bold"
                      style={{ borderLeft: `4px solid ${DISTRICT_THEME[result.districtId].color}` }}
                    >
                      <h3 className="font-black text-[var(--color-text)]">
                        제 {result.districtId} 선거구 <span className="text-[var(--color-text-muted)]">({winnerLabel})</span>
                      </h3>
                      <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                        인구: {formatNumber(result.population)} / 득표: {formatNumber(result.totalVotes)}
                      </p>
                      <p className="mt-1 text-sm">
                        <span className="font-black text-[#1B6BFF]">민주 {formatPercent(demShare)}</span>
                        <span className="mx-1 text-[var(--color-text-muted)]">|</span>
                        <span className="font-black text-[#E34848]">국힘 {formatPercent(pppShare)}</span>
                      </p>
                      <div className="my-2 border-t border-dashed border-slate-300" />
                      <p className="text-xs leading-5 text-[var(--color-text-muted)]">
                        포함: {result.areaNames.length > 0 ? result.areaNames.join(", ") : "없음"}
                      </p>
                    </article>
                  );
                })}
              </div>
            </section>
          </aside>
        </section>
      </section>
    </main>
  );
}
