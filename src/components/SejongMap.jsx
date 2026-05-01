import React, { useEffect, useMemo, useRef, useState } from "react";
import { AREA_BY_ID, DEFAULT_ELECTION_DATASET_ID, DISTRICT_THEME, getAreaVotes } from "../data/gerrymandering";
import sejongBoundaries from "../data/sejongBoundaries";

const VIEWBOX = { width: 900, height: 1120, padding: 34 };
const MIN_ZOOM = 1;
const MAX_ZOOM = 3.2;
const ZOOM_STEP = 0.4;
const NEAR_HAPPY_CITY = new Set(["연기면", "연동면", "금남면", "장군면", "부강면"]);
const OVERVIEW_NAMES = new Set([
  "소정면",
  "전의면",
  "전동면",
  "연서면",
  "조치원읍",
  "연동면",
  "장군면",
  "연기면",
  "금남면",
  "부강면",
]);
const LABEL_OFFSETS = {
  소정면: { x: 0, y: -15 },
  전의면: { x: -50, y: 0 },
  금남면: { x: 0, y: 30 },
};
const CALLOUT_SIZE = { width: 112, height: 76 };
const OVERVIEW_CALLOUT_OFFSETS = {
  소정면: { x: 74, y: -50 },
  전의면: { x: -134, y: -8 },
  전동면: { x: 82, y: -18 },
  연서면: { x: 76, y: -4 },
  조치원읍: { x: 96, y: -26 },
  연동면: { x: 96, y: -8 },
  장군면: { x: -86, y: 24 },
  연기면: { x: -66, y: -48 },
  금남면: { x: 78, y: 90 },
  부강면: { x: 88, y: -32 },
};
const OVERVIEW_CALLOUT_ANCHOR_OFFSETS = {
  소정면: { x: -4, y: -24 },
  전의면: { x: -34, y: -42 },
  금남면: { x: 0, y: 30 },
};
const HAPPY_CALLOUT_OFFSETS = {
  yeongi: { x: -184, y: -140 },
  yeondong: { x: 120, y: -129 },
  bugang: { x: 93, y: -54 },
  janggun: { x: -132, y: -7 },
  goun: { x: -183, y: -109 },
  areum: { x: -209, y: -18 },
  haemil: { x: -97, y: -198 },
  dodam: { x: 56, y: -231 },
  jongchon: { x: -204, y: 35 },
  dajeong: { x: -194, y: 99 },
  saerom: { x: -178, y: 164 },
  hansol: { x: -143, y: 233 },
  eojin: { x: 178, y: -258 },
  naseong: { x: 143, y: 53 },
  daepyeong: { x: 3, y: 255 },
  boram: { x: 120, y: 271 },
  sodam: { x: 302, y: 125 },
  bangok: { x: 287, y: 12 },
  geumnam: { x: 122, y: 252 },
};

function featureRings(feature) {
  if (!feature.geometry) return [];
  if (feature.geometry.type === "Polygon") return feature.geometry.coordinates;
  if (feature.geometry.type === "MultiPolygon") return feature.geometry.coordinates.flat();
  return [];
}

function collectPoints(features) {
  return features.flatMap((feature) => featureRings(feature).flat());
}

function getBounds(features) {
  const points = collectPoints(features);
  return points.reduce(
    (bounds, [x, y]) => ({
      minX: Math.min(bounds.minX, x),
      maxX: Math.max(bounds.maxX, x),
      minY: Math.min(bounds.minY, y),
      maxY: Math.max(bounds.maxY, y),
    }),
    { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity },
  );
}

function createProjector(bounds, offset = { x: 0, y: 0 }, padding = VIEWBOX.padding) {
  const availableWidth = VIEWBOX.width - padding * 2;
  const availableHeight = VIEWBOX.height - padding * 2;
  const scale = Math.min(availableWidth / (bounds.maxX - bounds.minX), availableHeight / (bounds.maxY - bounds.minY));
  const drawnWidth = (bounds.maxX - bounds.minX) * scale;
  const drawnHeight = (bounds.maxY - bounds.minY) * scale;
  const offsetX = (VIEWBOX.width - drawnWidth) / 2;
  const offsetY = (VIEWBOX.height - drawnHeight) / 2;

  return ([x, y]) => [offsetX + (x - bounds.minX) * scale + offset.x, offsetY + (bounds.maxY - y) * scale + offset.y];
}

function ringToPath(ring, project) {
  return ring
    .map((point, index) => {
      const [x, y] = project(point);
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ")
    .concat(" Z");
}

function featureToPath(feature, project) {
  return featureRings(feature).map((ring) => ringToPath(ring, project)).join(" ");
}

function centerOfFeature(feature, project) {
  const bounds = getBounds([feature]);
  return project([(bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2]);
}

function centerOfFeatures(features, project) {
  const bounds = getBounds(features);
  return project([(bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2]);
}

function applyLabelOffset(label, point) {
  const offset = LABEL_OFFSETS[label] || { x: 0, y: 0 };
  return [point[0] + offset.x, point[1] + offset.y];
}

function formatMapNumber(value) {
  return Math.round(value).toLocaleString("ko-KR");
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function clampPan(pan, zoom) {
  const maxX = (VIEWBOX.width - VIEWBOX.width / zoom) / 2;
  const maxY = (VIEWBOX.height - VIEWBOX.height / zoom) / 2;
  return {
    x: clamp(pan.x, -maxX, maxX),
    y: clamp(pan.y, -maxY, maxY),
  };
}

function getZoomedViewBox(zoom, pan) {
  const boundedPan = clampPan(pan, zoom);
  const width = VIEWBOX.width / zoom;
  const height = VIEWBOX.height / zoom;
  const x = VIEWBOX.width / 2 + boundedPan.x - width / 2;
  const y = VIEWBOX.height / 2 + boundedPan.y - height / 2;

  return `${x.toFixed(1)} ${y.toFixed(1)} ${width.toFixed(1)} ${height.toFixed(1)}`;
}

function getViewBoxState(zoom, pan) {
  const boundedPan = clampPan(pan, zoom);
  const width = VIEWBOX.width / zoom;
  const height = VIEWBOX.height / zoom;
  const x = VIEWBOX.width / 2 + boundedPan.x - width / 2;
  const y = VIEWBOX.height / 2 + boundedPan.y - height / 2;

  return { x, y, width, height };
}

function getCalloutBox(anchor, featureName, mode, mapCenter, featureKey = featureName) {
  const staticOffset =
    mode === "overview" ? OVERVIEW_CALLOUT_OFFSETS[featureName] : HAPPY_CALLOUT_OFFSETS[featureKey];
  const dynamicOffset = staticOffset || {
    x: anchor[0] >= mapCenter[0] ? 82 : -82,
    y: anchor[1] >= mapCenter[1] ? 58 : -58,
  };
  const center = [
    clamp(anchor[0] + dynamicOffset.x, CALLOUT_SIZE.width / 2 + 8, VIEWBOX.width - CALLOUT_SIZE.width / 2 - 8),
    clamp(anchor[1] + dynamicOffset.y, CALLOUT_SIZE.height / 2 + 8, VIEWBOX.height - CALLOUT_SIZE.height / 2 - 8),
  ];

  return {
    x: center[0] - CALLOUT_SIZE.width / 2,
    y: center[1] - CALLOUT_SIZE.height / 2,
    center,
  };
}

function getCalloutAnchor(baseAnchor, featureName, mode) {
  const offset = mode === "overview" ? OVERVIEW_CALLOUT_ANCHOR_OFFSETS[featureName] : null;
  if (!offset) return baseAnchor;

  return [baseAnchor[0] + offset.x, baseAnchor[1] + offset.y];
}

function sumFeatureVotes(features, electionDatasetId) {
  return features.reduce(
    (sum, feature) => {
      const areaId = feature.properties.gameAreaId;
      if (!areaId) return sum;
      const votes = getAreaVotes(areaId, electionDatasetId);
      return {
        DEM: sum.DEM + votes.DEM,
        PPP: sum.PPP + votes.PPP,
      };
    },
    { DEM: 0, PPP: 0 },
  );
}

function getDistrictStyle(feature, assignments, selectedAreaIds, selectableAreaIds) {
  const areaId = feature.properties.gameAreaId;
  const districtId = areaId ? assignments?.[areaId] : null;
  const district = districtId ? DISTRICT_THEME[districtId] : null;
  const isSelected = areaId ? selectedAreaIds?.includes(areaId) : false;
  const isSelectable = areaId ? selectableAreaIds?.includes(areaId) : false;
  const isSelectionInProgress = selectedAreaIds?.length > 0;

  if (district) {
    return {
      fill: district.soft,
      stroke: district.color,
      strokeWidth: 2.4,
      opacity: 0.95,
    };
  }

  if (isSelected) {
    return {
      fill: "#D9F7E8",
      stroke: "#16844A",
      strokeWidth: 3.6,
      opacity: 1,
    };
  }

  if (isSelectionInProgress && isSelectable) {
    return {
      fill: "#FFFFFF",
      stroke: "#1B6BFF",
      strokeWidth: 2.4,
      opacity: 1,
    };
  }

  if (feature.properties.isHappyCity) {
    return {
      fill: "#DFF4FF",
      stroke: "#5A8DA8",
      strokeWidth: 1.5,
      opacity: 0.95,
    };
  }

  return {
    fill: isSelectable ? "#FFFFFF" : "#F3F5F7",
    stroke: "#535A60",
    strokeWidth: 1.6,
    opacity: isSelectable ? 1 : 0.82,
  };
}

function Label({ x, y, children, size = 24, strong = false }) {
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      dominantBaseline="middle"
      className="pointer-events-none select-none"
      style={{
        fill: strong ? "#0F2C4D" : "#18212A",
        fontSize: size,
        fontWeight: 900,
        paintOrder: "stroke",
        stroke: "white",
        strokeWidth: strong ? 8 : 6,
        strokeLinejoin: "round",
      }}
    >
      {children}
    </text>
  );
}

function VoteCallout({ anchor, box, label, votes }) {
  const total = votes.DEM + votes.PPP;

  return (
    <g className="pointer-events-none select-none" style={{ userSelect: "none", WebkitUserSelect: "none" }}>
      <line
        x1={anchor[0]}
        y1={anchor[1]}
        x2={box.center[0]}
        y2={box.center[1]}
        stroke="#111827"
        strokeWidth="2.67"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle
        cx={anchor[0]}
        cy={anchor[1]}
        r="5"
        fill="#FFFFFF"
        stroke="#111827"
        strokeWidth="2.67"
        vectorEffect="non-scaling-stroke"
      />
      <rect
        x={box.x}
        y={box.y}
        width={CALLOUT_SIZE.width}
        height={CALLOUT_SIZE.height}
        rx="8"
        fill="#FFFFFF"
        stroke="#D7DEE8"
        strokeWidth="1.5"
        filter="url(#vote-card-shadow)"
      />
      <text x={box.x + 10} y={box.y + 19} style={{ fill: "#111827", fontSize: 13, fontWeight: 900 }}>
        {label}
      </text>
      <text x={box.x + 10} y={box.y + 37} style={{ fill: "#1B6BFF", fontSize: 12, fontWeight: 800 }}>
        민주: {formatMapNumber(votes.DEM)}
      </text>
      <text x={box.x + 10} y={box.y + 53} style={{ fill: "#E34848", fontSize: 12, fontWeight: 800 }}>
        국힘: {formatMapNumber(votes.PPP)}
      </text>
      <text x={box.x + 10} y={box.y + 68} style={{ fill: "#475569", fontSize: 12, fontWeight: 800 }}>
        계: {formatMapNumber(total)}
      </text>
    </g>
  );
}

export default function SejongMap({
  assignments = {},
  selectedAreaIds = [],
  selectableAreaIds = [],
  electionDatasetId = DEFAULT_ELECTION_DATASET_ID,
  showVoteCallouts,
  onToggleArea,
  compact = false,
}) {
  const [mode, setMode] = useState("overview");
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState(null);
  const mapRef = useRef(null);
  const dragMovedRef = useRef(false);

  const visibleFeatures = useMemo(() => {
    if (mode === "happy") {
      return sejongBoundaries.features.filter(
        (feature) => feature.properties.isHappyCity || NEAR_HAPPY_CITY.has(feature.properties.name),
      );
    }
    return sejongBoundaries.features;
  }, [mode]);

  const project = useMemo(
    () =>
      createProjector(
        getBounds(visibleFeatures),
        mode === "overview" ? { x: 0, y: 34 } : { x: 0, y: -120 },
        mode === "happy" ? 128 : VIEWBOX.padding,
      ),
    [mode, visibleFeatures],
  );
  const svgViewBox = useMemo(() => getZoomedViewBox(zoom, pan), [pan, zoom]);
  const happyFeatures = useMemo(
    () => visibleFeatures.filter((feature) => feature.properties.isHappyCity),
    [visibleFeatures],
  );

  const overviewLabels = useMemo(() => {
    const labels = sejongBoundaries.features
      .filter((feature) => OVERVIEW_NAMES.has(feature.properties.name))
      .map((feature) => {
        const label = feature.properties.name;
        return { key: feature.id, label, point: applyLabelOffset(label, centerOfFeature(feature, project)) };
      });

    if (mode === "overview" && happyFeatures.length > 0) {
      labels.push({ key: "happy-city", label: "행복도시", point: centerOfFeatures(happyFeatures, project), strong: true });
    }

    return labels;
  }, [happyFeatures, mode, project]);

  const detailLabels = useMemo(
    () =>
      visibleFeatures.map((feature) => ({
        key: feature.id,
        label: feature.properties.name,
        point: applyLabelOffset(feature.properties.name, centerOfFeature(feature, project)),
        strong: feature.properties.isHappyCity,
      })),
    [project, visibleFeatures],
  );
  const shouldShowVoteCallouts = showVoteCallouts ?? !compact;

  const voteCallouts = useMemo(() => {
    if (!shouldShowVoteCallouts) return [];

    const bounds = getBounds(visibleFeatures);
    const mapCenter = project([(bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2]);
    const calloutFeatures =
      mode === "overview"
        ? visibleFeatures.filter((feature) => feature.properties.gameAreaId && !feature.properties.isHappyCity)
        : visibleFeatures.filter((feature) => feature.properties.gameAreaId);

    const callouts = calloutFeatures.map((feature) => {
      const baseAnchor = centerOfFeature(feature, project);
      const label = feature.properties.name;
      return {
        key: feature.id,
        label,
        anchor: getCalloutAnchor(baseAnchor, label, mode),
        box: getCalloutBox(baseAnchor, label, mode, mapCenter, feature.properties.gameAreaId),
        votes: getAreaVotes(feature.properties.gameAreaId, electionDatasetId),
      };
    });

    if (mode === "overview" && happyFeatures.length > 0) {
      const anchor = centerOfFeatures(happyFeatures, project);
      callouts.push({
        key: "happy-city-votes",
        label: "행복도시",
        anchor,
        box: getCalloutBox(anchor, "행복도시", mode, mapCenter),
        votes: sumFeatureVotes(happyFeatures, electionDatasetId),
      });
    }

    return callouts;
  }, [electionDatasetId, happyFeatures, mode, project, shouldShowVoteCallouts, visibleFeatures]);

  useEffect(() => {
    setZoom(MIN_ZOOM);
    setPan({ x: 0, y: 0 });
    setDragStart(null);
    dragMovedRef.current = false;
  }, [mode]);

  useEffect(() => {
    const node = mapRef.current;
    if (!node) return undefined;

    function handleNativeWheel(event) {
      event.preventDefault();
      event.stopPropagation();
      handleWheelZoom(event);
    }

    node.addEventListener("wheel", handleNativeWheel, { passive: false });
    return () => node.removeEventListener("wheel", handleNativeWheel);
  }, [pan, zoom]);

  function setBoundedZoom(nextZoom) {
    const boundedZoom = clamp(Number(nextZoom.toFixed(2)), MIN_ZOOM, MAX_ZOOM);
    setZoom(boundedZoom);
    setPan((current) => (boundedZoom === MIN_ZOOM ? { x: 0, y: 0 } : clampPan(current, boundedZoom)));
  }

  function zoomIn() {
    setBoundedZoom(zoom + ZOOM_STEP);
  }

  function zoomOut() {
    setBoundedZoom(zoom - ZOOM_STEP);
  }

  function resetZoom() {
    setZoom(MIN_ZOOM);
    setPan({ x: 0, y: 0 });
    setDragStart(null);
  }

  function handlePointerDown(event) {
    if (event.button !== 0) return;
    if (zoom <= MIN_ZOOM) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragMovedRef.current = false;
    setDragStart({
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      pan,
    });
  }

  function handlePointerMove(event) {
    if (!dragStart || !mapRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    const visibleWidth = VIEWBOX.width / zoom;
    const visibleHeight = VIEWBOX.height / zoom;
    const dx = event.clientX - dragStart.clientX;
    const dy = event.clientY - dragStart.clientY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragMovedRef.current = true;
    const nextPan = {
      x: dragStart.pan.x - dx * (visibleWidth / mapRef.current.clientWidth),
      y: dragStart.pan.y - dy * (visibleHeight / mapRef.current.clientHeight),
    };
    setPan(clampPan(nextPan, zoom));
  }

  function handlePointerUp(event) {
    if (dragStart) {
      event.preventDefault();
      event.stopPropagation();
    }
    try {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    } catch {
      // Pointer capture can already be released by the browser when the pointer leaves the SVG.
    }
    setDragStart(null);
  }

  function handleWheelZoom(event) {
    if (!mapRef.current) return;

    const rect = mapRef.current.getBoundingClientRect();
    const focusX = (event.clientX - rect.left) / rect.width;
    const focusY = (event.clientY - rect.top) / rect.height;
    const currentViewBox = getViewBoxState(zoom, pan);
    const anchorX = currentViewBox.x + focusX * currentViewBox.width;
    const anchorY = currentViewBox.y + focusY * currentViewBox.height;
    const direction = event.deltaY < 0 ? 1 : -1;
    const nextZoom = clamp(Number((zoom * (direction > 0 ? 1.14 : 0.88)).toFixed(2)), MIN_ZOOM, MAX_ZOOM);

    if (nextZoom === zoom) return;

    const nextWidth = VIEWBOX.width / nextZoom;
    const nextHeight = VIEWBOX.height / nextZoom;
    const nextX = anchorX - focusX * nextWidth;
    const nextY = anchorY - focusY * nextHeight;
    const nextPan = {
      x: nextX + nextWidth / 2 - VIEWBOX.width / 2,
      y: nextY + nextHeight / 2 - VIEWBOX.height / 2,
    };

    setZoom(nextZoom);
    setPan(nextZoom === MIN_ZOOM ? { x: 0, y: 0 } : clampPan(nextPan, nextZoom));
    setDragStart(null);
  }

  function handleClick(feature) {
    if (dragMovedRef.current) {
      dragMovedRef.current = false;
      return;
    }

    const areaId = feature.properties.gameAreaId;
    if (mode === "overview" && feature.properties.isHappyCity) {
      setMode("happy");
      return;
    }
    if (areaId && onToggleArea) onToggleArea(areaId);
  }

  const mapHeightClass = compact ? "h-[360px]" : mode === "happy" ? "h-[920px]" : "h-[760px]";
  const minHeightClass = compact ? "min-h-[280px]" : mode === "happy" ? "min-h-[820px]" : "min-h-[660px]";

  return (
    <div className={`relative w-full overflow-hidden rounded-xl bg-white ${minHeightClass}`}>
      <div className="absolute left-3 top-3 z-10 flex gap-2">
        <button
          type="button"
          onClick={() => setMode("overview")}
          className={`rounded-lg border px-3 py-2 text-sm font-black shadow-sm ${
            mode === "overview" ? "border-[var(--color-brand)] bg-white text-[var(--color-brand)]" : "border-slate-200 bg-white"
          }`}
        >
          전체
        </button>
        <button
          type="button"
          onClick={() => setMode("happy")}
          className={`rounded-lg border px-3 py-2 text-sm font-black shadow-sm ${
            mode === "happy" ? "border-[var(--color-brand)] bg-white text-[var(--color-brand)]" : "border-slate-200 bg-white"
          }`}
        >
          행복도시 확대
        </button>
      </div>

      <div className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-lg bg-white/95 p-1 shadow-sm ring-1 ring-slate-200">
        <button
          type="button"
          onClick={zoomOut}
          disabled={zoom <= MIN_ZOOM}
          aria-label="지도 축소"
          title="지도 축소"
          className="flex h-9 w-9 items-center justify-center rounded-md text-xl font-black text-slate-700 disabled:opacity-35"
        >
          -
        </button>
        <button
          type="button"
          onClick={resetZoom}
          disabled={zoom <= MIN_ZOOM && pan.x === 0 && pan.y === 0}
          aria-label="지도 보기 초기화"
          title="지도 보기 초기화"
          className="flex h-9 min-w-12 items-center justify-center rounded-md px-2 text-xs font-black text-slate-600 disabled:opacity-35"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          onClick={zoomIn}
          disabled={zoom >= MAX_ZOOM}
          aria-label="지도 확대"
          title="지도 확대"
          className="flex h-9 w-9 items-center justify-center rounded-md text-xl font-black text-slate-700 disabled:opacity-35"
        >
          +
        </button>
      </div>

      <svg
        ref={mapRef}
        viewBox={svgViewBox}
        role="img"
        aria-label="세종특별자치시 읍면동 행정경계 지도"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{ userSelect: "none", WebkitUserSelect: "none" }}
        className={`block w-full select-none ${mapHeightClass} touch-none ${
          zoom > MIN_ZOOM ? (dragStart ? "cursor-grabbing" : "cursor-grab") : ""
        }`}
      >
        <defs>
          <filter id="vote-card-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#0F172A" floodOpacity="0.18" />
          </filter>
        </defs>
        <rect width={VIEWBOX.width} height={VIEWBOX.height} fill="#F8FAFC" />
        <g>
          {visibleFeatures.map((feature) => {
            const style = getDistrictStyle(feature, assignments, selectedAreaIds, selectableAreaIds);
            const areaId = feature.properties.gameAreaId;
            const disabled = onToggleArea && areaId && assignments?.[areaId] && !selectedAreaIds.includes(areaId);

            return (
              <path
                key={feature.id}
                d={featureToPath(feature, project)}
                fill={style.fill}
                stroke={style.stroke}
                strokeWidth={style.strokeWidth}
                opacity={disabled ? 0.62 : style.opacity}
                vectorEffect="non-scaling-stroke"
                className={onToggleArea || feature.properties.isHappyCity ? "cursor-pointer transition-opacity hover:opacity-80" : ""}
                onClick={() => handleClick(feature)}
              >
                <title>
                  {feature.properties.name}
                  {areaId && AREA_BY_ID[areaId] ? ` / ${AREA_BY_ID[areaId].population.toLocaleString("ko-KR")}명` : ""}
                </title>
              </path>
            );
          })}
        </g>

        {shouldShowVoteCallouts
          ? voteCallouts.map(({ key, ...callout }) => <VoteCallout key={key} {...callout} />)
          : (mode === "overview" ? overviewLabels : detailLabels).map(({ key, label, point, strong }) => (
              <Label key={key} x={point[0]} y={point[1]} size={mode === "overview" ? (strong ? 34 : 24) : strong ? 18 : 16} strong={strong}>
                {label}
              </Label>
            ))}
      </svg>
    </div>
  );
}
