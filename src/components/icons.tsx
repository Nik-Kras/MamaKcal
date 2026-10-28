import React from "react";
import Svg, { Circle, Path, Rect } from "react-native-svg";

type P = { size?: number; color?: string; width?: number };

const base = (size: number) => ({ width: size, height: size, viewBox: "0 0 24 24", fill: "none" as const });
const stroke = (color: string, width: number) => ({
  stroke: color,
  strokeWidth: width,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

export const CameraIcon = ({ size = 28, color = "#fff", width = 2 }: P) => (
  <Svg {...base(size)}>
    <Path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" {...stroke(color, width)} />
    <Circle cx={12} cy={13.5} r={3.5} {...stroke(color, width)} />
  </Svg>
);

export const CloseIcon = ({ size = 24, color = "#000", width = 2 }: P) => (
  <Svg {...base(size)}>
    <Path d="M6 6l12 12M18 6L6 18" {...stroke(color, width)} />
  </Svg>
);

export const BackIcon = ({ size = 28, color = "#000", width = 2 }: P) => (
  <Svg {...base(size)}>
    <Path d="M19 12H5M11 6l-6 6 6 6" {...stroke(color, width)} />
  </Svg>
);

export const ChevronDown = ({ size = 20, color = "#000", width = 2.2 }: P) => (
  <Svg {...base(size)}>
    <Path d="M6 9l6 6 6-6" {...stroke(color, width)} />
  </Svg>
);

export const PlusIcon = ({ size = 24, color = "#000", width = 2.4 }: P) => (
  <Svg {...base(size)}>
    <Path d="M12 5v14M5 12h14" {...stroke(color, width)} />
  </Svg>
);

export const MinusIcon = ({ size = 24, color = "#000", width = 2.4 }: P) => (
  <Svg {...base(size)}>
    <Path d="M5 12h14" {...stroke(color, width)} />
  </Svg>
);

export const CheckIcon = ({ size = 22, color = "#000", width = 2.4 }: P) => (
  <Svg {...base(size)}>
    <Path d="M5 12.5l4.5 4.5L19 7.5" {...stroke(color, width)} />
  </Svg>
);

export const GalleryIcon = ({ size = 26, color = "#fff", width = 1.8 }: P) => (
  <Svg {...base(size)}>
    <Rect x={3} y={4} width={18} height={16} rx={2} {...stroke(color, width)} />
    <Circle cx={9} cy={10} r={2} {...stroke(color, width)} />
    <Path d="M21 16l-5-5-9 9" {...stroke(color, width)} />
  </Svg>
);

export const PencilIcon = ({ size = 26, color = "#fff", width = 1.8 }: P) => (
  <Svg {...base(size)}>
    <Path d="M4 20h4L19 9l-4-4L4 16v4z" {...stroke(color, width)} />
    <Path d="M13 7l4 4" {...stroke(color, width)} />
  </Svg>
);

export const SearchIcon = ({ size = 22, color = "#000", width = 2 }: P) => (
  <Svg {...base(size)}>
    <Circle cx={11} cy={11} r={7} {...stroke(color, width)} />
    <Path d="M20 20l-4-4" {...stroke(color, width)} />
  </Svg>
);

export const TrashIcon = ({ size = 22, color = "#000", width = 1.8 }: P) => (
  <Svg {...base(size)}>
    <Path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" {...stroke(color, width)} />
  </Svg>
);

export const AlertIcon = ({ size = 40, color = "#000", width = 1.8 }: P) => (
  <Svg {...base(size)}>
    <Circle cx={12} cy={12} r={9} {...stroke(color, width)} />
    <Path d="M12 7.5v5.5M12 16.5v.01" {...stroke(color, width)} />
  </Svg>
);
