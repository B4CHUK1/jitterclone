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
import type { Document, BlendMode } from '@/document/types';
import type { AnimatableProperty } from '@/document/types';
import { evaluateNodeAtTime, hasKeyframeAtTime, isPropertyAnimated, globalToLocalTime } from '@/engine/animation';
import { ANIMATION_PRESETS } from '@/engine/animation/presets';
import { useEditorStore, useDocumentStore, useTimelineStore } from '@/state';
import { NumericInput } from '@/ui/components/NumericInput';
import styles from './PropertiesPanel.module.css';

const BLEND_MODES: BlendMode[] = [
  'normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten',
  'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference', 'exclusion',
];

export function PropertiesPanel() {
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const document = useDocumentStore((s) => s.document);
  const updateTransform = useDocumentStore((s) => s.updateTransform);
  const updateTransforms = useDocumentStore((s) => s.updateTransforms);
  const updateStyle = useDocumentStore((s) => s.updateStyle);
  const updateComposition = useDocumentStore((s) => s.updateComposition);
  const setAnimatableValue = useDocumentStore((s) => s.setAnimatableValue);
  const togglePropertyStopwatch = useDocumentStore((s) => s.togglePropertyStopwatch);
  const addKeyframeAtCurrentTime = useDocumentStore((s) => s.addKeyframeAtCurrentTime);
  const currentTime = useTimelineStore((s) => s.currentTime);
  const autoKeyframe = useTimelineStore((s) => s.autoKeyframe);

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
            <button type="button" className={styles.actionButton} disabled={!canRunAlign} onClick={() => runAlign('left')}>Left</button>
            <button type="button" className={styles.actionButton} disabled={!canRunAlign} onClick={() => runAlign('h-center')}>H-Center</button>
            <button type="button" className={styles.actionButton} disabled={!canRunAlign} onClick={() => runAlign('right')}>Right</button>
            <button type="button" className={styles.actionButton} disabled={!canRunAlign} onClick={() => runAlign('top')}>Top</button>
            <button type="button" className={styles.actionButton} disabled={!canRunAlign} onClick={() => runAlign('v-center')}>V-Center</button>
            <button type="button" className={styles.actionButton} disabled={!canRunAlign} onClick={() => runAlign('bottom')}>Bottom</button>
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionTitle}>Distribute</div>
          <div className={styles.row}>
            <button type="button" className={styles.actionButton} disabled={!canRunHDistribute} onClick={() => runDistribute('h-spacing')}>Horizontal spacing</button>
            <button type="button" className={styles.actionButton} disabled={!canRunVDistribute} onClick={() => runDistribute('v-spacing')}>Vertical spacing</button>
          </div>
        </div>
      </div>
    );
  }

  const nodeId = [...selectedIds][0]!;
  const node = document.nodes[nodeId];
  if (!node) {
    return <div className={styles.panel}><div className={styles.empty}>No selection</div></div>;
  }

  const addEffect = useDocumentStore((s) => s.addEffect);
  const removeEffect = useDocumentStore((s) => s.removeEffect);
  const applyPreset = useDocumentStore((s) => s.applyPreset);

  const evaluatedNode = evaluateNodeAtTime(node, currentTime);
  const t = evaluatedNode.transform;
  const s = evaluatedNode.style;

  const setProperty = (property: AnimatableProperty, value: number) => {
    setAnimatableValue(nodeId, property, value, currentTime, autoKeyframe);
  };

  const stopwatch = (property: AnimatableProperty) => (
    <button
      className={styles.actionButton}
      type="button"
      onClick={() => togglePropertyStopwatch(nodeId, property, currentTime)}
      title={isPropertyAnimated(node, property) ? 'Disable animation' : 'Enable animation'}
    >
      {isPropertyAnimated(node, property) ? '⏱ On' : '⏱ Off'}
    </button>
  );

  const keyButton = (property: AnimatableProperty) => (
    <button className={styles.actionButton} type="button" onClick={() => addKeyframeAtCurrentTime(nodeId, property, currentTime)}>
      {hasKeyframeAtTime(node, property, globalToLocalTime(currentTime, node)) ? '● Key' : '+ Key'}
    </button>
  );

  return (
    <div className={styles.panel}>
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Transform</div>
        <div className={styles.row}>
          <div className={styles.field}><span className={styles.fieldLabel}>X</span><NumericInput className={styles.fieldInput} label="X position" value={t.x} onChange={(v) => setProperty('x', v)} />{stopwatch('x')}{keyButton('x')}</div>
          <div className={styles.field}><span className={styles.fieldLabel}>Y</span><NumericInput className={styles.fieldInput} label="Y position" value={t.y} onChange={(v) => setProperty('y', v)} />{stopwatch('y')}{keyButton('y')}</div>
        </div>
        <div className={styles.row}>
          <div className={styles.field}><span className={styles.fieldLabel}>W</span><NumericInput className={styles.fieldInput} label="Width" value={t.width} onChange={(v) => updateTransform(nodeId, { width: v })} min={1} /></div>
          <div className={styles.field}><span className={styles.fieldLabel}>H</span><NumericInput className={styles.fieldInput} label="Height" value={t.height} onChange={(v) => updateTransform(nodeId, { height: v })} min={1} /></div>
        </div>
        <div className={styles.row}>
          <div className={styles.field}><span className={styles.fieldLabel}>Rotation</span><NumericInput className={styles.fieldInput} label="Rotation" value={t.rotation} onChange={(v) => setProperty('rotation', v)} precision={1} />{stopwatch('rotation')}{keyButton('rotation')}</div>
        </div>
        <div className={styles.row}>
          <div className={styles.field}><span className={styles.fieldLabel}>Scale X</span><NumericInput className={styles.fieldInput} label="Scale X" value={t.scaleX} onChange={(v) => setProperty('scaleX', v)} precision={3} />{stopwatch('scaleX')}{keyButton('scaleX')}</div>
          <div className={styles.field}><span className={styles.fieldLabel}>Scale Y</span><NumericInput className={styles.fieldInput} label="Scale Y" value={t.scaleY} onChange={(v) => setProperty('scaleY', v)} precision={3} />{stopwatch('scaleY')}{keyButton('scaleY')}</div>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Fill</div>
        <div className={styles.colorRow}>
          <input className={styles.colorSwatch} type="color" value={s.fill.color} onChange={(e) => updateStyle(nodeId, { fill: { ...s.fill, color: e.target.value } })} />
          <input className={styles.colorInput} type="text" value={s.fill.color} onChange={(e) => updateStyle(nodeId, { fill: { ...s.fill, color: e.target.value } })} />
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Opacity</div>
        <div className={styles.row}>
          <div className={styles.field}>
            <NumericInput className={styles.fieldInput} label="Opacity" value={s.opacity * 100} onChange={(v) => setProperty('opacity', v / 100)} min={0} max={100} />
            {stopwatch('opacity')}
            {keyButton('opacity')}
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Stroke</div>
        <div className={styles.row}>
          <div className={styles.field}>
            <button
              className={styles.actionButton}
              type="button"
              onClick={() => {
                if (node.style.stroke) {
                  updateStyle(nodeId, { stroke: null });
                } else {
                  updateStyle(nodeId, { stroke: { color: '#ffffff', width: 2, opacity: 1 } });
                }
              }}
            >
              {node.style.stroke ? 'Remove' : 'Add Stroke'}
            </button>
          </div>
        </div>
        {node.style.stroke && (
          <>
            <div className={styles.colorRow}>
              <input className={styles.colorSwatch} type="color" value={node.style.stroke.color} onChange={(e) => updateStyle(nodeId, { stroke: { ...node.style.stroke!, color: e.target.value } })} />
              <input className={styles.colorInput} type="text" value={node.style.stroke.color} onChange={(e) => updateStyle(nodeId, { stroke: { ...node.style.stroke!, color: e.target.value } })} />
            </div>
            <div className={styles.row}>
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Width</span>
                <NumericInput className={styles.fieldInput} label="Stroke width" value={node.style.stroke.width} min={0.5} precision={1} onChange={(v) => updateStyle(nodeId, { stroke: { ...node.style.stroke!, width: v } })} />
              </div>
            </div>
          </>
        )}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Corner Radius</div>
        <div className={styles.row}>
          <div className={styles.field}>
            <NumericInput className={styles.fieldInput} label="Corner radius" value={node.style.cornerRadius} min={0} onChange={(v) => updateStyle(nodeId, { cornerRadius: v })} />
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Blend Mode</div>
        <div className={styles.row}>
          <select
            className={styles.fieldInput}
            value={node.style.blendMode}
            onChange={(e) => updateStyle(nodeId, { blendMode: e.target.value as BlendMode })}
          >
            {BLEND_MODES.map((mode) => (
              <option key={mode} value={mode}>{mode}</option>
            ))}
          </select>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Effects</div>
        {node.style.effects.map((effect, idx) => (
          <div key={idx} className={styles.row}>
            <span className={styles.fieldLabel}>{effect.type}</span>
            <button className={styles.actionButton} type="button" onClick={() => removeEffect(nodeId, idx)}>Remove</button>
          </div>
        ))}
        <div className={styles.row}>
          <button className={styles.actionButton} type="button" onClick={() => addEffect(nodeId, { type: 'drop-shadow', offsetX: 4, offsetY: 4, blur: 8, color: '#000000', opacity: 0.5 })}>
            + Shadow
          </button>
          <button className={styles.actionButton} type="button" onClick={() => addEffect(nodeId, { type: 'blur', radius: 4 })}>
            + Blur
          </button>
        </div>
      </div>

      {node.type === 'polygon' && node.polygon && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Polygon</div>
          <div className={styles.row}>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Sides</span>
              <NumericInput className={styles.fieldInput} label="Sides" value={node.polygon.sides} min={3} max={12} onChange={(v) => {
                const doc = useDocumentStore.getState().document;
                const n = doc.nodes[nodeId];
                if (!n) return;
                useDocumentStore.setState({
                  document: {
                    ...doc,
                    nodes: { ...doc.nodes, [nodeId]: { ...n, polygon: { sides: Math.round(v) } } },
                  },
                });
              }} />
            </div>
          </div>
        </div>
      )}

      {node.type === 'star' && node.star && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Star</div>
          <div className={styles.row}>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Points</span>
              <NumericInput className={styles.fieldInput} label="Points" value={node.star.points} min={3} max={12} onChange={(v) => {
                const doc = useDocumentStore.getState().document;
                const n = doc.nodes[nodeId];
                if (!n) return;
                useDocumentStore.setState({
                  document: {
                    ...doc,
                    nodes: { ...doc.nodes, [nodeId]: { ...n, star: { ...n.star!, points: Math.round(v) } } },
                  },
                });
              }} />
            </div>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Inner R</span>
              <NumericInput className={styles.fieldInput} label="Inner radius" value={node.star.innerRadius} min={0.1} max={0.9} precision={2} onChange={(v) => {
                const doc = useDocumentStore.getState().document;
                const n = doc.nodes[nodeId];
                if (!n) return;
                useDocumentStore.setState({
                  document: {
                    ...doc,
                    nodes: { ...doc.nodes, [nodeId]: { ...n, star: { ...n.star!, innerRadius: v } } },
                  },
                });
              }} />
            </div>
          </div>
        </div>
      )}

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Animation Presets</div>
        <div className={styles.row}>
          <select
            className={styles.fieldInput}
            value=""
            onChange={(e) => {
              const presetName = e.target.value;
              if (!presetName) return;
              const preset = ANIMATION_PRESETS.find((p) => p.name === presetName);
              if (preset) applyPreset(nodeId, preset, currentTime);
              e.target.value = '';
            }}
          >
            <option value="">Apply preset...</option>
            <optgroup label="In">
              {ANIMATION_PRESETS.filter((p) => p.category === 'in').map((p) => (
                <option key={p.name} value={p.name}>{p.name}</option>
              ))}
            </optgroup>
            <optgroup label="Out">
              {ANIMATION_PRESETS.filter((p) => p.category === 'out').map((p) => (
                <option key={p.name} value={p.name}>{p.name}</option>
              ))}
            </optgroup>
            <optgroup label="Loop">
              {ANIMATION_PRESETS.filter((p) => p.category === 'loop').map((p) => (
                <option key={p.name} value={p.name}>{p.name}</option>
              ))}
            </optgroup>
          </select>
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
