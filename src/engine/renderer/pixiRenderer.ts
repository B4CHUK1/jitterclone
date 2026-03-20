/**
 * PixiJS 8 renderer — manages the Pixi application, renders scene nodes.
 * Completely decoupled from React.
 */

import { Application, Container, Graphics, BlurFilter } from 'pixi.js';
import type { RenderNode } from '@/engine/scene';
import type { BlendMode, Effect, SceneNode } from '@/document/types';

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

interface NodeDisplayObjects {
  container: Container;
  shadow: Graphics | null;
  main: Graphics;
}

export class PixiRenderer {
  private app: Application;
  private worldContainer: Container;
  private docBackground: Graphics;
  private nodeDisplays: Map<string, NodeDisplayObjects> = new Map();
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

    // Update or create display objects for each node
    for (let i = 0; i < renderList.length; i++) {
      const rn = renderList[i]!;
      activeIds.add(rn.node.id);
      let display = this.nodeDisplays.get(rn.node.id);

      if (!display) {
        const container = new Container();
        const main = new Graphics();
        container.addChild(main);
        display = { container, shadow: null, main };
        this.nodeDisplays.set(rn.node.id, display);
        this.worldContainer.addChild(container);
      }

      this.drawNode(display, rn);
      // Ensure correct z-order
      this.worldContainer.setChildIndex(display.container, i + 1); // +1 for docBackground
    }

    // Remove stale display objects
    for (const [id, display] of this.nodeDisplays) {
      if (!activeIds.has(id)) {
        this.worldContainer.removeChild(display.container);
        display.container.destroy({ children: true });
        this.nodeDisplays.delete(id);
      }
    }
  }

  private drawNode(display: NodeDisplayObjects, rn: RenderNode): void {
    const { node, worldMatrix } = rn;
    const { container, main } = display;

    main.clear();

    if (!node.visible) {
      container.visible = false;
      return;
    }
    container.visible = true;

    // Apply world matrix to the container
    container.position.set(worldMatrix.tx, worldMatrix.ty);
    container.rotation = Math.atan2(worldMatrix.b, worldMatrix.a);
    const scaleX = Math.sqrt(worldMatrix.a * worldMatrix.a + worldMatrix.b * worldMatrix.b);
    const scaleY = Math.sqrt(worldMatrix.c * worldMatrix.c + worldMatrix.d * worldMatrix.d);
    const sign = worldMatrix.a * worldMatrix.d - worldMatrix.b * worldMatrix.c < 0 ? -1 : 1;
    container.scale.set(scaleX, sign * scaleY);

    container.alpha = node.style?.opacity ?? 1;

    // Apply blend mode
    const blendMode = node.style?.blendMode ?? 'normal';
    const pixiBlendMode = BLEND_MODE_MAP[blendMode] ?? 'normal';
    container.blendMode = pixiBlendMode as never;

    // Draw the main shape
    this.drawShape(main, node);

    // Handle effects
    this.applyEffects(display, node);
  }

  private applyEffects(display: NodeDisplayObjects, node: SceneNode): void {
    const effects = node.style?.effects ?? [];

    // Handle drop shadow
    const shadowEffect = effects.find((e): e is Extract<Effect, { type: 'drop-shadow' }> => e.type === 'drop-shadow');
    if (shadowEffect) {
      if (!display.shadow) {
        display.shadow = new Graphics();
        // Insert shadow before main shape
        display.container.addChildAt(display.shadow, 0);
      }
      display.shadow.clear();
      display.shadow.visible = true;
      // Draw the same shape for the shadow
      this.drawShapePath(display.shadow, node);
      const shadowColor = shadowEffect.color ?? '#000000';
      display.shadow.fill({ color: shadowColor, alpha: shadowEffect.opacity ?? 0.5 });
      display.shadow.position.set(shadowEffect.offsetX, shadowEffect.offsetY);
      // Apply blur filter to shadow — explicit padding prevents clipping
      const blurAmount = shadowEffect.blur ?? 0;
      if (blurAmount > 0) {
        const shadowFilter = new BlurFilter({
          strength: blurAmount,
          quality: 4,
          padding: Math.ceil(blurAmount * 3),
        });
        display.shadow.filters = [shadowFilter];
      } else {
        display.shadow.filters = [];
      }
    } else if (display.shadow) {
      display.shadow.visible = false;
      display.shadow.filters = [];
    }

    // Handle gaussian blur.
    // Apply to the container so the blurred output can expand beyond the shape's bounds.
    // Explicit padding prevents the blur from being clipped at the shape edges.
    const blurEffect = effects.find((e): e is Extract<Effect, { type: 'blur' }> => e.type === 'blur');
    if (blurEffect && blurEffect.radius > 0) {
      const blurFilter = new BlurFilter({
        strength: blurEffect.radius,
        quality: 4,
        padding: Math.ceil(blurEffect.radius * 3),
      });
      display.container.filters = [blurFilter];
    } else {
      display.container.filters = [];
    }
    // Never apply a separate blur to main — container-level is authoritative
    display.main.filters = [];
  }

  private drawShapePath(gfx: Graphics, node: SceneNode): void {
    const { width, height } = node.transform;
    const cornerRadius = node.style?.cornerRadius ?? 0;

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
      case 'path': {
        const pathData = node.pathData;
        if (pathData && pathData.length > 1) {
          // Path points are stored in normalized [0,1] space relative to width/height
          gfx.moveTo(pathData[0]!.x * width, pathData[0]!.y * height);
          for (let i = 1; i < pathData.length; i++) {
            gfx.lineTo(pathData[i]!.x * width, pathData[i]!.y * height);
          }
        }
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
    const fill = node.style?.fill;
    const stroke = node.style?.stroke;

    if (!fill) return;

    // Fill
    if (fill.opacity > 0 && node.type !== 'line') {
      this.drawShapePath(gfx, node);
      gfx.fill({ color: fill.color, alpha: fill.opacity });
    }

    // Stroke
    if (stroke && stroke.opacity > 0 && stroke.width > 0) {
      this.drawShapePath(gfx, node);
      gfx.stroke({ color: stroke.color, alpha: stroke.opacity, width: stroke.width });
    } else if (node.type === 'line' || node.type === 'path') {
      // Lines and paths always need a stroke
      this.drawShapePath(gfx, node);
      const color = stroke?.color ?? fill.color ?? '#ffffff';
      gfx.stroke({ color, alpha: stroke?.opacity ?? fill.opacity ?? 1, width: stroke?.width ?? 3 });
    }
  }

  getGraphicsForNode(nodeId: string): Graphics | undefined {
    return this.nodeDisplays.get(nodeId)?.main;
  }

  destroy(): void {
    this.nodeDisplays.forEach((display) => display.container.destroy({ children: true }));
    this.nodeDisplays.clear();
    this.app.destroy(true);
    this._ready = false;
  }
}
