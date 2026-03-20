import { create } from 'zustand';
import type { AnimatableProperty } from '@/document/types';

export interface TimelineSelectionKeyframe {
  nodeId: string;
  property: AnimatableProperty;
  time: number;
}

export interface LayerTiming {
  startTime: number;
  endTime: number;
}

interface TimelineState {
  currentTime: number;
  isPlaying: boolean;
  autoKeyframe: boolean;
  timeScale: number;
  scrollX: number;
  selectedKeyframes: TimelineSelectionKeyframe[];
  layerTimingByNodeId: Record<string, LayerTiming>;
  setCurrentTime: (time: number) => void;
  setTimeScale: (timeScale: number) => void;
  setScrollX: (offset: number) => void;
  setLayerTiming: (nodeId: string, timing: LayerTiming) => void;
  ensureLayerTiming: (nodeId: string, duration: number) => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  toggleAutoKeyframe: () => void;
  setSelectedKeyframes: (selection: TimelineSelectionKeyframe[]) => void;
  toggleKeyframeSelection: (selection: TimelineSelectionKeyframe) => void;
}

export const useTimelineStore = create<TimelineState>((set) => ({
  currentTime: 0,
  isPlaying: false,
  autoKeyframe: false,
  timeScale: 1,
  scrollX: 0,
  selectedKeyframes: [],
  layerTimingByNodeId: {},
  setCurrentTime: (time) => set({ currentTime: Math.max(0, time) }),
  setTimeScale: (timeScale) => set({ timeScale: Math.max(0.25, Math.min(8, timeScale)) }),
  setScrollX: (offset) => set({ scrollX: Math.max(0, offset) }),
  ensureLayerTiming: (nodeId, duration) =>
    set((state) => {
      if (state.layerTimingByNodeId[nodeId]) return state;
      return {
        layerTimingByNodeId: {
          ...state.layerTimingByNodeId,
          [nodeId]: {
            startTime: 0,
            endTime: Math.max(0, duration),
          },
        },
      };
    }),
  setLayerTiming: (nodeId, timing) =>
    set((state) => ({
      layerTimingByNodeId: {
        ...state.layerTimingByNodeId,
        [nodeId]: timing,
      },
    })),
  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
  toggleAutoKeyframe: () => set((state) => ({ autoKeyframe: !state.autoKeyframe })),
  setSelectedKeyframes: (selection) => set({ selectedKeyframes: selection }),
  toggleKeyframeSelection: (selection) =>
    set((state) => {
      const index = state.selectedKeyframes.findIndex(
        (key) =>
          key.nodeId === selection.nodeId &&
          key.property === selection.property &&
          Math.abs(key.time - selection.time) < 1e-6,
      );
      if (index >= 0) {
        const next = [...state.selectedKeyframes];
        next.splice(index, 1);
        return { selectedKeyframes: next };
      }
      return { selectedKeyframes: [...state.selectedKeyframes, selection] };
    }),
}));
