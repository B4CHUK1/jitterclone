import { create } from 'zustand';

interface TimelineState {
  currentTime: number;
  isPlaying: boolean;
  autoKeyframe: boolean;
  selectedKeyframe: { nodeId: string; property: string; time: number } | null;
  setCurrentTime: (time: number) => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  toggleAutoKeyframe: () => void;
  selectKeyframe: (selection: { nodeId: string; property: string; time: number } | null) => void;
}

export const useTimelineStore = create<TimelineState>((set) => ({
  currentTime: 0,
  isPlaying: false,
  autoKeyframe: false,
  selectedKeyframe: null,
  setCurrentTime: (time) => set({ currentTime: Math.max(0, time) }),
  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
  toggleAutoKeyframe: () => set((state) => ({ autoKeyframe: !state.autoKeyframe })),
  selectKeyframe: (selection) => set({ selectedKeyframe: selection }),
}));
