import { create } from 'zustand';
import type { AnimatableProperty } from '@/document/types';

export interface TimelineSelectionKeyframe {
  nodeId: string;
  property: AnimatableProperty;
  /** Local time (relative to clip) */
  time: number;
}

interface TimelineState {
  currentTime: number;
  isPlaying: boolean;
  autoKeyframe: boolean;
  timeScale: number;
  scrollX: number;
  selectedKeyframes: TimelineSelectionKeyframe[];
  setCurrentTime: (time: number) => void;
  setTimeScale: (timeScale: number) => void;
  setScrollX: (offset: number) => void;
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
  setCurrentTime: (time) => set({ currentTime: Math.max(0, time) }),
  setTimeScale: (timeScale) => set({ timeScale: Math.max(0.25, Math.min(8, timeScale)) }),
  setScrollX: (offset) => set({ scrollX: Math.max(0, offset) }),
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
