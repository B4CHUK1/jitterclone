import { buildSceneGraph, findRenderNode } from '@/engine/scene';
import {
  alignNodes,
  canAlign,
  canDistribute,
  distributeNodes,
  type AlignAction,
  type ArrangableNode,
  type DistributeAction,
} from '@/engine/interaction/arrangeActions';
import { getRenderNodeBounds } from '@/engine/interaction/snapEngine';
import type { Document } from '@/document/types';
import type { AnimatableProperty } from '@/document/types';
import { hasKeyframeAtTime } from '@/engine/animation';
import { useEditorStore, useDocumentStore, useTimelineStore } from '@/state';
import { NumericInput } from '@/ui/components/NumericInput';
import styles from './PropertiesPanel.module.css';

export function PropertiesPanel() {
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const document = useDocumentStore((s) => s.document);
  const updateTransform = useDocumentStore((s) => s.updateTransform);
  const updateTransforms = useDocumentStore((s) => s.updateTransforms);
  const updateStyle = useDocumentStore((s) => s.updateStyle);
  const updateComposition = useDocumentStore((s) => s.updateComposition);
  const setKeyframe = useDocumentStore((s) => s.setKeyframe);
  const removeKeyframe = useDocumentStore((s) => s.removeKeyframe);
  const currentTime = useTimelineStore((s) => s.currentTime);

  if (selectedIds.size === 0) {
    return (
      <div className={styles.panel}>
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Composition</div>
          <div className={styles.row}>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Width</span>
              <NumericInput
                className={styles.fieldInput}
                label="Composition width"
                value={document.composition.width}
                min={1}
                onChange={(v) => updateComposition({ width: Math.max(1, Math.round(v)) })}
              />
            </div>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Height</span>
              <NumericInput
                className={styles.fieldInput}
                label="Composition height"
                value={document.composition.height}
                min={1}
                onChange={(v) => updateComposition({ height: Math.max(1, Math.round(v)) })}
              />
            </div>
          </div>
          <div className={styles.row}>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Duration (s)</span>
              <NumericInput
                className={styles.fieldInput}
                label="Composition duration"
                value={document.composition.duration}
                min={0.1}
                precision={2}
                onChange={(v) => updateComposition({ duration: Math.max(0.1, v) })}
              />
            </div>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>FPS</span>
              <NumericInput
                className={styles.fieldInput}
                label="Composition FPS"
                value={document.composition.fps}
                min={1}
                onChange={(v) => updateComposition({ fps: Math.max(1, Math.round(v)) })}
              />
            </div>
          </div>
          <div className={styles.colorRow}>
            <input
              className={styles.colorSwatch}
              type="color"
              value={document.composition.background}
              onChange={(e) => updateComposition({ background: e.target.value })}
            />
            <input
              className={styles.colorInput}
              type="text"
              value={document.composition.background}
              onChange={(e) => updateComposition({ background: e.target.value })}
            />
          </div>
        </div>
      </div>
    );
  }

  if (selectedIds.size > 1) {
    const arrangable = getArrangableSelection(document, selectedIds);
    const canRunAlign = canAlign(arrangable);
    const canRunHDistribute = canDistribute(arrangable, 'h-spacing');
    const canRunVDistribute = canDistribute(arrangable, 'v-spacing');

    const runAlign = (action: AlignAction) => {
      updateTransforms(alignNodes(arrangable, action));
    };
    const runDistribute = (action: DistributeAction) => {
      updateTransforms(distributeNodes(arrangable, action));
    };

    return (
      <div className={styles.panel}>
        <div className={styles.section}>
          <div className={styles.sectionTitle}>{selectedIds.size} elements</div>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionTitle}>Align</div>
          <div className={styles.grid}>
            <button
              type="button"
              className={styles.actionButton}
              disabled={!canRunAlign}
              onClick={() => runAlign('left')}
            >
              Left
            </button>
            <button
              type="button"
              className={styles.actionButton}
              disabled={!canRunAlign}
              onClick={() => runAlign('h-center')}
            >
              H-Center
            </button>
            <button
              type="button"
              className={styles.actionButton}
              disabled={!canRunAlign}
              onClick={() => runAlign('right')}
            >
              Right
            </button>
            <button
              type="button"
              className={styles.actionButton}
              disabled={!canRunAlign}
              onClick={() => runAlign('top')}
            >
              Top
            </button>
            <button
              type="button"
              className={styles.actionButton}
              disabled={!canRunAlign}
              onClick={() => runAlign('v-center')}
            >
              V-Center
            </button>
            <button
              type="button"
              className={styles.actionButton}
              disabled={!canRunAlign}
              onClick={() => runAlign('bottom')}
            >
              Bottom
            </button>
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionTitle}>Distribute</div>
          <div className={styles.row}>
            <button
              type="button"
              className={styles.actionButton}
              disabled={!canRunHDistribute}
              onClick={() => runDistribute('h-spacing')}
            >
              Horizontal spacing
            </button>
            <button
              type="button"
              className={styles.actionButton}
              disabled={!canRunVDistribute}
              onClick={() => runDistribute('v-spacing')}
            >
              Vertical spacing
            </button>
          </div>
        </div>
      </div>
    );
  }

  const nodeId = [...selectedIds][0]!;
  const node = document.nodes[nodeId];
  if (!node) {
    return (
      <div className={styles.panel}>
        <div className={styles.empty}>No selection</div>
      </div>
    );
  }

  const t = node.transform;
  const s = node.style;

  const toggleKey = (property: AnimatableProperty, value: number) => {
    if (hasKeyframeAtTime(node, property, currentTime)) {
      removeKeyframe(nodeId, property, currentTime);
      return;
    }
    setKeyframe(nodeId, property, currentTime, value);
  };

  return (
    <div className={styles.panel}>
      {/* Transform */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Transform</div>
        <div className={styles.row}>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>X</span>
            <NumericInput
              className={styles.fieldInput}
              label="X position"
              value={t.x}
              onChange={(v) => updateTransform(nodeId, { x: v })}
            />
            <button className={styles.actionButton} type="button" onClick={() => toggleKey('x', t.x)}>K</button>
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Y</span>
            <NumericInput
              className={styles.fieldInput}
              label="Y position"
              value={t.y}
              onChange={(v) => updateTransform(nodeId, { y: v })}
            />
            <button className={styles.actionButton} type="button" onClick={() => toggleKey('y', t.y)}>K</button>
          </div>
        </div>
        <div className={styles.row}>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>W</span>
            <NumericInput
              className={styles.fieldInput}
              label="Width"
              value={t.width}
              onChange={(v) => updateTransform(nodeId, { width: v })}
              min={1}
            />
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>H</span>
            <NumericInput
              className={styles.fieldInput}
              label="Height"
              value={t.height}
              onChange={(v) => updateTransform(nodeId, { height: v })}
              min={1}
            />
          </div>
        </div>
        <div className={styles.row}>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Rotation</span>
            <NumericInput
              className={styles.fieldInput}
              label="Rotation"
              value={t.rotation}
              onChange={(v) => updateTransform(nodeId, { rotation: v })}
              precision={1}
            />
            <button className={styles.actionButton} type="button" onClick={() => toggleKey('rotation', t.rotation)}>K</button>
          </div>
        </div>
        <div className={styles.row}>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Scale X</span>
            <NumericInput className={styles.fieldInput} label="Scale X" value={t.scaleX} onChange={(v) => updateTransform(nodeId, { scaleX: v })} precision={3} />
            <button className={styles.actionButton} type="button" onClick={() => toggleKey('scaleX', t.scaleX)}>K</button>
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Scale Y</span>
            <NumericInput className={styles.fieldInput} label="Scale Y" value={t.scaleY} onChange={(v) => updateTransform(nodeId, { scaleY: v })} precision={3} />
            <button className={styles.actionButton} type="button" onClick={() => toggleKey('scaleY', t.scaleY)}>K</button>
          </div>
        </div>
      </div>

      {/* Style */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Fill</div>
        <div className={styles.colorRow}>
          <input
            className={styles.colorSwatch}
            type="color"
            value={s.fill.color}
            onChange={(e) =>
              updateStyle(nodeId, { fill: { ...s.fill, color: e.target.value } })
            }
          />
          <input
            className={styles.colorInput}
            type="text"
            value={s.fill.color}
            onChange={(e) =>
              updateStyle(nodeId, { fill: { ...s.fill, color: e.target.value } })
            }
          />
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Opacity</div>
        <div className={styles.row}>
          <div className={styles.field}>
            <NumericInput
              className={styles.fieldInput}
              label="Opacity"
              value={s.opacity * 100}
              onChange={(v) => updateStyle(nodeId, { opacity: v / 100 })}
              min={0}
              max={100}
            />
            <button className={styles.actionButton} type="button" onClick={() => toggleKey('opacity', s.opacity)}>K</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function getArrangableSelection(
  document: Document,
  selectedIds: Set<string>,
): ArrangableNode[] {
  const scene = buildSceneGraph(document);
  return [...selectedIds]
    .map((id) => {
      const renderNode = findRenderNode(scene, id);
      const node = document.nodes[id];
      if (!renderNode || !node) return null;
      return {
        id,
        bounds: getRenderNodeBounds(renderNode),
        transform: node.transform,
      };
    })
    .filter((entry): entry is ArrangableNode => entry !== null);
}
