import { Platform } from 'react-native';

export type ZoomPreset = 0.5 | 1 | 2 | 3;

export const ZOOM_PRESETS: ZoomPreset[] = [0.5, 1, 2, 3];

export const MAX_DISPLAY_ZOOM = 3;

const ANDROID_MAX_ZOOM = 0.48;

/**
 * expo-camera maps `zoom` 0–1 exponentially:
 * videoZoomFactor = pow(deviceMaxZoom, zoom).
 * iPhone virtual cameras commonly expose ~123× max, so we invert that to hit
 * optical switchovers (0.5× → factor 1, 1× → 2, 2× → 4, 3× → 6).
 */
const IOS_VIRTUAL_MAX_ZOOM_FACTOR = 123;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function lensIncludes(lens: string, keyword: string): boolean {
  return lens.toLowerCase().includes(keyword);
}

function isUltraWideLens(lens: string | undefined, lenses: string[]): boolean {
  if (!lens) return false;
  const ultra = findPhysicalLensForPreset(0.5, lenses);
  return ultra !== undefined && lens === ultra;
}

function isTelephotoLens(lens: string | undefined, lenses: string[]): boolean {
  if (!lens) return false;
  const tele = findPhysicalLensForPreset(2, lenses);
  return tele !== undefined && lens === tele;
}

/** Virtual multi-cam that can optically blend 0.5 / 1 / 2 without swapping devices. */
function findVirtualZoomLens(lenses: string[]): string | undefined {
  return (
    lenses.find((lens) => lensIncludes(lens, 'triple')) ??
    lenses.find((lens) => lensIncludes(lens, 'dual wide')) ??
    lenses.find((lens) => lensIncludes(lens, 'dual camera'))
  );
}

function virtualHasUltraWide(lens: string): boolean {
  return lensIncludes(lens, 'triple') || lensIncludes(lens, 'dual wide');
}

function displayToVirtualNormalizedZoom(displayZoom: number, minDisplay: number): number {
  const factor = Math.max(displayZoom / minDisplay, 1);
  return clamp(Math.log(factor) / Math.log(IOS_VIRTUAL_MAX_ZOOM_FACTOR), 0, 1);
}

function findPhysicalLensForPreset(preset: ZoomPreset, lenses: string[]): string | undefined {
  if (lenses.length === 0) return undefined;

  if (preset === 0.5) {
    return lenses.find((lens) => lensIncludes(lens, 'ultra wide') || lensIncludes(lens, 'ultrawide'));
  }

  if (preset === 1) {
    return (
      lenses.find(
        (lens) =>
          !lensIncludes(lens, 'ultra wide') &&
          !lensIncludes(lens, 'ultrawide') &&
          !lensIncludes(lens, 'telephoto') &&
          !lensIncludes(lens, 'triple') &&
          !lensIncludes(lens, 'dual')
      ) ?? lenses[0]
    );
  }

  if (preset === 2 || preset === 3) {
    return lenses.find((lens) => lensIncludes(lens, 'telephoto'));
  }

  return undefined;
}

export function findLensForPreset(preset: ZoomPreset, lenses: string[]): string | undefined {
  const virtual = findVirtualZoomLens(lenses);
  if (virtual) {
    if (preset === 0.5 && !virtualHasUltraWide(virtual)) {
      return findPhysicalLensForPreset(0.5, lenses);
    }
    return virtual;
  }

  return findPhysicalLensForPreset(preset, lenses);
}

export function isZoomPresetAvailable(preset: ZoomPreset, lenses: string[]): boolean {
  if (preset === 1) return true;
  if (Platform.OS !== 'ios') return true;
  return findLensForPreset(preset, lenses) !== undefined;
}

export function getZoomSettings(
  preset: ZoomPreset,
  lenses: string[]
): { zoom: number; selectedLens?: string } {
  return displayZoomToCameraSettings(preset, lenses);
}

export function getMinDisplayZoom(lenses: string[]): number {
  return isZoomPresetAvailable(0.5, lenses) ? 0.5 : 1;
}

export function getDisplayZoomRange(lenses: string[]): { min: number; max: number } {
  return {
    min: getMinDisplayZoom(lenses),
    max: MAX_DISPLAY_ZOOM,
  };
}

/** Normalized zoom for a specific physical lens at a display-zoom value (always >= 0). */
function zoomForLensAtDisplay(
  lens: string,
  displayZoom: number,
  lenses: string[]
): number {
  const { min, max } = getDisplayZoomRange(lenses);
  const value = clamp(displayZoom, min, max);
  const ultraWide = findPhysicalLensForPreset(0.5, lenses);

  if (isUltraWideLens(lens, lenses)) {
    const span = 1 - min;
    const t = span > 0 ? clamp((value - min) / span, 0, 1) : 0;
    return t * 0.1;
  }

  if (!isTelephotoLens(lens, lenses)) {
    const segmentMin = ultraWide ? 1 : min;
    if (value <= 2) {
      const span = 2 - segmentMin;
      const t = span > 0 ? clamp((value - segmentMin) / span, 0, 1) : 0;
      return t * 0.28;
    }
    const span = max - 2;
    const t = span > 0 ? clamp((value - 2) / span, 0, 1) : 0;
    return 0.28 + t * 0.12;
  }

  const span = max - 2;
  const t = span > 0 ? clamp((value - 2) / span, 0, 1) : 0;
  return t * 0.45;
}

/**
 * Smooth mapping from display zoom (0.5–3) to camera lens + normalized zoom.
 * Prefers the iOS virtual multi-cam so crossing 1× / 2× does not swap devices.
 */
export function displayZoomToCameraSettings(
  displayZoom: number,
  lenses: string[]
): { zoom: number; selectedLens?: string } {
  const { min, max } = getDisplayZoomRange(lenses);
  const value = clamp(displayZoom, min, max);

  if (Platform.OS !== 'ios' || lenses.length === 0) {
    const t = (value - min) / (max - min);
    return { zoom: t * ANDROID_MAX_ZOOM };
  }

  const virtual = findVirtualZoomLens(lenses);
  if (virtual) {
    return {
      selectedLens: virtual,
      zoom: displayToVirtualNormalizedZoom(value, min),
    };
  }

  const ultraWide = findPhysicalLensForPreset(0.5, lenses);
  const wide = findPhysicalLensForPreset(1, lenses);
  const tele = findPhysicalLensForPreset(2, lenses);

  if (ultraWide && value < 1) {
    return { selectedLens: ultraWide, zoom: zoomForLensAtDisplay(ultraWide, value, lenses) };
  }

  if (value < 2 || !tele) {
    return { selectedLens: wide, zoom: zoomForLensAtDisplay(wide ?? lenses[0], value, lenses) };
  }

  return { selectedLens: tele, zoom: zoomForLensAtDisplay(tele, value, lenses) };
}

export function formatZoomPresetLabel(preset: ZoomPreset): string {
  return preset === 0.5 ? '0.5' : `${preset}`;
}

function roundZoomTenth(displayZoom: number): number {
  return Math.round(displayZoom * 10) / 10;
}

/** Which preset chip is highlighted for the current display zoom level. */
export function getActiveZoomPreset(displayZoom: number, lenses: string[]): ZoomPreset {
  const available = ZOOM_PRESETS.filter((preset) => isZoomPresetAvailable(preset, lenses));
  if (available.length === 0) return 1;

  const rounded = roundZoomTenth(displayZoom);

  for (let index = 0; index < available.length - 1; index += 1) {
    const lower = available[index];
    const upper = available[index + 1];
    if (rounded >= lower && rounded < upper) {
      return lower;
    }
  }

  return available[available.length - 1];
}

/** Live label shown on the active preset chip (e.g. 0.7, 1, 1.2). */
export function formatZoomChipLabel(displayZoom: number, lenses: string[] = []): string {
  const preset = getActiveZoomPreset(displayZoom, lenses);
  const available = ZOOM_PRESETS.filter((item) => isZoomPresetAvailable(item, lenses));
  const nextPreset = available[available.indexOf(preset) + 1];
  let rounded = roundZoomTenth(displayZoom);

  if (nextPreset !== undefined && rounded >= nextPreset) {
    rounded = roundZoomTenth(nextPreset - 0.1);
  }

  if (rounded < preset) {
    rounded = preset;
  }

  if (rounded === 0.5) return '0.5';
  if (Number.isInteger(rounded)) return `${rounded}`;
  return rounded.toFixed(1);
}

/**
 * Pinch zoom offsets from the values captured at gesture start so the first
 * frame never remaps display→zoom (which would snap away from preset settings).
 * Uses display delta rather than zoom ratio so base zoom 0 (1× preset) still zooms in.
 */
export function scalePinchZoom(
  nextDisplayZoom: number,
  pinchBaseDisplayZoom: number,
  pinchBaseNormalizedZoom: number,
  lenses: string[]
): number {
  const { min, max } = getDisplayZoomRange(lenses);
  const nextDisplay = clamp(nextDisplayZoom, min, max);
  const baseDisplay = clamp(pinchBaseDisplayZoom, min, max);
  const displaySpan = max - min;

  if (displaySpan <= 0) {
    return clamp(pinchBaseNormalizedZoom, 0, 1);
  }

  const zoomDelta = ((nextDisplay - baseDisplay) / displaySpan) * ANDROID_MAX_ZOOM;
  return clamp(pinchBaseNormalizedZoom + zoomDelta, 0, 1);
}

/**
 * Pinch mapping: stay on one device. Virtual multi-cam uses absolute zoom so
 * 0.5 / 1 / 2 stay optically correct without swapping cameras.
 */
export function displayZoomToPinchSettings(
  nextDisplayZoom: number,
  pinchBaseDisplayZoom: number,
  pinchBaseNormalizedZoom: number,
  currentLens: string | undefined,
  lenses: string[]
): { zoom: number; selectedLens?: string } {
  const { min, max } = getDisplayZoomRange(lenses);
  const clamped = clamp(nextDisplayZoom, min, max);
  const baseClamped = clamp(pinchBaseDisplayZoom, min, max);
  const target = displayZoomToCameraSettings(clamped, lenses);
  const base = displayZoomToCameraSettings(baseClamped, lenses);

  if (findVirtualZoomLens(lenses) && target.selectedLens === base.selectedLens) {
    return target;
  }

  const sameSegment =
    currentLens !== undefined &&
    target.selectedLens === base.selectedLens &&
    target.selectedLens === currentLens;

  if (sameSegment) {
    return {
      selectedLens: target.selectedLens,
      zoom: scalePinchZoom(clamped, baseClamped, pinchBaseNormalizedZoom, lenses),
    };
  }

  return target;
}
