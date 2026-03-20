import { create } from 'zustand';
import type { AnimatableProperty } from '@/document/types';

interface TimelineState {
  currentTime: number;
  isPlaying: boolean;
  autoKeyframe: boolean;
  zoom: number;
  scrollOffset: number;
  selectedKeyframe: { nodeId: string; property: AnimatableProperty; time: number } | null;
  setCurrentTime: (time: number) => void;
  setZoom: (zoom: number) => void;
  setScrollOffset: (offset: number) => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  toggleAutoKeyframe: () => void;
  selectKeyframe: (
    selection: { nodeId: string; property: AnimatableProperty; time: number } | null,
  ) => void;
}

export const useTimelineStore = create<TimelineState>((set) => ({
  currentTime: 0,
  isPlaying: false,
  autoKeyframe: false,
  zoom: 1,
  scrollOffset: 0,
  selectedKeyframe: null,
  setCurrentTime: (time) => set({ currentTime: Math.max(0, time) }),
  setZoom: (zoom) => set({ zoom: Math.max(0.25, zoom) }),
  setScrollOffset: (offset) => set({ scrollOffset: Math.max(0, offset) }),
  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
  toggleAutoKeyframe: () => set((state) => ({ autoKeyframe: !state.autoKeyframe })),
  selectKeyframe: (selection) => set({ selectedKeyframe: selection }),
}));
