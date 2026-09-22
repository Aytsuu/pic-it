import {
  CameraView,
  type FlashMode,
  useCameraPermissions,
  useMicrophonePermissions,
} from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Button,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CameraExposureSlider } from '@/components/camera-exposure-slider';
import { CameraFocusHud } from '@/components/camera-focus-hud';
import { CameraFocusReticle } from '@/components/camera-focus-reticle';
import { CameraZoomControls } from '@/components/camera-zoom-controls';
import { useAuth } from '@/hooks/use-auth';
import {
  displayZoomToCameraSettings,
  displayZoomToPinchSettings,
  getDisplayZoomRange,
  getZoomSettings,
  type ZoomPreset,
} from '@/lib/camera-zoom';
import * as queue from '@/lib/queue';
import { registerPhotoFile } from '@/lib/photo-cache';
import { scheduleSync } from '@/lib/sync';

type CaptureMode = 'photo' | 'video' | 'timelapse';

const FLASH_CYCLE: FlashMode[] = ['off', 'auto', 'on'];
const TIMELAPSE_INTERVAL_MS = 2000;
const CONTROLS_HEIGHT = 270;
const PINCH_ZOOM_SENSITIVITY = 1.35;
const FOCUS_HUD_MS = 5000;
const FOCUS_HUD_AFTER_EXPOSURE_MS = 2000;

function normalizeParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function CameraScreen() {
  const { id: rawMomentId } = useLocalSearchParams<{ id: string }>();
  const momentId = normalizeParam(rawMomentId);
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] = useMicrophonePermissions();

  const cameraRef = useRef<CameraView>(null);
  const timelapseIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingStartedAtRef = useRef<number | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pinchBaseDisplayRef = useRef(1);
  const pinchBaseZoomRef = useRef(0);
  const displayZoomRef = useRef(1);
  const zoomNormalizedRef = useRef(0);
  const selectedLensRef = useRef<string | undefined>(undefined);
  const isPinchingRef = useRef(false);
  const pinchMovedRef = useRef(false);
  const lensesInitializedRef = useRef(false);
  const exposureStartRef = useRef(0);
  const exposureBiasRef = useRef(0);
  const isAdjustingExposureRef = useRef(false);
  const focusHideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [captureMode, setCaptureMode] = useState<CaptureMode>('photo');
  const [flashMode, setFlashMode] = useState<FlashMode>('auto');
  const [autofocusMode, setAutofocusMode] = useState<'on' | 'off'>('off');
  const [focusPoint, setFocusPoint] = useState<{ x: number; y: number } | null>(null);
  const [focusHudVisible, setFocusHudVisible] = useState(false);
  const [previewSize, setPreviewSize] = useState({ width: 0, height: 0 });

  const [availableLenses, setAvailableLenses] = useState<string[]>([]);
  const [zoomNormalized, setZoomNormalized] = useState(0);
  const [selectedLens, setSelectedLens] = useState<string | undefined>(undefined);
  const [exposureBias, setExposureBias] = useState(0);
  const [isAdjustingExposure, setIsAdjustingExposure] = useState(false);
  const [displayZoom, setDisplayZoom] = useState(1);

  const [isCapturing, setIsCapturing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isTimelapseActive, setIsTimelapseActive] = useState(false);
  const [timelapseFrames, setTimelapseFrames] = useState(0);

  const applyDisplayZoom = useCallback(
    (nextDisplayZoom: number) => {
      const { min, max } = getDisplayZoomRange(availableLenses);
      const clamped = clamp(nextDisplayZoom, min, max);
      const settings = displayZoomToCameraSettings(clamped, availableLenses);

      displayZoomRef.current = clamped;
      zoomNormalizedRef.current = settings.zoom;
      setDisplayZoom(clamped);
      setZoomNormalized(settings.zoom);

      if (settings.selectedLens !== selectedLensRef.current) {
        selectedLensRef.current = settings.selectedLens;
        setSelectedLens(settings.selectedLens);
      }
    },
    [availableLenses]
  );

  const applyPinchZoom = useCallback(
    (nextDisplayZoom: number) => {
      const { min, max } = getDisplayZoomRange(availableLenses);
      const clamped = clamp(nextDisplayZoom, min, max);
      const settings = displayZoomToPinchSettings(
        clamped,
        pinchBaseDisplayRef.current,
        pinchBaseZoomRef.current,
        selectedLensRef.current,
        availableLenses
      );

      displayZoomRef.current = clamped;
      zoomNormalizedRef.current = settings.zoom;
      setDisplayZoom(clamped);
      setZoomNormalized(settings.zoom);

      if (settings.selectedLens !== selectedLensRef.current) {
        selectedLensRef.current = settings.selectedLens;
        setSelectedLens(settings.selectedLens);
      }
    },
    [availableLenses]
  );

  const applyZoomPreset = useCallback(
    (preset: ZoomPreset) => {
      const settings = getZoomSettings(preset, availableLenses);
      displayZoomRef.current = preset;
      zoomNormalizedRef.current = settings.zoom;
      selectedLensRef.current = settings.selectedLens;
      setDisplayZoom(preset);
      setZoomNormalized(settings.zoom);
      setSelectedLens(settings.selectedLens);
    },
    [availableLenses]
  );

  const clearFocusHudHide = useCallback(() => {
    if (focusHideTimeoutRef.current) {
      clearTimeout(focusHideTimeoutRef.current);
      focusHideTimeoutRef.current = null;
    }
  }, []);

  const hideFocusHud = useCallback(() => {
    setFocusHudVisible(false);
  }, []);

  const scheduleFocusHudHide = useCallback(
    (delayMs: number) => {
      clearFocusHudHide();
      focusHideTimeoutRef.current = setTimeout(() => {
        if (isAdjustingExposureRef.current) return;
        hideFocusHud();
      }, delayMs);
    },
    [clearFocusHudHide, hideFocusHud]
  );

  const handleFocusHudHidden = useCallback(() => {
    setFocusPoint(null);
    setAutofocusMode('off');
    void cameraRef.current?.restoreContinuousFocusAsync?.();
  }, []);

  const handleFocusAt = useCallback(
    (x: number, y: number) => {
      if (isRecording || isTimelapseActive) return;

      setFocusPoint({ x, y });
      setFocusHudVisible(true);
      void cameraRef.current?.focusAtAsync?.(x, y);
      scheduleFocusHudHide(FOCUS_HUD_MS);
    },
    [isRecording, isTimelapseActive, scheduleFocusHudHide]
  );

  const restoreAutofocus = useCallback(() => {
    if (isRecording || isTimelapseActive) return;

    const width = previewSize.width;
    const height = previewSize.height;
    const x = width > 0 ? width / 2 : 180;
    const y = height > 0 ? Math.max(120, (height - CONTROLS_HEIGHT) / 2) : 280;

    handleFocusAt(x, y);
  }, [handleFocusAt, isRecording, isTimelapseActive, previewSize.height, previewSize.width]);

  const updateExposureBias = useCallback((value: number) => {
    if (isPinchingRef.current) return;

    const next = clamp(value, -1, 1);
    exposureBiasRef.current = next;
    setExposureBias(next);
  }, []);

  const handlePinchStart = useCallback(() => {
    if (isPinchingRef.current) return;

    isPinchingRef.current = true;
    pinchMovedRef.current = false;
    pinchBaseDisplayRef.current = displayZoomRef.current;
    pinchBaseZoomRef.current = zoomNormalizedRef.current;
  }, []);

  const handlePinchEnd = useCallback(() => {
    isPinchingRef.current = false;
    pinchMovedRef.current = false;
  }, []);

  const updateManualZoomFromScale = useCallback(
    (scale: number, pointerCount: number) => {
      if (pointerCount < 2) return;

      if (!isPinchingRef.current) {
        handlePinchStart();
      }

      if (!pinchMovedRef.current && Math.abs(scale - 1) < 0.02) return;

      pinchMovedRef.current = true;
      const next = pinchBaseDisplayRef.current * Math.pow(scale, PINCH_ZOOM_SENSITIVITY);
      applyPinchZoom(next);
    },
    [applyPinchZoom, handlePinchStart]
  );

  const markExposureDragStart = useCallback(() => {
    if (isPinchingRef.current) return;
    isAdjustingExposureRef.current = true;
    clearFocusHudHide();
    setIsAdjustingExposure(true);
  }, [clearFocusHudHide]);

  const markExposureDragEnd = useCallback(() => {
    isAdjustingExposureRef.current = false;
    setIsAdjustingExposure(false);
    if (focusPoint) {
      scheduleFocusHudHide(FOCUS_HUD_AFTER_EXPOSURE_MS);
    }
  }, [focusPoint, scheduleFocusHudHide]);

  const previewGestures = useMemo(() => {
    const tapGesture = Gesture.Tap().onEnd((event) => {
      runOnJS(handleFocusAt)(event.x, event.y);
    });

    const panGesture = Gesture.Pan()
      .maxPointers(1)
      .activeOffsetY([-10, 10])
      .onBegin(() => {
        exposureStartRef.current = exposureBiasRef.current;
      })
      .onStart(() => {
        runOnJS(markExposureDragStart)();
      })
      .onUpdate((event) => {
        const next = exposureStartRef.current - event.translationY / 140;
        runOnJS(updateExposureBias)(next);
      })
      .onFinalize(() => {
        runOnJS(markExposureDragEnd)();
      });

    const pinchGesture = Gesture.Pinch()
      .onBegin(() => {
        runOnJS(handlePinchStart)();
      })
      .onUpdate((event) => {
        runOnJS(updateManualZoomFromScale)(event.scale, event.numberOfPointers);
      })
      .onFinalize(() => {
        runOnJS(handlePinchEnd)();
      });

    return Gesture.Simultaneous(pinchGesture, Gesture.Exclusive(panGesture, tapGesture));
  }, [
    handleFocusAt,
    handlePinchEnd,
    handlePinchStart,
    markExposureDragEnd,
    markExposureDragStart,
    updateExposureBias,
    updateManualZoomFromScale,
  ]);

  const clearTimelapseInterval = useCallback(() => {
    if (timelapseIntervalRef.current) {
      clearInterval(timelapseIntervalRef.current);
      timelapseIntervalRef.current = null;
    }
  }, []);

  const clearRecordingTimer = useCallback(() => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    recordingStartedAtRef.current = null;
    setRecordingSeconds(0);
  }, []);

  useEffect(() => {
    return () => {
      clearTimelapseInterval();
      clearRecordingTimer();
      clearFocusHudHide();
      cameraRef.current?.stopRecording();
    };
  }, [clearFocusHudHide, clearRecordingTimer, clearTimelapseInterval]);

  useEffect(() => {
    if (availableLenses.length === 0 || lensesInitializedRef.current || isPinchingRef.current) {
      return;
    }

    lensesInitializedRef.current = true;
    applyDisplayZoom(displayZoomRef.current);
  }, [availableLenses, applyDisplayZoom]);

  const enqueueCapture = useCallback(
    (uri: string) => {
      if (!momentId) return;
      const queued = queue.enqueue(momentId, uri);
      registerPhotoFile(queued.local_id, momentId, queued.local_uri);
      if (user) {
        void scheduleSync(user.id, momentId);
      }
    },
    [momentId, user]
  );

  const capturePhoto = useCallback(async () => {
    if (!cameraRef.current || !momentId || isCapturing) return false;

    setIsCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.85 });
      if (!photo?.uri) return false;
      enqueueCapture(photo.uri);
      return true;
    } finally {
      setIsCapturing(false);
    }
  }, [enqueueCapture, isCapturing, momentId]);

  const cycleFlash = useCallback(() => {
    setFlashMode((current) => {
      const index = FLASH_CYCLE.indexOf(current);
      return FLASH_CYCLE[(index + 1) % FLASH_CYCLE.length];
    });
  }, []);

  const ensureMicrophonePermission = useCallback(async () => {
    if (microphonePermission?.granted) return true;

    const result = await requestMicrophonePermission();
    if (!result.granted) {
      Alert.alert('Microphone access needed', 'Allow microphone access to record video.');
      return false;
    }
    return true;
  }, [microphonePermission?.granted, requestMicrophonePermission]);

  const handleModeChange = useCallback(
    async (mode: CaptureMode) => {
      if (mode === captureMode) return;

      if (isRecording) {
        cameraRef.current?.stopRecording();
        setIsRecording(false);
        clearRecordingTimer();
      }

      if (isTimelapseActive) {
        clearTimelapseInterval();
        setIsTimelapseActive(false);
      }

      if (mode === 'video') {
        const allowed = await ensureMicrophonePermission();
        if (!allowed) return;
      }

      setCaptureMode(mode);
      setTimelapseFrames(0);
    },
    [
      captureMode,
      clearRecordingTimer,
      clearTimelapseInterval,
      ensureMicrophonePermission,
      isRecording,
      isTimelapseActive,
    ]
  );

  const handlePhotoShutter = useCallback(() => {
    void capturePhoto();
  }, [capturePhoto]);

  const handleVideoShutter = useCallback(async () => {
    if (!cameraRef.current || !momentId) return;

    if (!isRecording) {
      const allowed = await ensureMicrophonePermission();
      if (!allowed) return;

      setIsRecording(true);
      recordingStartedAtRef.current = Date.now();
      recordingTimerRef.current = setInterval(() => {
        const startedAt = recordingStartedAtRef.current;
        if (!startedAt) return;
        setRecordingSeconds(Math.floor((Date.now() - startedAt) / 1000));
      }, 250);

      try {
        const result = await cameraRef.current.recordAsync({ maxDuration: 300 });
        if (result?.uri) {
          enqueueCapture(result.uri);
        }
      } catch {
        Alert.alert('Recording failed', 'Could not save this video.');
      } finally {
        setIsRecording(false);
        clearRecordingTimer();
      }
      return;
    }

    cameraRef.current.stopRecording();
  }, [clearRecordingTimer, enqueueCapture, ensureMicrophonePermission, isRecording, momentId]);

  const captureTimelapseFrame = useCallback(async () => {
    const saved = await capturePhoto();
    if (saved) {
      setTimelapseFrames((count) => count + 1);
    }
  }, [capturePhoto]);

  const handleTimelapseShutter = useCallback(() => {
    if (!isTimelapseActive) {
      setIsTimelapseActive(true);
      setTimelapseFrames(0);
      void captureTimelapseFrame();
      timelapseIntervalRef.current = setInterval(() => {
        void captureTimelapseFrame();
      }, TIMELAPSE_INTERVAL_MS);
      return;
    }

    clearTimelapseInterval();
    setIsTimelapseActive(false);
  }, [captureTimelapseFrame, clearTimelapseInterval, isTimelapseActive]);

  const handleShutterPress = useCallback(() => {
    if (captureMode === 'photo') {
      handlePhotoShutter();
      return;
    }
    if (captureMode === 'video') {
      void handleVideoShutter();
      return;
    }
    handleTimelapseShutter();
  }, [captureMode, handlePhotoShutter, handleTimelapseShutter, handleVideoShutter]);

  const handlePreviewLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setPreviewSize({ width, height });
  }, []);

  const handleAvailableLensesChanged = useCallback((event: { lenses: string[] }) => {
    if (event.lenses.length > 0) {
      setAvailableLenses(event.lenses);
    }
  }, []);

  const handleCameraReady = useCallback(() => {
    void cameraRef.current?.getAvailableLensesAsync().then((lenses) => {
      if (lenses.length > 0) {
        setAvailableLenses(lenses);
      }
    });
  }, []);

  if (!permission) return <View style={styles.container} />;

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.permissionText}>Camera access is required to shoot photos.</Text>
        <Button title="Grant permission" onPress={requestPermission} />
      </View>
    );
  }

  const flashIcon =
    flashMode === 'on'
      ? { ios: 'bolt.fill' as const, android: 'flash_on' as const }
      : flashMode === 'auto'
        ? { ios: 'bolt.badge.automatic.fill' as const, android: 'flash_auto' as const }
        : { ios: 'bolt.slash.fill' as const, android: 'flash_off' as const };

  const isBusy = isCapturing && captureMode === 'photo';
  const torchEnabled = flashMode === 'on' && (captureMode === 'video' || isRecording);

  return (
    <GestureHandlerRootView style={styles.container}>
      <View style={styles.preview} onLayout={handlePreviewLayout}>
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          mode={captureMode === 'video' ? 'video' : 'picture'}
          flash={flashMode}
          enableTorch={torchEnabled}
          autofocus={autofocusMode}
          mute={false}
          zoom={zoomNormalized}
          exposureCompensation={exposureBias}
          selectedLens={selectedLens}
          onCameraReady={handleCameraReady}
          onAvailableLensesChanged={handleAvailableLensesChanged}
        />

        <GestureDetector gesture={previewGestures}>
          <View style={[styles.focusLayer, { bottom: CONTROLS_HEIGHT + insets.bottom }]} />
        </GestureDetector>

        {focusPoint ? (
          <CameraFocusHud visible={focusHudVisible} onHidden={handleFocusHudHidden}>
            <CameraFocusReticle x={focusPoint.x} y={focusPoint.y} />
            <CameraExposureSlider
              x={focusPoint.x}
              y={focusPoint.y}
              value={exposureBias}
              active={isAdjustingExposure}
            />
          </CameraFocusHud>
        ) : null}
      </View>

      <Pressable
        onPress={() => router.back()}
        style={[styles.closeButton, { top: insets.top + 12 }]}
        accessibilityRole="button"
        accessibilityLabel="Close camera"
        hitSlop={8}
      >
        <SymbolView
          name={{ ios: 'xmark', android: 'close' }}
          size={20}
          tintColor="#fff"
          weight="semibold"
        />
      </Pressable>

      <Pressable
        onPress={cycleFlash}
        style={[styles.flashButton, { top: insets.top + 12 }]}
        accessibilityRole="button"
        accessibilityLabel={`Flash ${flashMode}`}
        hitSlop={8}
      >
        <SymbolView
          name={{ ios: flashIcon.ios, android: flashIcon.android }}
          size={20}
          tintColor="#fff"
          weight="semibold"
        />
      </Pressable>

      <Pressable
        onPress={restoreAutofocus}
        style={({ pressed }) => [
          styles.autofocusButton,
          { top: insets.top + 56 },
          pressed && styles.iconButtonPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Autofocus"
        hitSlop={8}
      >
        <SymbolView
          name={{ ios: 'viewfinder', android: 'center_focus_strong' }}
          size={20}
          tintColor={focusHudVisible ? '#f5d442' : '#fff'}
          weight="semibold"
        />
      </Pressable>

      {(isRecording || isTimelapseActive) && (
        <View style={[styles.statusPill, { top: insets.top + 12 }]}>
          <View style={styles.recordingDot} />
          <Text style={styles.statusText}>
            {isRecording
              ? formatDuration(recordingSeconds)
              : `Timelapse · ${timelapseFrames} frames`}
          </Text>
        </View>
      )}

      <View style={[styles.controls, { paddingBottom: insets.bottom + 24 }]}>
        <CameraZoomControls
          displayZoom={displayZoom}
          availableLenses={availableLenses}
          onChange={applyZoomPreset}
        />

        <View style={styles.modeRow}>
          {(['video', 'photo', 'timelapse'] as CaptureMode[]).map((mode) => {
            const isActive = captureMode === mode;
            const label = mode === 'video' ? 'Video' : mode === 'photo' ? 'Photo' : 'Timelapse';

            return (
              <Pressable
                key={mode}
                onPress={() => void handleModeChange(mode)}
                style={[styles.modeChip, isActive && styles.modeChipActive]}
                accessibilityRole="button"
                accessibilityLabel={label}
              >
                <Text style={[styles.modeChipText, isActive && styles.modeChipTextActive]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          onPress={handleShutterPress}
          disabled={isBusy}
          style={[
            styles.shutterOuter,
            captureMode !== 'photo' && styles.shutterOuterVideo,
            (isRecording || isTimelapseActive) && styles.shutterOuterActive,
            isBusy && styles.shutterDisabled,
          ]}
          accessibilityRole="button"
          accessibilityLabel={
            captureMode === 'photo'
              ? 'Take photo'
              : captureMode === 'video'
                ? isRecording
                  ? 'Stop recording'
                  : 'Start recording'
                : isTimelapseActive
                  ? 'Stop timelapse'
                  : 'Start timelapse'
          }
        >
          <View
            style={[
              styles.shutterInner,
              captureMode !== 'photo' && styles.shutterInnerVideo,
              (isRecording || isTimelapseActive) && styles.shutterInnerActive,
            ]}
          />
        </Pressable>

        {previewSize.height > 0 ? (
          <Text style={styles.hint}>
            {captureMode === 'photo'
              ? 'Tap to focus · AF restores auto · Drag for brightness · Pinch to zoom'
              : captureMode === 'video'
                ? 'Pinch with two fingers to zoom · Tap record to start and stop'
                : isTimelapseActive
                  ? 'Capturing a frame every 2 seconds'
                  : 'Tap to start timelapse'}
          </Text>
        ) : null}
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  preview: { flex: 1 },
  focusLayer: {
    ...StyleSheet.absoluteFill,
    zIndex: 2,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
    backgroundColor: '#000',
  },
  permissionText: {
    color: '#fff',
    textAlign: 'center',
  },
  closeButton: {
    position: 'absolute',
    left: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  flashButton: {
    position: 'absolute',
    right: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  autofocusButton: {
    position: 'absolute',
    right: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  iconButtonPressed: {
    opacity: 0.55,
    transform: [{ scale: 0.94 }],
  },
  statusPill: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    zIndex: 5,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ff3b30',
  },
  statusText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  controls: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    gap: 14,
    zIndex: 5,
  },
  modeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.42)',
  },
  modeChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
  },
  modeChipActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  modeChipText: {
    color: 'rgba(255, 255, 255, 0.72)',
    fontSize: 13,
    fontWeight: '600',
  },
  modeChipTextActive: {
    color: '#fff',
  },
  shutterOuter: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterOuterVideo: {
    borderColor: 'rgba(255, 255, 255, 0.92)',
  },
  shutterOuterActive: {
    borderColor: '#ff3b30',
  },
  shutterInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#fff',
  },
  shutterInnerVideo: {
    backgroundColor: '#ff3b30',
  },
  shutterInnerActive: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#ff3b30',
  },
  shutterDisabled: {
    opacity: 0.5,
  },
  hint: {
    color: 'rgba(255, 255, 255, 0.72)',
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
});
