/**
 * PixiJS 8 renderer — manages the Pixi application, renders scene nodes.
 * Completely decoupled from React.
 */

import { Application, Container, Graphics } from 'pixi.js';
import type { RenderNode } from '@/engine/scene';
import type { SceneNode } from '@/document/types';

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
  renderDocBackground(docWidth: number, docHeight: number, color: number = 0x1a1a2e): void {
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

    this.drawShape(gfx, node);
  }

  private drawShape(gfx: Graphics, node: SceneNode): void {
    const { width, height } = node.transform;
    const { fill, stroke, cornerRadius } = node.style;

    // Fill
    if (fill.opacity > 0) {
      if (node.type === 'ellipse') {
        gfx.ellipse(width / 2, height / 2, width / 2, height / 2);
      } else if (cornerRadius > 0) {
        gfx.roundRect(0, 0, width, height, cornerRadius);
      } else {
        gfx.rect(0, 0, width, height);
      }
      gfx.fill({ color: fill.color, alpha: fill.opacity });
    }

    // Stroke
    if (stroke && stroke.opacity > 0 && stroke.width > 0) {
      if (node.type === 'ellipse') {
        gfx.ellipse(width / 2, height / 2, width / 2, height / 2);
      } else if (cornerRadius > 0) {
        gfx.roundRect(0, 0, width, height, cornerRadius);
      } else {
        gfx.rect(0, 0, width, height);
      }
      gfx.stroke({ color: stroke.color, alpha: stroke.opacity, width: stroke.width });
    }
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
