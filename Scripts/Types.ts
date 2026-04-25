/**
 * Types.ts
 * 
 * Type definitions and interfaces for the Spatial Reading Lens system
 */

export interface Vec2 {
  x: number;
  y: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
  clone(): Vec3;
}

export interface Transform {
  position: Vec3;
  forward: Vec3;
  worldToLocalMatrix: Matrix4;
}

export interface Matrix4 {
  multiplyPoint(point: Vec3): Vec3;
}

export interface PlaneIntersection {
  hit: boolean;
  position: Vec3;
  localPosition: Vec3;
  uvCoordinates: Vec2;
  distance: number;
  normal: Vec3;
}

export interface TrackedFingerData {
  position: Vec3;
  confidence: number;
  isTracking: boolean;
}

export interface WordRegionConfig {
  name: string;
  minUV: Vec2;
  maxUV: Vec2;
  eventName: string;
}

export interface WordRegion extends WordRegionConfig {
  isCurrentlyActive: boolean;
}

export interface IntersectionEventData {
  regionName: string;
  transitionType: 'onEnter' | 'onExit';
  uvPosition: Vec2;
  timestamp: number;
}

export interface EventData {
  eventName: string;
  timestamp: number;
  payload?: any;
}

// Ray definition for raycasting
export interface Ray {
  origin: Vec3;
  direction: Vec3;
}
