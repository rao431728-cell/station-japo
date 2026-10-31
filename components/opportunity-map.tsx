"use client";
import type { Navigate } from "./shared";
// Simplified longitude/latitude outlines; a geographic overview, not a boundary map.
const land = [
  [
    [-168, 65],
    [-140, 70],
    [-126, 56],
    [-125, 48],
    [-117, 32],
    [-98, 16],
    [-87, 20],
    [-80, 9],
    [-76, 22],
    [-81, 27],
    [-80, 34],
    [-67, 47],
    [-60, 54],
    [-78, 61],
    [-90, 72],
    [-115, 73],
    [-140, 70],
  ],
  [
    [-81, 11],
    [-69, 10],
    [-52, 2],
    [-35, -7],
    [-40, -22],
    [-53, -33],
    [-67, -55],
    [-75, -42],
    [-71, -18],
    [-81, -4],
  ],
  [
    [-53, 60],
    [-43, 61],
    [-20, 76],
    [-42, 83],
    [-61, 77],
  ],
  [
    [-10, 36],
    [-10, 43],
    [0, 49],
    [8, 55],
    [5, 60],
    [20, 71],
    [32, 70],
    [28, 59],
    [45, 55],
    [60, 58],
    [90, 75],
    [135, 70],
    [178, 65],
    [162, 54],
    [140, 50],
    [130, 32],
    [120, 20],
    [105, 10],
    [99, 6],
    [91, 22],
    [77, 7],
    [66, 25],
    [55, 25],
    [47, 13],
    [35, 30],
    [30, 41],
    [15, 40],
  ],
  [
    [-17, 35],
    [0, 37],
    [12, 33],
    [30, 31],
    [35, 22],
    [50, 12],
    [42, -2],
    [36, -20],
    [23, -35],
    [16, -30],
    [10, -5],
    [-3, 5],
    [-17, 15],
  ],
  [
    [112, -11],
    [130, -12],
    [140, -11],
    [154, -26],
    [145, -39],
    [129, -34],
    [115, -35],
  ],
  [
    [47, -13],
    [51, -16],
    [49, -25],
    [44, -24],
  ],
  [
    [166, -35],
    [178, -38],
    [170, -47],
  ],
  [
    [95, 5],
    [112, -2],
    [130, -4],
    [142, -7],
    [129, -10],
    [111, -7],
  ],
];
const project = (x: number, y: number) => [
  ((x + 180) / 360) * 800,
  ((85 - y) / 145) * 300,
];
export function OpportunityMap({ navigate }: { navigate: Navigate }) {
  return (
    <div className="world-map">
      <svg
        viewBox="0 0 800 310"
        role="img"
        aria-label="World map showing target pathways in Australia, UAE, Europe and Pakistan"
      >
        <defs>
          <pattern
            id="map-grid"
            width="24"
            height="24"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="1" cy="1" r=".65" fill="#536780" opacity=".3" />
          </pattern>
        </defs>
        <rect width="800" height="310" fill="url(#map-grid)" />
        {land.map((pts, i) => (
          <polygon
            key={i}
            points={pts.map(([x, y]) => project(x, y).join(",")).join(" ")}
            fill="#1d2b40"
            stroke="#354963"
            strokeWidth=".8"
          />
        ))}
        {[
          {
            name: "Australia",
            country: "Australia",
            x: 134,
            y: -25,
            labelY: 28,
          },
          { name: "UAE", country: "UAE", x: 54, y: 24, labelY: 24 },
          { name: "Europe", country: "Europe", x: 12, y: 49, labelY: -16 },
          { name: "Pakistan", country: "Pakistan", x: 70, y: 31, labelY: -17 },
        ].map(({ name, country, x, y, labelY }) => {
          const [cx, cy] = project(x, y);
          return (
            <g
              key={name}
              role="button"
              tabIndex={0}
              aria-label={"Explore " + name + " contacts"}
              onClick={() => navigate("Contacts", country)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  navigate("Contacts", country);
                }
              }}
              style={{ cursor: "pointer" }}
            >
              <circle cx={cx} cy={cy} r="11" fill="#4e82e7" opacity=".15" />
              <circle
                cx={cx}
                cy={cy}
                r="4"
                fill={name === "Pakistan" ? "#68d2ad" : "#8bb6ff"}
              />
              <text
                x={cx}
                y={cy + labelY}
                textAnchor="middle"
                fontSize="12"
                fill="#b0c9ed"
              >
                {name}
              </text>
            </g>
          );
        })}
      </svg>
      <small>Simplified geographic overview · Select a pathway</small>
    </div>
  );
}
