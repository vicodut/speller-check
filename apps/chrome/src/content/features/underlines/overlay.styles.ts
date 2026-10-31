/** A wavy line drawn as a mask, so it takes the segment's background colour. */
const WAVE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='6' height='3'%3E" +
  "%3Cpath d='M0 2.5 Q1.5 0 3 1.5 T6 0.5' fill='none' stroke='black' stroke-width='1.2'/%3E%3C/svg%3E\")";

export const OVERLAY_CSS = `
:host { all: initial; }
.gc-root {
  all: initial;
  position: fixed;
  left: 0;
  top: 0;
  width: 0;
  height: 0;
  pointer-events: none;
  z-index: 2147483647;
}
.gc-underline {
  position: fixed;
  height: 3px;
  pointer-events: none;
  -webkit-mask-image: ${WAVE};
  mask-image: ${WAVE};
  -webkit-mask-repeat: repeat-x;
  mask-repeat: repeat-x;
}
.gc-card-slot {
  position: fixed;
  pointer-events: auto;
}
`;
