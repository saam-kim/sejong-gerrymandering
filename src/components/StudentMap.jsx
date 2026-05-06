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
  return Math.round(value || 0).toLocaleString("ko-KR");
}

function partyName(partyId) {
  return PARTIES.find((party) => party.id === partyId)?.name || partyId;
}

function partyShortName(partyId) {
  return PARTIES.find((party) => party.id === partyId)?.shortName || partyId;
}

function districtName(districtId) {
  return DISTRICT_THEME[districtId]?.name || `${districtId}선거구`;
}

function formatDistrictNames(districtIds) {
  return districtIds.map((districtId) => districtName(districtId)).join(", ");
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return "0.0%";
  return `${(value * 100).toFixed(1)}%`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getStudentDraftStorageKey(pin, teamId) {
  return `gerrymanderingStudentDraft:${pin || "no-pin"}:${teamId || "no-team"}`;
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

function SeatPreview({ evaluation }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex min-w-[64px] flex-col items-center rounded-lg bg-blue-50 px-3 py-1.5">
        <span className="text-2xl font-black leading-none text-[#1B6BFF]">{evaluation.seats.DEM}</span>
        <span className="text-[10px] font-extrabold text-slate-500">민주</span>
      </div>
      <span className="text-xl font-light text-slate-300">:</span>
      <div className="flex min-w-[64px] flex-col items-center rounded-lg bg-red-50 px-3 py-1.5">
        <span className="text-2xl font-black leading-none text-[#E34848]">{evaluation.seats.PPP}</span>
        <span className="text-[10px] font-extrabold text-slate-500">국힘</span>
      </div>
    </div>
  );
}

function TimerRing({ remainingTime, durationSeconds }) {
  const circumference = 2 * Math.PI * 30;
  const total = Math.max(1, (durationSeconds || 1200) * 1000);
  const ratio = remainingTime == null ? 1 : clamp(remainingTime / total, 0, 1);
  const stroke = ratio < 0.2 ? "#ef4444" : ratio < 0.4 ? "#f59e0b" : "#2563eb";

  return (
    <div className="relative h-[68px] w-[68px]">
      <svg viewBox="0 0 68 68" className="-rotate-90">
        <circle cx="34" cy="34" r="30" fill="none" stroke="#e2e8f0" strokeWidth="5" />
        <circle
          cx="34"
          cy="34"
          r="30"
          fill="none"
          stroke={stroke}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - ratio)}
          className="transition-[stroke-dashoffset,stroke] duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-base font-black leading-none text-slate-900">{formatTime(remainingTime)}</span>
        <span className="mt-0.5 text-[9px] font-extrabold text-slate-500">남음</span>
      </div>
    </div>
  );
}

function MissionGoal({ mission, missionType, missionConfig }) {
  if (missionType !== "target_seats") {
    return (
      <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-right text-sm font-black text-blue-900">
        {missionConfig.name}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-black text-blue-900">
      민주 {mission?.target_seats?.DEM ?? 3}석 · 국힘 {mission?.target_seats?.PPP ?? 2}석 만들기
    </div>
  );
}

function StepFlow({ selectedCount, activeDistrict }) {
  const steps = [
    { id: 1, label: "지역 선택", done: selectedCount > 0, active: selectedCount === 0 },
    { id: 2, label: "선거구 고르기", done: selectedCount > 0 && activeDistrict, active: selectedCount > 0 },
    { id: 3, label: "묶기", done: false, active: selectedCount > 0 },
  ];

  return (
    <div className="flex min-w-0 flex-1 items-center">
      {steps.map((step, index) => (
        <React.Fragment key={step.id}>
          <div
            className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 ${
              step.active ? "bg-blue-50" : ""
            }`}
          >
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                step.done
                  ? "bg-emerald-600 text-white"
                  : step.active
                    ? "bg-blue-600 text-white"
                    : "bg-slate-200 text-slate-500"
              }`}
            >
              {step.done ? "✓" : step.id}
            </span>
            <span
              className={`whitespace-nowrap text-xs font-extrabold ${
                step.done ? "text-emerald-700" : step.active ? "text-blue-800" : "text-slate-500"
              }`}
            >
              {step.label}
            </span>
          </div>
          {index < steps.length - 1 ? <span className="mx-1 text-sm font-bold text-slate-300">›</span> : null}
        </React.Fragment>
      ))}
    </div>
  );
}

function DistrictButton({ districtId, activeDistrict, onClick }) {
  const district = DISTRICT_THEME[districtId];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`whitespace-nowrap rounded-lg border-2 px-3.5 py-1.5 text-sm font-black transition ${
        activeDistrict === districtId ? "shadow-[0_0_0_3px_rgba(15,23,42,0.08)]" : ""
      }`}
      style={{
        backgroundColor: district.soft,
        borderColor: activeDistrict === districtId ? district.color : "transparent",
        color: district.color,
      }}
    >
      {districtName(districtId)}
    </button>
  );
}

function ActiveDistrictCard({ districtId, areaIds, electionDatasetId, populationRange, collapsed, onToggleCollapsed }) {
  const district = DISTRICT_THEME[districtId];
  const population = areaIds.reduce((sum, areaId) => sum + (AREA_BY_ID[areaId]?.population || 0), 0);
  const votes = areaIds.reduce(
    (sum, areaId) => {
      const areaVotes = getAreaVotes(areaId, electionDatasetId);
      return {
        DEM: sum.DEM + areaVotes.DEM,
        PPP: sum.PPP + areaVotes.PPP,
      };
    },
    { DEM: 0, PPP: 0 },
  );
  const totalVotes = votes.DEM + votes.PPP;
  const winner = totalVotes === 0 ? null : votes.DEM >= votes.PPP ? "DEM" : "PPP";
  const winnerColor = winner === "DEM" ? "#1B6BFF" : winner === "PPP" ? "#E34848" : "#64748b";
  const demShare = totalVotes ? votes.DEM / totalVotes : 0;
  const pppShare = totalVotes ? votes.PPP / totalVotes : 0;
  const populationStatus =
    population === 0
      ? "지역을 선택하거나 묶어보세요"
      : population < populationRange.minPopulation
        ? "권장 인구보다 적음"
        : population > populationRange.maxPopulation
          ? "권장 인구보다 많음"
          : "권장 범위 안";

  return (
    <aside className={`absolute right-6 top-6 z-20 rounded-xl border border-slate-200 bg-white/95 shadow-xl backdrop-blur ${
      collapsed ? "w-[170px] p-2.5" : "w-[250px] p-4"
    }`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">{collapsed ? "선거구" : "선거구 정보"}</p>
          <h2 className={`${collapsed ? "mt-0.5 text-base" : "mt-1 text-lg"} font-black`} style={{ color: district.color }}>
            {district.name}
          </h2>
        </div>
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="rounded-lg px-2.5 py-1 text-xs font-black transition hover:brightness-95"
          style={{ backgroundColor: district.soft, color: district.color }}
          aria-expanded={!collapsed}
          title={collapsed ? "선거구 정보 펼치기" : "선거구 정보 접기"}
        >
          {collapsed ? "펼치기" : "접기"}
        </button>
      </div>

      {collapsed ? (
        <div className="mt-2 grid gap-1 text-[11px] font-black text-slate-700">
          <div className="flex items-center justify-between">
            <span className="text-slate-500">{areaIds.length}곳</span>
            <span>{formatNumber(population)}명</span>
          </div>
          <p className="truncate" style={{ color: winnerColor }}>
            {winner ? `${partyName(winner)} 우세` : "선택 대기"}
          </p>
        </div>
      ) : (
        <>

      <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2">
        <div className="flex items-end justify-between gap-2">
          <span className="text-xs font-extrabold text-slate-500">현재 인구</span>
          <span className="text-xl font-black text-slate-900">{formatNumber(population)}명</span>
        </div>
        <p className="mt-1 text-[11px] font-bold text-slate-500">
          권장 {formatNumber(populationRange.minPopulation)}~{formatNumber(populationRange.maxPopulation)}명 · {populationStatus}
        </p>
      </div>

      <div className="mt-3 grid gap-2">
        <div className="flex items-center justify-between text-sm font-black">
          <span className="text-[#1B6BFF]">민주당</span>
          <span>{formatNumber(votes.DEM)}표</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-[#1B6BFF]" style={{ width: `${Math.min(100, demShare * 100)}%` }} />
        </div>
        <div className="flex items-center justify-between text-sm font-black">
          <span className="text-[#E34848]">국민의힘</span>
          <span>{formatNumber(votes.PPP)}표</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-[#E34848]" style={{ width: `${Math.min(100, pppShare * 100)}%` }} />
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
        <p className="text-[10px] font-black uppercase tracking-[0.08em] text-slate-500">당선 예상</p>
        <p className="mt-1 text-base font-black" style={{ color: winnerColor }}>
          {winner ? `${partyName(winner)} 후보 당선` : "아직 계산할 표가 없습니다"}
        </p>
      </div>
        </>
      )}
    </aside>
  );
}

function CheckItem({ state, children }) {
  const styles = {
    ok: "bg-emerald-50 text-emerald-700",
    warn: "bg-yellow-50 text-yellow-800",
    error: "bg-red-50 text-red-700",
  };
  const marker = state === "ok" ? "완료" : state === "warn" ? "주의" : "필수";

  return (
    <div className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs font-extrabold leading-5 ${styles[state]}`}>
      <span className="shrink-0 text-[10px] font-black">{marker}</span>
      <span>{children}</span>
    </div>
  );
}

function ProportionalityTab({ evaluation }) {
  const totalSeats = DISTRICTS.length;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50">
      <div className="border-b border-slate-200 px-3 py-2">
        <h2 className="text-sm font-black text-slate-900">득표율 vs 의석률</h2>
      </div>
      <div className="grid gap-2 p-3">
        {PARTIES.map((party) => {
          const voteShare = (evaluation.expectedSeats[party.id] || 0) / totalSeats;
          const seatShare = (evaluation.seats[party.id] || 0) / totalSeats;
          const distortion = evaluation.distortionByParty[party.id] || 0;

          return (
            <div key={party.id} className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-black" style={{ color: party.color }}>
                  {party.name}
                </span>
                <span className="text-[11px] font-extrabold text-slate-500">왜곡 {distortion.toFixed(2)}석</span>
              </div>
              <div className="mt-2 grid gap-2">
                {[
                  ["득표율", voteShare, 1],
                  ["의석률", seatShare, 0.62],
                ].map(([label, value, opacity]) => (
                  <div key={label}>
                    <div className="flex justify-between text-[10px] font-extrabold text-slate-500">
                      <span>{label}</span>
                      <span>{formatPercent(value)}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.min(100, value * 100)}%`, backgroundColor: party.color, opacity }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DistrictStatsTab({ evaluation }) {
  return (
    <div className="grid gap-2">
      {evaluation.districtResults.map((result) => {
        const demShare = result.totalVotes ? result.votes.DEM / result.totalVotes : 0;
        const pppShare = result.totalVotes ? result.votes.PPP / result.totalVotes : 0;
        const winner = result.winner ? `${partyShortName(result.winner)} 승` : "미획정";
        const winnerColor = result.winner === "DEM" ? "#1B6BFF" : result.winner === "PPP" ? "#E34848" : "#64748b";

        return (
          <article
            key={result.districtId}
            className="rounded-lg border border-slate-200 border-l-[5px] bg-white p-3"
            style={{ borderLeftColor: DISTRICT_THEME[result.districtId].color }}
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-black text-slate-900">{districtName(result.districtId)}</h3>
              <span className="text-[11px] font-extrabold" style={{ color: winnerColor }}>
                {winner}
              </span>
            </div>
            <p className="mt-1 text-[10px] font-bold text-slate-500">
              인구 {formatNumber(result.population)} · 득표 {formatNumber(result.totalVotes)}
            </p>
            <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-slate-200">
              <div style={{ flex: result.votes.DEM || 0, backgroundColor: "#1B6BFF", opacity: 0.82 }} />
              <div style={{ flex: result.votes.PPP || 0, backgroundColor: "#E34848", opacity: 0.82 }} />
              {result.totalVotes === 0 ? <div className="flex-1 bg-slate-200" /> : null}
            </div>
            <p className="mt-1 text-[10px] font-bold text-slate-500">
              민주 {formatPercent(demShare)} · 국힘 {formatPercent(pppShare)}
            </p>
            <p className="mt-1 line-clamp-3 text-[10px] font-bold leading-4 text-slate-500">
              포함: {result.areaNames.length > 0 ? result.areaNames.join(", ") : "없음"}
            </p>
          </article>
        );
      })}
    </div>
  );
}

function CheckTab({ evaluation, connectedDb }) {
  const unassignedNames = evaluation.unassignedAreaIds
    .slice(0, 4)
    .map((areaId) => AREA_BY_ID[areaId]?.name || areaId)
    .join(", ");
  const hiddenUnassignedCount = Math.max(0, evaluation.unassignedAreaIds.length - 4);
  const unassignedLabel = hiddenUnassignedCount > 0 ? `${unassignedNames} 외 ${hiddenUnassignedCount}곳` : unassignedNames;
  const validDistricts = evaluation.districtResults.filter((result) => result.areaIds.length > 0 && result.contiguous).length;

  return (
    <>
      <div className="rounded-xl border border-slate-200 bg-slate-50">
        <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
          <h2 className="text-sm font-black text-slate-900">제출 전 점검</h2>
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-black text-blue-800">
            {evaluation.canSubmit ? "제출 가능" : `${evaluation.unassignedAreaIds.length + evaluation.emptyDistricts.length}개 남음`}
          </span>
        </div>
        <div className="grid gap-1.5 p-3">
          {evaluation.unassignedAreaIds.length > 0 ? (
            <CheckItem state="error">{unassignedLabel}이 아직 배정되지 않았습니다.</CheckItem>
          ) : (
            <CheckItem state="ok">모든 읍·면·동이 선거구에 배정되었습니다.</CheckItem>
          )}
          {evaluation.emptyDistricts.length > 0 ? (
            <CheckItem state="error">비어 있는 선거구: {formatDistrictNames(evaluation.emptyDistricts)}</CheckItem>
          ) : (
            <CheckItem state="ok">모든 선거구에 지역이 포함되었습니다.</CheckItem>
          )}
          {evaluation.contiguity.errors.length > 0 ? (
            evaluation.contiguity.errors.map((error) => (
              <CheckItem key={error} state="error">
                {error}
              </CheckItem>
            ))
          ) : (
            <CheckItem state="ok">{validDistricts}개 선거구의 연결 상태가 정상입니다.</CheckItem>
          )}
          {evaluation.populationViolations.length > 0 ? (
            <CheckItem state="warn">인구 권장 범위를 벗어난 선거구 {evaluation.populationViolations.length}개는 감점됩니다.</CheckItem>
          ) : (
            <CheckItem state="ok">인구 권장 범위 위반이 없습니다.</CheckItem>
          )}
          {evaluation.packingViolations.length > 0 ? (
            <CheckItem state="warn">한 정당이 75% 이상 몰린 선거구 {evaluation.packingViolations.length}개는 감점됩니다.</CheckItem>
          ) : (
            <CheckItem state="ok">packing 감점 대상이 없습니다.</CheckItem>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50">
        <div className="border-b border-slate-200 px-3 py-2">
          <h2 className="text-sm font-black text-slate-900">획정 규칙 요약</h2>
        </div>
        <div className="grid gap-1.5 p-3 text-xs font-bold leading-5 text-slate-500">
          <p>모든 읍·면·동은 세종갑~세종무 중 하나에 배정</p>
          <p>같은 선거구의 지역은 인접하여 하나로 연결</p>
          <p>선거구 인구: 평균 ±10% 권장</p>
          <p>한 정당이 75% 이상이면 packing 감점</p>
          {!connectedDb ? <p className="rounded-lg bg-yellow-50 px-2 py-1.5 font-extrabold text-yellow-800">현재 로컬 데모 모드입니다.</p> : null}
        </div>
      </div>

    </>
  );
}

export default function StudentMap({ pin, teamId, teamName = "우리 모둠", db }) {
  const [assignments, setAssignments] = useState(() => readStoredAssignments(pin, teamId));
  const [selectedAreaIds, setSelectedAreaIds] = useState([]);
  const [activeDistrict, setActiveDistrict] = useState(1);
  const [activeTab, setActiveTab] = useState("check");
  const [districtCardCollapsed, setDistrictCardCollapsed] = useState(true);
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
  const missionStartedAt = mission?.startedAtClient || null;
  const populationRange = getPopulationRange(DISTRICTS.length);
  const selectedPopulation = selectedAreaIds.reduce((sum, areaId) => sum + (AREA_BY_ID[areaId]?.population || 0), 0);
  const activeDistrictAreaIds = useMemo(() => {
    const areaIds = new Set(selectedAreaIds);
    for (const area of SEJONG_AREAS) {
      if (normalizedAssignments[area.id] === activeDistrict) areaIds.add(area.id);
    }
    return [...areaIds];
  }, [activeDistrict, normalizedAssignments, selectedAreaIds]);
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
  }, [missionStartedAt, normalizedAssignments, pin, teamId, connectedDb]);

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
      setMessage("이미 선거구에 배정된 지역입니다. 현재 선거구를 초기화한 뒤 다시 선택하세요.");
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

  const tabs = [
    { id: "check", label: "점검" },
    { id: "proportionality", label: "비례성" },
    { id: "districts", label: "선거구별" },
  ];

  return (
    <main className="h-screen overflow-hidden bg-slate-50 text-slate-900">
      <header className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 border-b border-slate-200 bg-white px-5 py-2.5 shadow-sm">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-blue-600">SEJONG GERRYMANDERING</p>
          <h1 className="truncate text-lg font-black text-slate-900">지도를 훔친 자들</h1>
          <p className="truncate text-xs font-bold text-slate-500">{teamName} · 세종특별자치시 읍·면·동 재획정</p>
        </div>
        <TimerRing remainingTime={remainingTime} durationSeconds={mission?.durationSeconds} />
        <div className="flex min-w-0 justify-end">
          <div className="flex flex-col items-end gap-1">
            <span className="text-[10px] font-black uppercase tracking-[0.08em] text-slate-500">미션 목표</span>
            <MissionGoal mission={mission} missionType={missionType} missionConfig={missionConfig} />
          </div>
        </div>
      </header>

      <div className="grid h-[calc(100vh-90px)] grid-cols-[minmax(0,1fr)_300px] overflow-hidden max-lg:grid-cols-1 max-lg:grid-rows-[minmax(0,1fr)_360px]">
        <section className="flex min-h-0 flex-col overflow-hidden bg-slate-100">
          <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-2.5">
            <StepFlow selectedCount={selectedAreaIds.length} activeDistrict={activeDistrict} />
            <div className="h-7 w-px bg-slate-200" />
            <span className="whitespace-nowrap text-xs font-extrabold text-slate-500">
              선택 <span className="font-black text-blue-600">{selectedAreaIds.length}</span>곳 · 약 {formatNumber(selectedPopulation)}명
            </span>
          </div>

          <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2">
            <span className="mr-1 whitespace-nowrap text-[11px] font-black text-slate-500">선거구</span>
            {DISTRICTS.map((districtId) => (
              <DistrictButton
                key={districtId}
                districtId={districtId}
                activeDistrict={activeDistrict}
                onClick={() => setActiveDistrict(districtId)}
              />
            ))}
            <div className="flex-1" />
            <p className="hidden whitespace-nowrap text-xs font-extrabold text-slate-500 xl:block">
              {RECOMMENDED_DISTRICT_COUNT}개 선거구 · 권장 {formatNumber(populationRange.minPopulation)}~{formatNumber(populationRange.maxPopulation)}명
            </p>
            <button
              type="button"
              onClick={() => clearDistrict(activeDistrict)}
              className="whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 transition hover:bg-slate-100"
            >
              현재 선거구 초기화
            </button>
            <button
              type="button"
              onClick={resetAll}
              className="whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 transition hover:bg-slate-100"
            >
              전체 초기화
            </button>
            <button
              type="button"
              disabled={selectedAreaIds.length === 0 || !selectedContiguous}
              onClick={createDistrict}
              className="whitespace-nowrap rounded-lg bg-blue-600 px-4 py-2 text-sm font-black text-white transition hover:bg-blue-800 disabled:bg-slate-300 disabled:text-slate-400"
            >
              {districtName(activeDistrict)}으로 묶기
            </button>
          </div>

          <div className="relative min-h-0 flex-1 overflow-auto">
            <div className="min-h-full p-3">
              <ActiveDistrictCard
                districtId={activeDistrict}
                areaIds={activeDistrictAreaIds}
                electionDatasetId={electionDatasetId}
                populationRange={populationRange}
                collapsed={districtCardCollapsed}
                onToggleCollapsed={() => setDistrictCardCollapsed((current) => !current)}
              />
              <SejongMap
                assignments={normalizedAssignments}
                selectedAreaIds={selectedAreaIds}
                selectableAreaIds={selectableAreaIds}
                electionDatasetId={electionDatasetId}
                showVoteCallouts
                onToggleArea={toggleArea}
              />
            </div>
            {(message || error) ? (
              <div className="pointer-events-none absolute bottom-5 left-1/2 z-20 max-w-[calc(100%-32px)] -translate-x-1/2 rounded-full bg-slate-900/90 px-5 py-2 text-center text-sm font-extrabold text-white shadow-lg backdrop-blur">
                {message || error.message}
              </div>
            ) : null}
          </div>
        </section>

        <aside className="flex min-h-0 flex-col overflow-hidden border-l border-slate-200 bg-white max-lg:border-l-0 max-lg:border-t">
          <div className="shrink-0 border-b border-slate-200 p-3">
            <button
              type="button"
              disabled={submitDisabled}
              onClick={handleSubmit}
              className="w-full rounded-xl bg-blue-600 px-4 py-3 text-base font-black text-white transition hover:bg-blue-800 disabled:bg-slate-400"
            >
              {submitLabel}
            </button>
            <div className="mt-2 flex justify-center">
              <SeatPreview evaluation={evaluation} />
            </div>
            {submittedMatchesCurrent ? (
              <p className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black leading-5 text-emerald-700">
                제출 완료. 지도를 수정하면 다시 제출할 수 있습니다.
              </p>
            ) : null}
          </div>

          <div className="grid shrink-0 grid-cols-3 border-b border-slate-200">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`border-b-2 px-2 py-2.5 text-xs font-black transition ${
                  activeTab === tab.id
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-slate-500 hover:bg-slate-50"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
            {activeTab === "check" ? (
              <CheckTab
                evaluation={evaluation}
                connectedDb={connectedDb}
              />
            ) : null}
            {activeTab === "proportionality" ? <ProportionalityTab evaluation={evaluation} /> : null}
            {activeTab === "districts" ? <DistrictStatsTab evaluation={evaluation} /> : null}
          </div>
        </aside>
      </div>
    </main>
  );
}
