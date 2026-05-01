export const PARTIES = [
  { id: "DEM", name: "민주당", shortName: "민주", color: "#1B6BFF", soft: "#E6EEFF" },
  { id: "PPP", name: "국민의힘", shortName: "국힘", color: "#E34848", soft: "#FEECEC" },
];

export const PARTY_IDS = PARTIES.map((party) => party.id);
export const DISTRICTS = [1, 2, 3, 4, 5];
export const RECOMMENDED_DISTRICT_COUNT = 5;
export const DISTRICT_COUNT_OPTIONS = [4, 5, 6];
export const DEFAULT_ELECTION_DATASET_ID = "president2022";
export const DEFAULT_MISSION_TYPE = "target_seats";

export const MISSION_TYPES = {
  target_seats: {
    id: "target_seats",
    name: "목표 의석 수 맞추기",
    description: "교사가 제시한 민주당/국민의힘 의석수 조합을 정확히 만듭니다.",
  },
  min_proportionality: {
    id: "min_proportionality",
    name: "비례성 가장 낮게 만들기",
    description: "정당 득표율과 의석 결과의 차이를 최대한 크게 만듭니다.",
  },
  max_proportionality: {
    id: "max_proportionality",
    name: "비례성 가장 크게 만들기",
    description: "정당 득표율과 의석 결과의 차이를 최대한 작게 만듭니다.",
  },
};

export const DISTRICT_THEME = {
  1: { name: "제1선거구", color: "#1B6BFF", soft: "#E6EEFF" },
  2: { name: "제2선거구", color: "#2E7D4F", soft: "#EAF5EE" },
  3: { name: "제3선거구", color: "#F2A900", soft: "#FFF4D6" },
  4: { name: "제4선거구", color: "#8B5CF6", soft: "#F0E7FF" },
  5: { name: "제5선거구", color: "#0F766E", soft: "#DDF7F2" },
};

const AREA_ORDER = [
  "sojeong",
  "jeonui",
  "jeondong",
  "yeonseo",
  "jochiwon",
  "yeondong",
  "janggun",
  "yeongi",
  "haemil",
  "areum",
  "dodam",
  "bugang",
  "goun",
  "jongchon",
  "eojin",
  "dajeong",
  "saerom",
  "naseong",
  "hansol",
  "geumnam",
  "daepyeong",
  "boram",
  "sodam",
  "bangok",
];

const AREA_NEIGHBORS = {
  sojeong: ["jeonui"],
  jeonui: ["sojeong", "jeondong", "yeonseo"],
  jeondong: ["jeonui", "yeonseo", "jochiwon"],
  yeonseo: ["jeonui", "jeondong", "jochiwon", "yeongi", "janggun", "yeondong"],
  jochiwon: ["yeonseo", "jeondong"],
  yeondong: ["yeonseo", "geumnam", "bugang", "yeongi"],
  janggun: ["yeonseo", "goun", "geumnam", "dajeong", "saerom", "hansol", "yeongi"],
  yeongi: ["yeonseo", "goun", "yeondong", "janggun"],
  haemil: ["dodam"],
  areum: ["goun", "dodam", "jongchon"],
  dodam: ["areum", "eojin", "jongchon", "haemil"],
  bugang: ["geumnam", "yeondong"],
  goun: ["dajeong", "areum", "yeongi", "janggun", "jongchon"],
  jongchon: ["goun", "dajeong", "dodam", "areum", "eojin"],
  eojin: ["naseong", "dajeong", "dodam", "jongchon"],
  dajeong: ["goun", "naseong", "saerom", "eojin", "janggun", "jongchon"],
  saerom: ["naseong", "dajeong", "janggun", "hansol"],
  naseong: ["dajeong", "saerom", "eojin", "hansol"],
  hansol: ["naseong", "saerom", "janggun"],
  geumnam: ["daepyeong", "bangok", "boram", "bugang", "sodam", "yeondong", "janggun"],
  daepyeong: ["geumnam", "boram"],
  boram: ["geumnam", "daepyeong", "sodam"],
  sodam: ["geumnam", "bangok", "boram"],
  bangok: ["geumnam", "sodam"],
};

const AREA_INFO = {
  sojeong: ["소정면", 2800, 920, 1180],
  jeonui: ["전의면", 6100, 2350, 2820],
  jeondong: ["전동면", 3700, 1320, 1720],
  yeonseo: ["연서면", 7800, 3250, 3320],
  jochiwon: ["조치원읍", 43800, 20500, 17600],
  yeondong: ["연동면", 3300, 1220, 1530],
  janggun: ["장군면", 7800, 3350, 2950],
  yeongi: ["연기면", 3500, 1450, 1380],
  haemil: ["해밀동", 11500, 6450, 3650],
  areum: ["아름동", 23600, 12800, 7700],
  dodam: ["도담동", 33500, 18300, 10400],
  bugang: ["부강면", 6800, 2650, 3050],
  goun: ["고운동", 34300, 19000, 11100],
  jongchon: ["종촌동", 29500, 16300, 9400],
  eojin: ["어진동", 11800, 6500, 3800],
  dajeong: ["다정동", 28900, 16400, 8400],
  saerom: ["새롬동", 31000, 17600, 9100],
  naseong: ["나성동", 13900, 7400, 4800],
  hansol: ["한솔동", 18700, 10500, 5650],
  geumnam: ["금남면", 9100, 3900, 3650],
  daepyeong: ["대평동", 12400, 6900, 3900],
  boram: ["보람동", 19100, 10800, 5600],
  sodam: ["소담동", 33300, 19000, 9300],
  bangok: ["반곡동", 30200, 17100, 8500],
};

export const ELECTION_DATASETS = {
  president2022: {
    id: "president2022",
    name: "2022 대선",
    description: "제20대 대통령선거 양대 후보 구도를 수업용 읍면동 단위로 연결한 데이터",
    sourceLabel: "이재명 vs 윤석열",
    demLabel: "이재명",
    pppLabel: "윤석열",
    votes: Object.fromEntries(Object.entries(AREA_INFO).map(([areaId, [, , demVotes, pppVotes]]) => [areaId, { DEM: demVotes, PPP: pppVotes }])),
  },
  assembly2024: {
    id: "assembly2024",
    name: "2024 총선",
    description: "제22대 국회의원선거 정당 구도를 수업용 읍면동 단위로 연결한 데이터",
    sourceLabel: "민주 진영 vs 국민의힘 진영",
    demLabel: "민주 진영",
    pppLabel: "국민의힘 진영",
    votes: {
      sojeong: { DEM: 820, PPP: 1260 },
      jeonui: { DEM: 2150, PPP: 3020 },
      jeondong: { DEM: 1180, PPP: 1870 },
      yeonseo: { DEM: 3180, PPP: 3460 },
      jochiwon: { DEM: 19600, PPP: 18650 },
      yeondong: { DEM: 1120, PPP: 1620 },
      janggun: { DEM: 3540, PPP: 3040 },
      yeongi: { DEM: 1510, PPP: 1420 },
      haemil: { DEM: 6720, PPP: 3480 },
      areum: { DEM: 13480, PPP: 7280 },
      dodam: { DEM: 19050, PPP: 10150 },
      bugang: { DEM: 2420, PPP: 3290 },
      goun: { DEM: 19900, PPP: 10750 },
      jongchon: { DEM: 17100, PPP: 9050 },
      eojin: { DEM: 6820, PPP: 3710 },
      dajeong: { DEM: 17250, PPP: 8070 },
      saerom: { DEM: 18400, PPP: 8720 },
      naseong: { DEM: 7980, PPP: 4620 },
      hansol: { DEM: 11150, PPP: 5520 },
      geumnam: { DEM: 3820, PPP: 3920 },
      daepyeong: { DEM: 7440, PPP: 3680 },
      boram: { DEM: 11580, PPP: 5380 },
      sodam: { DEM: 20150, PPP: 8840 },
      bangok: { DEM: 18120, PPP: 8070 },
    },
  },
};

const AREA_SHAPES = {
  sojeong: [
    [20, 4],
    [37, 5],
    [42, 18],
    [32, 29],
    [18, 24],
    [11, 14],
    [20, 4],
  ],
  jeonui: [
    [18, 24],
    [32, 29],
    [40, 44],
    [30, 60],
    [14, 57],
    [6, 43],
    [18, 24],
  ],
  jeondong: [
    [42, 18],
    [58, 16],
    [73, 29],
    [70, 49],
    [53, 54],
    [40, 44],
    [42, 18],
  ],
  yeonseo: [
    [30, 60],
    [53, 54],
    [61, 82],
    [47, 97],
    [27, 93],
    [15, 78],
    [30, 60],
  ],
  jochiwon: [
    [53, 54],
    [70, 49],
    [86, 58],
    [85, 73],
    [68, 76],
    [61, 82],
    [53, 54],
  ],
  yeondong: [
    [68, 76],
    [86, 73],
    [97, 84],
    [95, 99],
    [83, 106],
    [67, 95],
    [68, 76],
  ],
  janggun: [
    [15, 78],
    [27, 93],
    [25, 111],
    [13, 123],
    [4, 106],
    [7, 88],
    [15, 78],
  ],
  yeongi: [
    [47, 97],
    [61, 82],
    [67, 95],
    [63, 109],
    [49, 113],
    [38, 104],
    [47, 97],
  ],
  haemil: [
    [25, 111],
    [38, 104],
    [49, 113],
    [46, 123],
    [32, 122],
    [25, 111],
  ],
  areum: [
    [49, 113],
    [63, 109],
    [69, 121],
    [61, 132],
    [46, 123],
    [49, 113],
  ],
  dodam: [
    [63, 109],
    [79, 113],
    [82, 127],
    [69, 121],
    [63, 109],
  ],
  bugang: [
    [79, 113],
    [97, 107],
    [101, 126],
    [88, 139],
    [82, 127],
    [79, 113],
  ],
  goun: [
    [13, 123],
    [25, 111],
    [32, 122],
    [31, 136],
    [18, 140],
    [7, 132],
    [13, 123],
  ],
  jongchon: [
    [32, 122],
    [46, 123],
    [49, 135],
    [39, 144],
    [31, 136],
    [32, 122],
  ],
  eojin: [
    [46, 123],
    [61, 132],
    [57, 143],
    [49, 135],
    [46, 123],
  ],
  dajeong: [
    [31, 136],
    [39, 144],
    [36, 152],
    [24, 155],
    [18, 140],
    [31, 136],
  ],
  saerom: [
    [39, 144],
    [49, 135],
    [57, 143],
    [51, 155],
    [36, 152],
    [39, 144],
  ],
  naseong: [
    [57, 143],
    [67, 151],
    [61, 162],
    [51, 155],
    [57, 143],
  ],
  hansol: [
    [7, 132],
    [18, 140],
    [24, 155],
    [14, 164],
    [3, 151],
    [7, 132],
  ],
  geumnam: [
    [24, 155],
    [36, 152],
    [51, 155],
    [50, 170],
    [35, 177],
    [20, 170],
    [14, 164],
    [24, 155],
  ],
  daepyeong: [
    [51, 155],
    [61, 162],
    [58, 173],
    [50, 170],
    [51, 155],
  ],
  boram: [
    [61, 162],
    [73, 161],
    [76, 174],
    [58, 173],
    [61, 162],
  ],
  sodam: [
    [73, 161],
    [88, 151],
    [95, 165],
    [89, 182],
    [76, 174],
    [73, 161],
  ],
  bangok: [
    [88, 139],
    [101, 126],
    [108, 143],
    [95, 165],
    [88, 151],
    [67, 151],
    [88, 139],
  ],
};

export const SEJONG_AREAS = AREA_ORDER.map((id) => {
    const [name, population, demVotes, pppVotes] = AREA_INFO[id];

    return {
      id,
      name,
      population,
      votes: { DEM: demVotes, PPP: pppVotes },
      neighbors: AREA_NEIGHBORS[id] || [],
      geometry: {
        type: "Polygon",
        coordinates: [AREA_SHAPES[id]],
      },
    };
  });

export const SEJONG_GEOJSON = {
  type: "FeatureCollection",
  features: SEJONG_AREAS.map((area) => ({
    type: "Feature",
    id: area.id,
    properties: {
      name: area.name,
      population: area.population,
      votes: area.votes,
      neighbors: area.neighbors,
    },
    geometry: area.geometry,
  })),
};

export const SAMPLE_OPTIMIZED_ASSIGNMENTS = {
  sojeong: 1,
  jeonui: 1,
  jeondong: 1,
  yeonseo: 1,
  jochiwon: 1,
  yeondong: 2,
  janggun: 2,
  yeongi: 2,
  bugang: 2,
  goun: 2,
  jongchon: 2,
  haemil: 3,
  areum: 3,
  dodam: 3,
  eojin: 3,
  dajeong: 4,
  saerom: 4,
  naseong: 4,
  hansol: 4,
  geumnam: 5,
  daepyeong: 5,
  boram: 5,
  sodam: 5,
  bangok: 5,
};

export const AREA_BY_ID = Object.fromEntries(SEJONG_AREAS.map((area) => [area.id, area]));

export function getElectionDataset(electionId = DEFAULT_ELECTION_DATASET_ID) {
  return ELECTION_DATASETS[electionId] || ELECTION_DATASETS[DEFAULT_ELECTION_DATASET_ID];
}

export function getAreaVotes(areaId, electionId = DEFAULT_ELECTION_DATASET_ID) {
  const dataset = getElectionDataset(electionId);
  return dataset.votes[areaId] || AREA_BY_ID[areaId]?.votes || { DEM: 0, PPP: 0 };
}

export function getEmptyAssignments() {
  return Object.fromEntries(SEJONG_AREAS.map((area) => [area.id, null]));
}

export function normalizeAssignments(assignments) {
  const empty = getEmptyAssignments();
  if (!assignments) return empty;

  if (Array.isArray(assignments)) {
    return empty;
  }

  return Object.fromEntries(
    SEJONG_AREAS.map((area) => {
      const value = assignments[area.id];
      return [area.id, value === undefined || value === null ? null : Number(value)];
    }),
  );
}

export function getDistrictGroups(assignments, districts = DISTRICTS) {
  const normalized = normalizeAssignments(assignments);

  return districts.reduce((groups, districtId) => {
    groups[districtId] = SEJONG_AREAS
      .filter((area) => normalized[area.id] === districtId)
      .map((area) => area.id);
    return groups;
  }, {});
}

export function countDistrictAreas(assignments, districts = DISTRICTS) {
  const groups = getDistrictGroups(assignments, districts);
  return Object.fromEntries(districts.map((districtId) => [districtId, groups[districtId].length]));
}

export function isAreaSetContiguous(areaIds) {
  if (!areaIds || areaIds.length <= 1) return true;

  const areaSet = new Set(areaIds);
  const visited = new Set([areaIds[0]]);
  const queue = [areaIds[0]];

  while (queue.length > 0) {
    const currentId = queue.shift();
    const currentArea = AREA_BY_ID[currentId];
    for (const neighborId of currentArea?.neighbors || []) {
      if (areaSet.has(neighborId) && !visited.has(neighborId)) {
        visited.add(neighborId);
        queue.push(neighborId);
      }
    }
  }

  return visited.size === areaIds.length;
}

export function getSelectableAreaIds(selectedAreaIds, assignments) {
  const normalized = normalizeAssignments(assignments);
  const selectedSet = new Set(selectedAreaIds);

  if (selectedAreaIds.length === 0) {
    return SEJONG_AREAS.filter((area) => !normalized[area.id]).map((area) => area.id);
  }

  const adjacentToSelection = new Set();
  for (const areaId of selectedAreaIds) {
    for (const neighborId of AREA_BY_ID[areaId]?.neighbors || []) {
      adjacentToSelection.add(neighborId);
    }
  }

  return SEJONG_AREAS
    .filter((area) => selectedSet.has(area.id) || (!normalized[area.id] && adjacentToSelection.has(area.id)))
    .map((area) => area.id);
}

export function checkContiguity(assignments, { districts = DISTRICTS } = {}) {
  const groups = getDistrictGroups(assignments, districts);
  const invalidDistricts = [];
  const errors = [];

  for (const districtId of districts) {
    const areaIds = groups[districtId];
    if (areaIds.length > 0 && !isAreaSetContiguous(areaIds)) {
      invalidDistricts.push(districtId);
      errors.push(`${DISTRICT_THEME[districtId].name}의 지역이 서로 인접하지 않습니다.`);
    }
  }

  return {
    isValid: invalidDistricts.length === 0,
    invalidDistricts,
    errors,
  };
}

function sumVotes(areaIds, electionId = DEFAULT_ELECTION_DATASET_ID) {
  return areaIds.reduce(
    (sum, areaId) => {
      const votes = getAreaVotes(areaId, electionId);
      sum.DEM += votes.DEM;
      sum.PPP += votes.PPP;
      return sum;
    },
    { DEM: 0, PPP: 0 },
  );
}

function pickWinner(votes) {
  if (votes.DEM === votes.PPP) return "DEM";
  return votes.DEM > votes.PPP ? "DEM" : "PPP";
}

export function getTotalPopulation() {
  return SEJONG_AREAS.reduce((sum, area) => sum + area.population, 0);
}

export function getTotalVotes(electionId = DEFAULT_ELECTION_DATASET_ID) {
  return sumVotes(SEJONG_AREAS.map((area) => area.id), electionId);
}

export function getPopulationRange(districtCount = DISTRICTS.length) {
  const averagePopulation = getTotalPopulation() / districtCount;
  return {
    averagePopulation,
    minPopulation: averagePopulation * 0.9,
    maxPopulation: averagePopulation * 1.1,
  };
}

export function getDistrictCountReview(districtCounts = DISTRICT_COUNT_OPTIONS) {
  const totalPopulation = getTotalPopulation();

  return districtCounts.map((districtCount) => {
    const populationRange = getPopulationRange(districtCount);
    return {
      districtCount,
      totalPopulation,
      averagePopulation: populationRange.averagePopulation,
      minPopulation: populationRange.minPopulation,
      maxPopulation: populationRange.maxPopulation,
      recommended: districtCount === RECOMMENDED_DISTRICT_COUNT,
    };
  });
}

export function calculateDistrictResults(assignments, { districts = DISTRICTS, electionId = DEFAULT_ELECTION_DATASET_ID } = {}) {
  const groups = getDistrictGroups(assignments, districts);
  const { averagePopulation, minPopulation, maxPopulation } = getPopulationRange(districts.length);

  return districts.map((districtId) => {
    const areaIds = groups[districtId];
    const population = areaIds.reduce((sum, areaId) => sum + AREA_BY_ID[areaId].population, 0);
    const votes = sumVotes(areaIds, electionId);
    const totalVotes = votes.DEM + votes.PPP;
    const winner = totalVotes > 0 ? pickWinner(votes) : null;
    const winnerVoteShare = winner ? votes[winner] / totalVotes : 0;

    return {
      districtId,
      areaIds,
      areaNames: areaIds.map((areaId) => AREA_BY_ID[areaId].name),
      population,
      populationDeviation: averagePopulation ? (population - averagePopulation) / averagePopulation : 0,
      populationValid: population >= minPopulation && population <= maxPopulation,
      votes,
      totalVotes,
      winner,
      winnerVoteShare,
      isPacking: winnerVoteShare >= 0.75,
      contiguous: areaIds.length === 0 || isAreaSetContiguous(areaIds),
    };
  });
}

export function calculateSeats(assignments, options = {}) {
  return calculateDistrictResults(assignments, options).reduce(
    (seats, result) => {
      if (result.winner) seats[result.winner] += 1;
      return seats;
    },
    { DEM: 0, PPP: 0 },
  );
}

export function getExpectedSeats(districtCount = DISTRICTS.length, electionId = DEFAULT_ELECTION_DATASET_ID) {
  const totalVotes = getTotalVotes(electionId);
  const allVotes = PARTY_IDS.reduce((sum, partyId) => sum + totalVotes[partyId], 0);

  return Object.fromEntries(
    PARTY_IDS.map((partyId) => [partyId, allVotes ? (totalVotes[partyId] / allVotes) * districtCount : 0]),
  );
}

export function seatsMatchTarget(seats, targetSeats = {}) {
  return PARTY_IDS.every((partyId) => Number(seats[partyId] || 0) === Number(targetSeats[partyId] || 0));
}

function calculateFinalScore({ missionType, distortionScore, penalty, bonus, districtCount, canSubmit }) {
  if (!canSubmit) return 0;

  if (missionType === "max_proportionality") {
    return Number((Math.max(0, districtCount - distortionScore) + penalty + bonus).toFixed(2));
  }

  return Number((distortionScore + penalty + bonus).toFixed(2));
}

export function validatePlan(
  assignments,
  targetSeats,
  {
    districts = DISTRICTS,
    electionId = DEFAULT_ELECTION_DATASET_ID,
    missionType = DEFAULT_MISSION_TYPE,
  } = {},
) {
  const normalized = normalizeAssignments(assignments);
  const districtResults = calculateDistrictResults(normalized, { districts, electionId });
  const contiguity = checkContiguity(normalized, { districts });
  const unassignedAreaIds = SEJONG_AREAS.filter((area) => !normalized[area.id]).map((area) => area.id);
  const emptyDistricts = districtResults.filter((result) => result.areaIds.length === 0).map((result) => result.districtId);
  const populationViolations = districtResults.filter(
    (result) => result.areaIds.length > 0 && !result.populationValid,
  );
  const packingViolations = districtResults.filter((result) => result.isPacking);
  const seats = calculateSeats(normalized, { districts, electionId });
  const expectedSeats = getExpectedSeats(districts.length, electionId);
  const distortionByParty = Object.fromEntries(
    PARTY_IDS.map((partyId) => [partyId, seats[partyId] - expectedSeats[partyId]]),
  );
  const advantagedParty = PARTY_IDS.reduce((bestParty, partyId) => {
    return distortionByParty[partyId] > distortionByParty[bestParty] ? partyId : bestParty;
  }, PARTY_IDS[0]);
  const distortionScore = Math.max(...PARTY_IDS.map((partyId) => Math.abs(distortionByParty[partyId])));
  const proportionalityScore = Math.max(0, districts.length - distortionScore);
  const penalty = populationViolations.length * -2 + packingViolations.length * -1;
  const bonus = unassignedAreaIds.length === 0 && contiguity.isValid ? 1 : 0;
  const canSubmit = unassignedAreaIds.length === 0 && emptyDistricts.length === 0 && contiguity.isValid;
  const finalScore = calculateFinalScore({
    missionType,
    distortionScore,
    penalty,
    bonus,
    districtCount: districts.length,
    canSubmit,
  });
  const targetMatched = targetSeats ? seatsMatchTarget(seats, targetSeats) : false;
  const errors = [
    ...contiguity.errors,
    ...(unassignedAreaIds.length > 0 ? [`아직 배정하지 않은 읍·면·동이 ${unassignedAreaIds.length}곳 있습니다.`] : []),
    ...(emptyDistricts.length > 0 ? [`비어 있는 선거구가 ${emptyDistricts.length}개 있습니다.`] : []),
  ];

  return {
    canSubmit,
    missionSuccess: canSubmit && targetMatched,
    seats,
    expectedSeats,
    distortionByParty,
    distortionScore,
    proportionalityScore,
    advantagedParty,
    penalty,
    bonus,
    finalScore,
    districtResults,
    contiguity,
    populationViolations,
    packingViolations,
    unassignedAreaIds,
    emptyDistricts,
    errors,
  };
}
