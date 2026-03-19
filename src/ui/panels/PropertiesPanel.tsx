import { useEditorStore, useDocumentStore } from '@/state';
import { NumericInput } from '@/ui/components/NumericInput';
import styles from './PropertiesPanel.module.css';

export function PropertiesPanel() {
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const document = useDocumentStore((s) => s.document);
  const updateTransform = useDocumentStore((s) => s.updateTransform);
  const updateStyle = useDocumentStore((s) => s.updateStyle);

  if (selectedIds.size === 0) {
    return (
      <div className={styles.panel}>
        <div className={styles.empty}>No selection</div>
      </div>
    );
  }

  if (selectedIds.size > 1) {
    return (
      <div className={styles.panel}>
        <div className={styles.empty}>{selectedIds.size} elements</div>
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
