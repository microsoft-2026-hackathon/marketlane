import { useId } from "react";
import type { ProductShape, ProductTone } from "../../../shared/contracts.js";

const tones: Record<ProductTone, { base: string; light: string; dark: string; background: string }> = {
  sage: { base: "#819581", light: "#b7c4ac", dark: "#425c48", background: "#e9ede3" },
  clay: { base: "#bd7d61", light: "#d8a58a", dark: "#814c37", background: "#f2e5da" },
  ink: { base: "#434e53", light: "#7b8789", dark: "#252f35", background: "#e5e9e8" },
  sand: { base: "#c7ac79", light: "#e4cda2", dark: "#8f774d", background: "#f0eadc" },
  sky: { base: "#7c9fa9", light: "#b0c8ce", dark: "#496f7a", background: "#e4edef" },
};

export function ProductArt({ shape, tone, className = "" }: {
  shape: ProductShape;
  tone: ProductTone;
  className?: string;
}) {
  const id = useId().replaceAll(":", "");
  const color = tones[tone];
  const gradient = `product-${id}`;
  return (
    <svg viewBox="0 0 360 280" className={`product-art ${className}`} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={color.light} />
          <stop offset="1" stopColor={color.base} />
        </linearGradient>
      </defs>
      <rect width="360" height="280" fill={color.background} />
      <circle cx="282" cy="48" r="106" fill="#fff" opacity=".2" />
      <path d="M0 235h360" stroke={color.dark} strokeOpacity=".06" />
      <ellipse cx="183" cy="230" rx="94" ry="10" fill={color.dark} opacity=".1" />
      {shape === "lamp" && <g>
        <ellipse cx="174" cy="219" rx="64" ry="12" fill={color.dark} />
        <path d="M111 214q63-17 126 0v5q-62 15-126 0v-5Z" fill={`url(#${gradient})`} />
        <path d="M172 209V102q0-42 43-42h20" fill="none" stroke={color.dark} strokeWidth="9" />
        <path d="M168 206V102q0-40 43-40h24" fill="none" stroke={color.base} strokeWidth="7" />
        <path d="M198 93q2-41 34-42 34 2 38 42Z" fill={`url(#${gradient})`} />
        <ellipse cx="234" cy="93" rx="36" ry="8" fill={color.dark} />
        <ellipse cx="234" cy="93" rx="28" ry="5" fill="#fff1ce" />
        <path d="m212 105-33 64h105l-33-64" fill="#fff8d7" opacity=".22" />
        <path d="M211 69q9-14 21-14" fill="none" stroke="#fff" strokeWidth="3" opacity=".36" />
        <circle cx="193" cy="215" r="3" fill={color.dark} />
      </g>}
      {shape === "mat" && <g>
        <path d="m64 121 171-20 65 93q5 9-6 12l-178 20q-9 1-13-5l-49-85q-6-12 10-15Z" fill={color.dark} />
        <path d="m65 117 170-20 64 94q4 7-7 9l-178 20q-9 1-12-5l-47-84q-5-12 8-14Z" fill={`url(#${gradient})`} />
        <path d="m68 126 162-19 60 85-174 19-48-85Z" fill="none" stroke={color.dark} strokeOpacity=".28" strokeDasharray="3 3" />
        <path d="m114 143 78-9 18 32-78 9-18-32Z" fill="#f6f4e9" />
        <path d="m125 148 62-7m-56 14 61-7m-58 14 47-5" stroke="#c9cbbf" strokeWidth="4" strokeDasharray="5 3" />
        <path d="m223 151 17-2q11 3 13 16l-27 3q-8-8-3-17Z" fill="#f6f4e9" />
        <path d="m235 152 2 7" stroke="#c4c8bb" strokeWidth="2" />
      </g>}
      {shape === "notebook" && <g transform="rotate(-13 180 142)">
        <path d="M107 63h135v165H107q-9 0-9-9V73q0-10 9-10Z" fill={color.dark} />
        <path d="M112 62h124v157H112q-7 0-7-7V70q0-8 7-8Z" fill="#fff9e9" />
        <path d="M113 55h128v158H113q-13 0-13-10V66q0-11 13-11Z" fill={`url(#${gradient})`} />
        <path d="M115 56v156" stroke={color.dark} strokeOpacity=".35" strokeWidth="2" />
        <path d="M224 55v159" stroke={color.dark} strokeWidth="6" opacity=".6" />
        <path d="M161 118h34M165 125h26" stroke={color.dark} strokeOpacity=".65" strokeWidth="1.5" />
        <rect x="153" y="105" width="50" height="31" rx="2" fill="none" stroke={color.dark} strokeOpacity=".35" />
        <path d="M187 215v20l6-5 6 5v-20" fill={color.dark} />
        <path d="M116 222h120" stroke="#c8c3b5" />
      </g>}
      {shape === "bottle" && <g>
        <path d="M157 56h46v33q0 12 12 20l3 108q0 14-38 14t-38-14l3-108q12-8 12-20V56Z" fill={`url(#${gradient})`} />
        <ellipse cx="180" cy="216" rx="38" ry="11" fill={color.base} />
        <rect x="153" y="46" width="54" height="25" rx="8" fill={color.dark} />
        <ellipse cx="180" cy="48" rx="25" ry="5" fill={color.light} />
        <path d="M163 62h34M163 66h34" stroke="#fff" strokeOpacity=".13" />
        <path d="M160 116v83" stroke="#fff" strokeOpacity=".27" strokeWidth="7" strokeLinecap="round" />
        <path d="M173 163v-15l7 8 7-8v15" fill="none" stroke={color.dark} strokeWidth="2" opacity=".6" />
        <path d="M207 61q19 0 17 17t-16 9" fill="none" stroke={color.dark} strokeWidth="5" />
      </g>}
      {shape === "stand" && <g>
        <path d="m143 115 50 2 27 98-81 7 4-107Z" fill={color.dark} />
        <path d="m155 119 32 1 20 88-60 6 8-95Z" fill={`url(#${gradient})`} />
        <path d="m109 211 127-10 18 16q3 7-7 8l-130 10q-8 1-12-6l-8-9 12-9Z" fill={color.base} />
        <path d="m89 81 151-20 35 95q2 7-7 9l-149 20q-8 1-11-7L78 94q-4-10 11-13Z" fill={color.dark} />
        <path d="m91 76 149-20 31 94-153 21-39-81q-4-10 12-14Z" fill={`url(#${gradient})`} />
        <path d="m111 169 156-21 4 6-156 23-4-8Z" fill={color.light} />
        <path d="m121 104 82-11M130 123l81-11" stroke={color.dark} strokeOpacity=".26" strokeWidth="5" strokeLinecap="round" />
      </g>}
      {shape === "bag" && <g>
        <path d="M132 102V82q0-42 48-42t48 42v20" fill="none" stroke={color.dark} strokeWidth="11" />
        <path d="M134 102V83q0-39 46-39t46 39v19" fill="none" stroke={color.base} strokeWidth="6" />
        <path d="M109 94h144l12 127q-81 24-167 0l11-127Z" fill={color.dark} />
        <path d="M111 91h139l-1 127q-69 21-148 0l10-127Z" fill={`url(#${gradient})`} />
        <path d="M115 101h129M109 210q68 21 133 0" fill="none" stroke={color.dark} strokeOpacity=".3" strokeDasharray="3 3" />
        <path d="M134 92v43M225 92v43" stroke={color.dark} strokeWidth="9" />
        <rect x="149" y="145" width="49" height="36" rx="2" fill="#f4ecdc" />
        <path d="M161 169v-13l12 10 12-10v13" fill="none" stroke={color.dark} strokeWidth="2" />
        <path d="M250 96v121l13 4" fill="none" stroke={color.light} strokeWidth="2" />
      </g>}
      {shape === "pen" && <g transform="rotate(33 180 140)">
        <path d="m161 63 9-17 9 17v138l-9 29-9-29V63Z" fill={color.dark} />
        <rect x="159" y="66" width="22" height="132" rx="4" fill={`url(#${gradient})`} />
        <path d="M164 75v111" stroke="#fff" strokeOpacity=".32" strokeWidth="3" />
        <path d="M180 76h6v55q0 5-5 5" fill="none" stroke={color.dark} strokeWidth="3" />
        <path d="m162 199 8 27 8-27" fill="#b2a58d" />
        <path d="m168 221 2 9 2-9" fill={color.dark} />
        <path d="M161 71h18M161 190h18" stroke={color.dark} strokeWidth="3" />
        <path d="M204 79v126l8 24 8-24V79Z" fill="#cab898" />
        <path d="M207 79v125M217 79v125" stroke="#eadfc9" strokeWidth="2" />
        <path d="m210 223 2 6 2-6" fill={color.dark} />
        <rect x="204" y="64" width="16" height="16" rx="3" fill={color.base} />
      </g>}
      {shape === "tray" && <g>
        <path d="m82 111 141-18q11-1 18 8l49 74q7 10 0 21l-9 11-152 20q-11 1-18-9l-41-72q-8-13 0-24l12-11Z" fill={color.dark} />
        <path d="m87 105 139-18q11-1 18 8l48 75q8 12-7 15l-153 21q-10 1-16-9l-39-70q-8-13 10-22Z" fill={`url(#${gradient})`} />
        <path d="m99 120 126-17 45 68-137 19-34-70Z" fill={color.dark} opacity=".2" />
        <path d="m106 128 118-16 39 55-128 17-29-56Z" fill={color.base} />
        <path d="m122 133 50-7 18 28-52 7-16-28Z" fill="#f4eddb" />
        <circle cx="218" cy="154" r="12" fill="none" stroke="#d9c797" strokeWidth="4" />
        <path d="m210 147-11-10m1 1-5 4m9 0-5 5" stroke="#d9c797" strokeWidth="4" />
        <path d="m134 210 147-20" stroke={color.light} strokeOpacity=".4" strokeWidth="2" />
      </g>}
    </svg>
  );
}

export function WorkspaceScene() {
  return (
    <svg viewBox="0 0 440 300" className="workspace-scene" aria-hidden="true" focusable="false">
      <circle cx="276" cy="137" r="120" fill="#dce4d2" />
      <path d="M62 237h320M101 237l-11 48m250-48 11 48" stroke="#35523d" strokeWidth="4" strokeLinecap="round" />
      <path d="M78 227h291v10H78z" fill="#b99268" />
      <path d="M294 223V100q0-44 38-44" fill="none" stroke="#35523d" strokeWidth="7" />
      <path d="M302 90q2-43 30-43 27 0 32 43z" fill="#799078" />
      <ellipse cx="333" cy="90" rx="31" ry="6" fill="#efe3b9" />
      <ellipse cx="295" cy="223" rx="34" ry="5" fill="#35523d" />
      <path d="m125 150 104-13 20 72-103 13-21-72Z" fill="#35523d" />
      <path d="m133 155 90-12 16 60-89 12-17-60Z" fill="#edf0e2" />
      <path d="m144 223 105-14 23 13-112 3-16-2Z" fill="#81977d" />
      <path d="M169 173h34m-30 9h21" stroke="#b4c3a9" strokeWidth="4" strokeLinecap="round" />
      <rect x="97" y="185" width="27" height="39" rx="4" fill="#c8916e" />
      <path d="M123 191h5q15 13 0 25h-5" fill="none" stroke="#c8916e" strokeWidth="5" />
      <path d="M105 174q-6-9 1-16m9 15q-6-9 1-16" fill="none" stroke="#95a489" strokeWidth="2" strokeLinecap="round" />
      <path d="M309 199h36v24h-36z" fill="#e1bf86" />
      <path d="M326 201v-52m0 35q-27-6-25-26 25 0 25 26m0-14q21-6 23-24-25 0-23 24" fill="#617c58" stroke="#617c58" strokeWidth="2" />
      <path d="M69 114h38m-19-19v38" stroke="#b0bd9e" strokeWidth="2" />
      <circle cx="202" cy="57" r="4" fill="#b0bd9e" />
      <path d="M379 169h16m-8-8v16" stroke="#b0bd9e" strokeWidth="2" />
    </svg>
  );
}
