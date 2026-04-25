/**
 * lens-studio-sdk-shim.d.ts
 * 
 * Type definitions shim for @lens-studio/snapchat-sdk
 * This provides type hints during development.
 * When imported into Lens Studio 5.15.0, the real SDK will be used.
 */

declare module '@lens-studio/snapchat-sdk' {
  export class Component {}

  export function Component(target: any): void;

  export function Serializable(options?: { displayName?: string; min?: number; max?: number }): (target: any, propertyKey: string) => void;

  export interface Vec3 {
    x: number;
    y: number;
    z: number;
    clone(): Vec3;
    normalize(): Vec3;
  }

  export namespace Vec3 {
    function zero(): Vec3;
    function add(a: Vec3, b: Vec3): Vec3;
    function subtract(a: Vec3, b: Vec3): Vec3;
    function scale(v: Vec3, s: number): Vec3;
    function dot(a: Vec3, b: Vec3): number;
  }

  export interface Ray {
    origin: Vec3;
    direction: Vec3;
  }

  export class Ray {
    constructor(origin: Vec3, direction: Vec3);
  }

  export interface Transform {
    position: Vec3;
    forward: Vec3;
    worldToLocalMatrix: Matrix4;
  }

  export interface Matrix4 {
    multiplyPoint(point: Vec3): Vec3;
  }

  export interface HandTracker {
    confidence: number;
    getJoint(joint: HandJoint): HandJointData | null;
  }

  export enum HandJoint {
    INDEX_TIP = 'INDEX_TIP',
    THUMB_TIP = 'THUMB_TIP',
    MIDDLE_TIP = 'MIDDLE_TIP',
    RING_TIP = 'RING_TIP',
    PINKY_TIP = 'PINKY_TIP',
  }

  export interface HandJointData {
    position: Vec3;
    rotation: Quaternion;
  }

  export interface Quaternion {
    x: number;
    y: number;
    z: number;
    w: number;
  }

  export interface RaycastResult {
    hit: boolean;
    point: Vec3;
    distance: number;
  }

  export class Physics {
    static raycast(ray: Ray, distance: number): RaycastResult;
  }

  export interface SceneObject {
    transform: Transform;
    getComponent<T extends Component>(componentType: new () => T): T | null;
    addComponent<T extends Component>(componentType: new () => T): T;
  }

  // ── Image Processing Types ────────────────────────────────────────────────

  export class vec2 {
    x: number;
    y: number;
    constructor(x: number, y: number);
    clone(): vec2;
  }

  /**
   * Exposes shader uniforms as dynamic named properties.
   * Names must match the GLSL `uniform` declarations exactly.
   * e.g. pass.sharpnessAmount = 1.5; pass.cameraTexture = myTexture;
   */
  export interface Pass {
    [uniformName: string]: any;
  }

  export interface Material {
    readonly mainPass: Pass;
    clone(): Material;
  }

  /** Base interface for all Lens Studio texture assets. */
  export interface Texture {
    getWidth(): number;
    getHeight(): number;
    /** Underlying provider — cast to RenderTargetProvider for Render Target assets. */
    readonly control: TextureControl;
  }

  export interface TextureControl {}

  /**
   * Control object exposed by a Render Target texture asset.
   * copyFrame delivers raw RGBA pixels (Uint8Array, 4 bytes/pixel, row-major)
   * with one frame of GPU→CPU pipeline latency.
   */
  export interface RenderTargetProvider extends TextureControl {
    copyFrame(callback: (frame: Uint8Array) => void): void;
  }
}
