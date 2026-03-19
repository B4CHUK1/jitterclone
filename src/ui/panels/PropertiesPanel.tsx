import { useEditorStore, useDocumentStore } from '@/state';
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

  const setT = (key: string, value: string) => {
    const num = parseFloat(value);
    if (!isNaN(num)) {
      updateTransform(nodeId, { [key]: num });
    }
  };

  return (
    <div className={styles.panel}>
      {/* Transform */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Transform</div>
        <div className={styles.row}>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>X</span>
            <input
              className={styles.fieldInput}
              type="number"
              value={Math.round(t.x)}
              onChange={(e) => setT('x', e.target.value)}
            />
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Y</span>
            <input
              className={styles.fieldInput}
              type="number"
              value={Math.round(t.y)}
              onChange={(e) => setT('y', e.target.value)}
            />
          </div>
        </div>
        <div className={styles.row}>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>W</span>
            <input
              className={styles.fieldInput}
              type="number"
              value={Math.round(t.width)}
              onChange={(e) => setT('width', e.target.value)}
              min={1}
            />
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>H</span>
            <input
              className={styles.fieldInput}
              type="number"
              value={Math.round(t.height)}
              onChange={(e) => setT('height', e.target.value)}
              min={1}
            />
          </div>
        </div>
        <div className={styles.row}>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Rotation</span>
            <input
              className={styles.fieldInput}
              type="number"
              value={Math.round(t.rotation * 10) / 10}
              onChange={(e) => setT('rotation', e.target.value)}
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
            onChange={(e) => updateStyle(nodeId, { fill: { ...s.fill, color: e.target.value } })}
          />
          <input
            className={styles.colorInput}
            type="text"
            value={s.fill.color}
            onChange={(e) => updateStyle(nodeId, { fill: { ...s.fill, color: e.target.value } })}
          />
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Opacity</div>
        <div className={styles.row}>
          <div className={styles.field}>
            <input
              className={styles.fieldInput}
              type="number"
              value={Math.round(s.opacity * 100)}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (!isNaN(v)) updateStyle(nodeId, { opacity: Math.max(0, Math.min(100, v)) / 100 });
              }}
              min={0}
              max={100}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
