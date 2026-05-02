import { useCallback, useEffect, useMemo, useState } from "react";
import { initializeApp, getApps } from "firebase/app";
import {
  getDatabase,
  onValue,
  ref,
  remove,
  serverTimestamp,
  set,
  update,
} from "firebase/database";
import {
  DEFAULT_ELECTION_DATASET_ID,
  DEFAULT_MISSION_TYPE,
  seatsMatchTarget,
  validatePlan,
} from "../data/gerrymandering";

const FIREBASE_CONFIG_STORAGE_KEY = "gerrymanderingFirebaseConfig";

function getStoredFirebaseConfig() {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(FIREBASE_CONFIG_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function getFirebaseConfig() {
  const storedConfig = getStoredFirebaseConfig();
  if (storedConfig?.apiKey || storedConfig?.databaseURL || storedConfig?.projectId) {
    return storedConfig;
  }

  const env = import.meta.env || {};

  return {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    databaseURL: env.VITE_FIREBASE_DATABASE_URL,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID,
  };
}

function getConfiguredDatabase(externalDb) {
  if (externalDb) return externalDb;

  const config = getFirebaseConfig();
  if (!config.apiKey || !config.databaseURL || !config.projectId) {
    throw new Error("Firebase 설정이 없습니다. db를 주입하거나 VITE_FIREBASE_* 환경변수를 설정하세요.");
  }

  const app = getApps().length > 0 ? getApps()[0] : initializeApp(config);
  return getDatabase(app);
}

function gamePath(pin, child = "") {
  const cleanPin = String(pin || "").trim();
  return child ? `games/${cleanPin}/${child}` : `games/${cleanPin}`;
}

function getStatusFromEvaluation(evaluation) {
  if (evaluation.contiguity.errors.length > 0) return "contiguity_error";
  if (evaluation.canSubmit) return "ready";
  return "in_progress";
}

function normalizeSubmission(value, key) {
  return {
    id: key,
    teamId: value.teamId || key,
    teamName: value.teamName || key,
    assignments: value.assignments || {},
    seats: value.seats || { DEM: 0, PPP: 0 },
    expectedSeats: value.expectedSeats || { DEM: 0, PPP: 0 },
    score: value.score ?? value.finalScore ?? 0,
    finalScore: value.finalScore ?? value.score ?? 0,
    missionScore: value.missionScore ?? 0,
    missionRank: value.missionRank ?? null,
    distortionScore: value.distortionScore ?? 0,
    proportionalityScore: value.proportionalityScore ?? 0,
    advantagedParty: value.advantagedParty || null,
    districtResults: value.districtResults || [],
    violations: value.violations || { population: 0, packing: 0 },
    electionDatasetId: value.electionDatasetId || DEFAULT_ELECTION_DATASET_ID,
    missionType: value.missionType || DEFAULT_MISSION_TYPE,
    status: value.status || "in_progress",
    isValid: Boolean(value.isValid),
    missionSuccess: Boolean(value.missionSuccess),
    updatedAt: value.updatedAt || null,
    submittedAt: value.submittedAt || null,
  };
}

function getMissionSuccess(assignmentsEvaluation, missionType, targetSeats) {
  if (!assignmentsEvaluation.canSubmit) return false;
  if (missionType === "target_seats") return seatsMatchTarget(assignmentsEvaluation.seats, targetSeats);
  return true;
}

function getSubmissionTime(entry) {
  return Number(entry.submittedAt || entry.updatedAt || 0);
}

function isScoreEligible(entry, missionType) {
  if (missionType === "target_seats") return entry.status === "mission_success" || entry.missionSuccess;
  return (entry.status === "mission_success" || entry.status === "submitted") && entry.isValid;
}

function sortScoreEligibleEntries(entries, missionType) {
  return [...entries].sort((left, right) => {
    if (missionType === "min_proportionality") {
      const distortionDiff = Number(right.distortionScore || 0) - Number(left.distortionScore || 0);
      if (distortionDiff !== 0) return distortionDiff;
    }

    if (missionType === "max_proportionality") {
      const proportionalityDiff = Number(right.proportionalityScore || 0) - Number(left.proportionalityScore || 0);
      if (proportionalityDiff !== 0) return proportionalityDiff;
    }

    return getSubmissionTime(left) - getSubmissionTime(right);
  });
}

export function useGerrymandering({
  pin,
  teamId,
  teamName,
  db,
  autoRegisterTeam = true,
} = {}) {
  const [mission, setMissionState] = useState(null);
  const [room, setRoom] = useState({});
  const [teams, setTeams] = useState({});
  const [submissions, setSubmissions] = useState({});
  const [loading, setLoading] = useState(Boolean(pin));
  const [error, setError] = useState(null);

  const database = useMemo(() => {
    try {
      return getConfiguredDatabase(db);
    } catch {
      return null;
    }
  }, [db]);

  useEffect(() => {
    if (database) {
      setError(null);
      return;
    }

    try {
      getConfiguredDatabase(db);
    } catch (caughtError) {
      setError(caughtError);
    }
  }, [database, db]);

  useEffect(() => {
    if (!database || !pin) return undefined;

    setLoading(true);
    const unsubscribers = [
      onValue(ref(database, gamePath(pin, "room")), (snapshot) => {
        setRoom(snapshot.val() || {});
      }),
      onValue(ref(database, gamePath(pin, "mission")), (snapshot) => {
        setMissionState(snapshot.val());
        setLoading(false);
      }),
      onValue(ref(database, gamePath(pin, "teams")), (snapshot) => {
        setTeams(snapshot.val() || {});
      }),
      onValue(ref(database, gamePath(pin, "submissions")), (snapshot) => {
        setSubmissions(snapshot.val() || {});
      }),
    ];

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [database, pin]);

  useEffect(() => {
    if (!database || !pin || !teamId || !autoRegisterTeam) return;

    update(ref(database, gamePath(pin, `teams/${teamId}`)), {
      teamId,
      teamName: teamName || teamId,
      online: true,
      lastSeenAt: serverTimestamp(),
    }).catch(setError);
  }, [autoRegisterTeam, database, pin, teamId, teamName]);

  const updateDraft = useCallback(
    async (assignments) => {
      if (!database || !pin || !teamId) return null;

      const electionDatasetId = mission?.electionDatasetId || DEFAULT_ELECTION_DATASET_ID;
      const missionType = mission?.missionType || DEFAULT_MISSION_TYPE;
      const evaluation = validatePlan(assignments, mission?.target_seats, { electionId: electionDatasetId, missionType });
      const status = getStatusFromEvaluation(evaluation);

      await update(ref(database, gamePath(pin, `submissions/${teamId}`)), {
        teamId,
        teamName: teamName || teamId,
        assignments,
        seats: evaluation.seats,
        expectedSeats: evaluation.expectedSeats,
        score: evaluation.finalScore,
        finalScore: evaluation.finalScore,
        distortionScore: evaluation.distortionScore,
        proportionalityScore: evaluation.proportionalityScore,
        advantagedParty: evaluation.advantagedParty,
        districtResults: evaluation.districtResults,
        violations: {
          population: evaluation.populationViolations.length,
          packing: evaluation.packingViolations.length,
        },
        electionDatasetId,
        missionType,
        status,
        isValid: evaluation.canSubmit,
        missionSuccess: false,
        errors: evaluation.errors,
        updatedAt: serverTimestamp(),
      });

      return evaluation;
    },
    [database, mission?.electionDatasetId, mission?.missionType, mission?.target_seats, pin, teamId, teamName],
  );

  const submitPlan = useCallback(
    async (assignments) => {
      if (!database || !pin || !teamId) return null;

      const electionDatasetId = mission?.electionDatasetId || DEFAULT_ELECTION_DATASET_ID;
      const missionType = mission?.missionType || DEFAULT_MISSION_TYPE;
      const evaluation = validatePlan(assignments, mission?.target_seats, { electionId: electionDatasetId, missionType });
      if (!evaluation.canSubmit) return evaluation;

      const missionSuccess = getMissionSuccess(evaluation, missionType, mission?.target_seats);

      await set(ref(database, gamePath(pin, `submissions/${teamId}`)), {
        teamId,
        teamName: teamName || teamId,
        assignments,
        seats: evaluation.seats,
        expectedSeats: evaluation.expectedSeats,
        score: evaluation.finalScore,
        finalScore: evaluation.finalScore,
        distortionScore: evaluation.distortionScore,
        proportionalityScore: evaluation.proportionalityScore,
        advantagedParty: evaluation.advantagedParty,
        districtResults: evaluation.districtResults,
        violations: {
          population: evaluation.populationViolations.length,
          packing: evaluation.packingViolations.length,
        },
        electionDatasetId,
        missionType,
        status: missionSuccess ? "mission_success" : "submitted",
        isValid: true,
        missionSuccess,
        errors: [],
        submittedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      return { ...evaluation, missionSuccess };
    },
    [database, mission?.electionDatasetId, mission?.missionType, mission?.target_seats, pin, teamId, teamName],
  );

  const setMission = useCallback(
    async ({
      targetSeats,
      durationSeconds = 1200,
      title = "세종시 게리맨더링 미션",
      electionDatasetId = DEFAULT_ELECTION_DATASET_ID,
      missionType = DEFAULT_MISSION_TYPE,
    }) => {
      if (!database || !pin) return;

      await set(ref(database, gamePath(pin, "mission")), {
        title,
        target_seats: targetSeats,
        electionDatasetId,
        missionType,
        durationSeconds,
        startedAtClient: Date.now(),
        endsAt: Date.now() + durationSeconds * 1000,
        updatedAt: serverTimestamp(),
      });
    },
    [database, pin],
  );

  const resetRound = useCallback(async () => {
    if (!database || !pin) return;

    await remove(ref(database, gamePath(pin, "submissions")));
  }, [database, pin]);

  const confirmTeams = useCallback(
    async (teamEntries = []) => {
      if (!database || !pin) return;

      await update(ref(database, gamePath(pin, "room")), {
        teamsConfirmed: true,
        confirmedTeamIds: teamEntries.map((team) => team.teamId),
        confirmedTeamNames: teamEntries.map((team) => team.teamName),
        teamsConfirmedAt: serverTimestamp(),
      });
    },
    [database, pin],
  );

  const leaderboard = useMemo(() => {
    const statusRank = {
      mission_success: 0,
      submitted: 1,
      ready: 2,
      contiguity_error: 3,
      in_progress: 4,
    };

    const missionType = mission?.missionType || DEFAULT_MISSION_TYPE;
    const normalizedEntries = Object.entries(submissions).map(([key, value]) => normalizeSubmission(value, key));
    const eligibleEntries = sortScoreEligibleEntries(
      normalizedEntries.filter((entry) => isScoreEligible(entry, missionType)),
      missionType,
    );
    const scoreByTeamId = new Map(
      eligibleEntries.map((entry, index) => [
        entry.teamId,
        {
          missionRank: index + 1,
          missionScore: eligibleEntries.length - index,
        },
      ]),
    );

    return normalizedEntries
      .map((entry) => ({
        ...entry,
        missionRank: scoreByTeamId.get(entry.teamId)?.missionRank ?? null,
        missionScore: scoreByTeamId.get(entry.teamId)?.missionScore ?? 0,
      }))
      .sort((left, right) => {
        const missionScoreDiff = Number(right.missionScore || 0) - Number(left.missionScore || 0);
        if (missionScoreDiff !== 0) return missionScoreDiff;
        const rankDiff = (statusRank[left.status] ?? 9) - (statusRank[right.status] ?? 9);
        if (rankDiff !== 0) return rankDiff;
        return Number(left.submittedAt || left.updatedAt || 0) - Number(right.submittedAt || right.updatedAt || 0);
      });
  }, [mission?.missionType, submissions]);

  return {
    db: database,
    mission,
    room,
    teams,
    submissions,
    leaderboard,
    loading,
    error,
    updateDraft,
    submitPlan,
    setMission,
    resetRound,
    confirmTeams,
  };
}

export default useGerrymandering;
