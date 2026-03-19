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
import { useEditorStore, useDocumentStore } from '@/state';
import { NumericInput } from '@/ui/components/NumericInput';
import styles from './PropertiesPanel.module.css';

export function PropertiesPanel() {
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const document = useDocumentStore((s) => s.document);
  const updateTransform = useDocumentStore((s) => s.updateTransform);
  const updateTransforms = useDocumentStore((s) => s.updateTransforms);
  const updateStyle = useDocumentStore((s) => s.updateStyle);

  if (selectedIds.size === 0) {
    return (
      <div className={styles.panel}>
        <div className={styles.empty}>No selection</div>
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
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Y</span>
            <NumericInput
              className={styles.fieldInput}
              label="Y position"
              value={t.y}
              onChange={(v) => updateTransform(nodeId, { y: v })}
            />
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
