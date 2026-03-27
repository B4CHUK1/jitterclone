import type { AnimatableProperty, SceneNode } from '@/document/types';

export const TIMELINE_LABEL_WIDTH = 240;
export const TIMELINE_RULER_HEIGHT = 28;
export const TIMELINE_LAYER_HEIGHT = 30;
export const TIMELINE_PROPERTY_HEIGHT = 28;
export const TIMELINE_GROUP_HEADER_HEIGHT = 22;
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
      kind: 'group-header';
      top: number;
      height: number;
      node: SceneNode;
      groupLabel: string;
    }
  | {
      id: string;
      kind: 'property';
      top: number;
      height: number;
      node: SceneNode;
      property: AnimatableProperty;
      label: string;
    }
  | {
      id: string;
      kind: 'add-property';
      top: number;
      height: number;
      node: SceneNode;
    };

export function buildTimelineLayout(
  tracks: SceneNode[],
  expandedLayers: Record<string, boolean>,
  properties: { key: AnimatableProperty; label: string }[],
  revealedProperties?: Record<string, Set<AnimatableProperty>>,
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
      // Filter to only show animated or manually revealed properties
      const visibleProperties = properties.filter((property) => {
        const animProp = node.animation.properties[property.key];
        const revealed = revealedProperties?.[node.id]?.has(property.key);
        return animProp.keyframes.length > 0 || revealed;
      });

      if (visibleProperties.length > 0) {
        // Add "Transform" group header
        rows.push({
          id: `group_${node.id}_transform`,
          kind: 'group-header',
          top: cursor,
          height: TIMELINE_GROUP_HEADER_HEIGHT,
          node,
          groupLabel: 'Transform',
        });
        cursor += TIMELINE_GROUP_HEADER_HEIGHT + TIMELINE_ROW_GAP;

        for (const property of visibleProperties) {
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

      // Check if there are hidden properties to offer adding
      const hiddenCount = properties.length - visibleProperties.length;
      if (hiddenCount > 0) {
        rows.push({
          id: `add_prop_${node.id}`,
          kind: 'add-property',
          top: cursor,
          height: TIMELINE_GROUP_HEADER_HEIGHT,
          node,
        });
        cursor += TIMELINE_GROUP_HEADER_HEIGHT + TIMELINE_ROW_GAP;
      }
    }
  }

  return {
    rows,
    totalHeight: cursor + TIMELINE_ROW_GAP,
  };
}
