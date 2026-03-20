import type { AnimatableProperty, SceneNode } from '@/document/types';

export const TIMELINE_LABEL_WIDTH = 240;
export const TIMELINE_RULER_HEIGHT = 28;
export const TIMELINE_LAYER_HEIGHT = 30;
export const TIMELINE_PROPERTY_HEIGHT = 28;
export const TIMELINE_ROW_GAP = 4;

export type TimelineRow =
  | {
      id: string;
      kind: 'layer';
      top: number;
      height: number;
      node: SceneNode;
    }
  | {
      id: string;
      kind: 'property';
      top: number;
      height: number;
      node: SceneNode;
      property: AnimatableProperty;
      label: string;
    };

export function buildTimelineLayout(
  tracks: SceneNode[],
  expandedLayers: Record<string, boolean>,
  properties: { key: AnimatableProperty; label: string }[],
): { rows: TimelineRow[]; totalHeight: number } {
  const rows: TimelineRow[] = [];
  let cursor = TIMELINE_RULER_HEIGHT + TIMELINE_ROW_GAP;

  for (const node of tracks) {
    rows.push({
      id: `layer_${node.id}`,
      kind: 'layer',
      top: cursor,
      height: TIMELINE_LAYER_HEIGHT,
      node,
    });
    cursor += TIMELINE_LAYER_HEIGHT + TIMELINE_ROW_GAP;

    if (expandedLayers[node.id] ?? true) {
      for (const property of properties) {
        rows.push({
          id: `prop_${node.id}_${property.key}`,
          kind: 'property',
          top: cursor,
          height: TIMELINE_PROPERTY_HEIGHT,
          node,
          property: property.key,
          label: property.label,
        });
        cursor += TIMELINE_PROPERTY_HEIGHT + TIMELINE_ROW_GAP;
      }
    }
  }

  return {
    rows,
    totalHeight: cursor + TIMELINE_ROW_GAP,
  };
}
