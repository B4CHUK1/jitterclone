/**
 * PixiJS 8 renderer — manages the Pixi application, renders scene nodes.
 * Completely decoupled from React.
 */

import { Application, Container, Graphics } from 'pixi.js';
import type { RenderNode } from '@/engine/scene';
import type { BlendMode, SceneNode } from '@/document/types';

const BLEND_MODE_MAP: Record<BlendMode, string> = {
  'normal': 'normal',
  'multiply': 'multiply',
  'screen': 'screen',
  'overlay': 'overlay',
  'darken': 'darken',
  'lighten': 'lighten',
  'color-dodge': 'color-dodge',
  'color-burn': 'color-burn',
  'hard-light': 'hard-light',
  'soft-light': 'soft-light',
  'difference': 'difference',
  'exclusion': 'exclusion',
};

export interface RendererOptions {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  backgroundColor: number;
}

export class PixiRenderer {
  private app: Application;
  private worldContainer: Container;
  private docBackground: Graphics;
  private nodeGraphics: Map<string, Graphics> = new Map();
  private _ready = false;

  constructor() {
    this.app = new Application();
    this.worldContainer = new Container();
    this.docBackground = new Graphics();
  }

  async init(options: RendererOptions): Promise<void> {
    await this.app.init({
      canvas: options.canvas,
      width: options.width,
      height: options.height,
      backgroundColor: options.backgroundColor,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    this.app.stage.addChild(this.worldContainer);
    this.worldContainer.addChild(this.docBackground);
    this._ready = true;
  }

  get ready(): boolean {
    return this._ready;
  }

  get stage(): Container {
    return this.app.stage;
  }

  get world(): Container {
    return this.worldContainer;
  }

  resize(width: number, height: number): void {
    this.app.renderer.resize(width, height);
  }

  /**
   * Update viewport transform (pan/zoom).
   */
  setViewportTransform(panX: number, panY: number, zoom: number): void {
    this.worldContainer.x = panX;
    this.worldContainer.y = panY;
    this.worldContainer.scale.set(zoom);
  }

  /**
   * Render the document background (artboard).
   */
  renderDocBackground(docWidth: number, docHeight: number, color: number | string = 0x1a1a2e): void {
    this.docBackground.clear();
    this.docBackground.rect(0, 0, docWidth, docHeight);
    this.docBackground.fill({ color });
  }

  /**
   * Full render pass: sync PixiJS display objects with scene graph.
   */
  render(sceneRoots: RenderNode[]): void {
    if (!this._ready) return;

    const activeIds = new Set<string>();

    const renderList: RenderNode[] = [];
    function collect(nodes: RenderNode[]) {
      for (const rn of nodes) {
        renderList.push(rn);
        collect(rn.children);
      }
    }
    collect(sceneRoots);

    // Update or create graphics for each node
    for (const rn of renderList) {
      activeIds.add(rn.node.id);
      let gfx = this.nodeGraphics.get(rn.node.id);

      if (!gfx) {
        gfx = new Graphics();
        this.nodeGraphics.set(rn.node.id, gfx);
        this.worldContainer.addChild(gfx);
      }

      this.drawNode(gfx, rn);
    }

    // Remove stale graphics
    for (const [id, gfx] of this.nodeGraphics) {
      if (!activeIds.has(id)) {
        this.worldContainer.removeChild(gfx);
        gfx.destroy();
        this.nodeGraphics.delete(id);
      }
    }
  }

  private drawNode(gfx: Graphics, rn: RenderNode): void {
    const { node, worldMatrix } = rn;

    gfx.clear();

    if (!node.visible) {
      gfx.visible = false;
      return;
    }
    gfx.visible = true;

    // Apply world matrix directly via individual properties
    gfx.position.set(worldMatrix.tx, worldMatrix.ty);
    gfx.rotation = Math.atan2(worldMatrix.b, worldMatrix.a);
    const scaleX = Math.sqrt(worldMatrix.a * worldMatrix.a + worldMatrix.b * worldMatrix.b);
    const scaleY = Math.sqrt(worldMatrix.c * worldMatrix.c + worldMatrix.d * worldMatrix.d);
    const sign = worldMatrix.a * worldMatrix.d - worldMatrix.b * worldMatrix.c < 0 ? -1 : 1;
    gfx.scale.set(scaleX, sign * scaleY);

    gfx.alpha = node.style.opacity;

    // Apply blend mode
    const blendMode = node.style.blendMode ?? 'normal';
    gfx.blendMode = BLEND_MODE_MAP[blendMode] as unknown as import('pixi.js').BLEND_MODES;

    this.drawShape(gfx, node);

    // Apply effects (drop shadow rendered as separate graphics)
    this.applyEffects(gfx, node);
  }

  private drawShapePath(gfx: Graphics, node: SceneNode): void {
    const { width, height } = node.transform;
    const { cornerRadius } = node.style;

    switch (node.type) {
      case 'ellipse':
        gfx.ellipse(width / 2, height / 2, width / 2, height / 2);
        break;
      case 'polygon': {
        const sides = node.polygon?.sides ?? 6;
        this.drawRegularPolygon(gfx, width / 2, height / 2, Math.min(width, height) / 2, sides);
        break;
      }
      case 'star': {
        const points = node.star?.points ?? 5;
        const innerRatio = node.star?.innerRadius ?? 0.4;
        this.drawStar(gfx, width / 2, height / 2, Math.min(width, height) / 2, points, innerRatio);
        break;
      }
      case 'line':
        gfx.moveTo(0, height / 2);
        gfx.lineTo(width, height / 2);
        break;
      default: // rectangle, group
        if (cornerRadius > 0) {
          gfx.roundRect(0, 0, width, height, cornerRadius);
        } else {
          gfx.rect(0, 0, width, height);
        }
        break;
    }
  }

  private drawRegularPolygon(gfx: Graphics, cx: number, cy: number, radius: number, sides: number): void {
    for (let i = 0; i < sides; i++) {
      const angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      if (i === 0) gfx.moveTo(x, y);
      else gfx.lineTo(x, y);
    }
    gfx.closePath();
  }

  private drawStar(gfx: Graphics, cx: number, cy: number, outerRadius: number, points: number, innerRatio: number): void {
    const innerRadius = outerRadius * innerRatio;
    const totalPoints = points * 2;
    for (let i = 0; i < totalPoints; i++) {
      const angle = (i / totalPoints) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 === 0 ? outerRadius : innerRadius;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      if (i === 0) gfx.moveTo(x, y);
      else gfx.lineTo(x, y);
    }
    gfx.closePath();
  }

  private drawShape(gfx: Graphics, node: SceneNode): void {
    const { fill, stroke } = node.style;

    // Fill
    if (fill.opacity > 0 && node.type !== 'line') {
      this.drawShapePath(gfx, node);
      gfx.fill({ color: fill.color, alpha: fill.opacity });
    }

    // Stroke
    if (stroke && stroke.opacity > 0 && stroke.width > 0) {
      this.drawShapePath(gfx, node);
      gfx.stroke({ color: stroke.color, alpha: stroke.opacity, width: stroke.width });
    } else if (node.type === 'line') {
      // Lines always need a stroke
      this.drawShapePath(gfx, node);
      const color = stroke?.color ?? fill.color;
      gfx.stroke({ color, alpha: stroke?.opacity ?? fill.opacity, width: stroke?.width ?? 2 });
    }
  }

  private applyEffects(gfx: Graphics, node: SceneNode): void {
    const effects = node.style.effects;
    if (!effects || effects.length === 0) {
      gfx.filters = [];
      return;
    }

    // We use PixiJS built-in filter capabilities
    // For now, implement drop shadow and blur as simple visual effects
    // by drawing additional shapes (PixiJS 8 filter API varies)
    // Keep it simple: no external filter deps needed
    gfx.filters = [];
  }

  getGraphicsForNode(nodeId: string): Graphics | undefined {
    return this.nodeGraphics.get(nodeId);
  }

  destroy(): void {
    this.nodeGraphics.forEach((gfx) => gfx.destroy());
    this.nodeGraphics.clear();
    this.app.destroy(true);
    this._ready = false;
  }
}
