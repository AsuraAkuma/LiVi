/**
 * RaycastEngine.ts
 * 
 * Implements raycasting from the camera through the tracked index finger tip
 * to detect intersections with a virtual 2D text plane.
 * 
 * Calculates UV coordinates and local positions for hit detection.
 * 
 * SCENE SETUP INSTRUCTIONS:
 * 1. Create a SceneObject to represent your virtual text plane (e.g., "TextPlane")
 * 2. Add a Mesh or Plane primitive to this object
 * 3. Ensure the plane has a Collider component (or we'll use geometric plane intersection)
 * 4. In Lens Studio Inspector, link this object to this script's 'textPlane' field
 * 5. Link your Main Camera to the 'mainCamera' field
 * 6. The plane should be anchored to your tracked book/page in world space
 */

import { Component, Serializable, Vec3, Ray } from '@lens-studio/snapchat-sdk';

interface PlaneIntersection {
  hit: boolean;
  position: Vec3;
  localPosition: Vec3;
  uvCoordinates: Vec2;
  distance: number;
  normal: Vec3;
}

interface Vec2 {
  x: number;
  y: number;
}

@Component
export class RaycastEngine {
  /**
   * INSPECTOR LINK: Drag your TextPlane SceneObject here
   * This should be the 2D plane that represents your reading surface
   */
  @Serializable({ displayName: 'Text Plane Reference' })
  textPlane: any; // SceneObject

  /**
   * INSPECTOR LINK: Drag your Main Camera here
   * The ray will originate from this camera's position through the finger
   */
  @Serializable({ displayName: 'Main Camera Reference' })
  mainCamera: any; // Camera

  /**
   * Plane size (in local space) for UV coordinate calculation
   * X = width, Y = height. Adjust based on your actual plane dimensions
   */
  @Serializable({ displayName: 'Plane Width (units)' })
  planeWidth: number = 2.0;

  @Serializable({ displayName: 'Plane Height (units)' })
  planeHeight: number = 3.0;

  /**
   * Maximum raycast distance (prevent casting infinitely far)
   */
  @Serializable({ displayName: 'Max Raycast Distance' })
  maxRaycastDistance: number = 100.0;

  /**
   * Debug visualization flag (enable to see raycast lines in editor)
   */
  @Serializable({ displayName: 'Debug Visualization' })
  debugVisualization: boolean = false;

  /**
   * Initialize the raycast engine
   */
  onAwake(): void {
    if (!this.textPlane) {
      console.error('RaycastEngine: textPlane reference not assigned in Inspector');
    }
    if (!this.mainCamera) {
      console.error('RaycastEngine: mainCamera reference not assigned in Inspector');
    }
    console.log('RaycastEngine initialized');
  }

  /**
   * PUBLIC API: Cast a ray from camera through finger position to text plane
   * Returns intersection data including UV coordinates
   */
  raycastFingerToPlane(fingerPosition: Vec3): PlaneIntersection {
    if (!this.mainCamera || !this.textPlane) {
      return this.getDefaultIntersection();
    }

    // Step 1: Create ray from camera through finger tip
    // Ray direction: normalized vector from camera to finger
    const cameraPos = this.mainCamera.transform.position;
    const rayDirection = Vec3.subtract(fingerPosition, cameraPos).normalize();

    // Step 2: Construct ray object
    const ray = new Ray(cameraPos, rayDirection);

    // Step 3: Perform intersection with plane geometry
    const planeTransform = this.textPlane.transform;
    const intersection = this.intersectRayWithPlane(ray, planeTransform);

    // Step 4: If hit, calculate UV coordinates
    if (intersection.hit) {
      intersection.uvCoordinates = this.calculateUVCoordinates(
        intersection.localPosition,
        this.planeWidth,
        this.planeHeight
      );

      // Debug visualization
      if (this.debugVisualization) {
        this.drawDebugRay(cameraPos, intersection.position);
      }
    }

    return intersection;
  }

  /**
   * Intersect a ray with a plane at the given transform
   * Plane normal points along its local Z-axis
   * Plane center is at the transform origin
   */
  private intersectRayWithPlane(ray: Ray, planeTransform: any): PlaneIntersection {
    // Get plane's world normal (local Z-axis)
    const planeNormal = planeTransform.forward; // Z-axis in world space

    // Get plane's world center position
    const planeCenter = planeTransform.position;

    // Plane equation: dot(normal, point - planeCenter) = 0
    // Ray equation: point = ray.origin + t * ray.direction

    // Solve for t:
    const denominator = Vec3.dot(planeNormal, ray.direction);

    // Check if ray is parallel to plane
    if (Math.abs(denominator) < 0.0001) {
      return this.getDefaultIntersection();
    }

    const toPlane = Vec3.subtract(planeCenter, ray.origin);
    const t = Vec3.dot(toPlane, planeNormal) / denominator;

    // Check if intersection is behind ray or too far
    if (t < 0 || t > this.maxRaycastDistance) {
      return this.getDefaultIntersection();
    }

    // Calculate world intersection point
    const hitPoint = Vec3.add(ray.origin, Vec3.scale(ray.direction, t));

    // Convert to local space of plane
    const localHitPoint = planeTransform.worldToLocalMatrix.multiplyPoint(hitPoint);

    // Check if hit point is within plane bounds
    const halfWidth = this.planeWidth / 2;
    const halfHeight = this.planeHeight / 2;

    if (Math.abs(localHitPoint.x) > halfWidth || Math.abs(localHitPoint.y) > halfHeight) {
      return this.getDefaultIntersection();
    }

    return {
      hit: true,
      position: hitPoint,
      localPosition: localHitPoint,
      uvCoordinates: { x: 0, y: 0 }, // Will be calculated by caller
      distance: t,
      normal: planeNormal,
    };
  }

  /**
   * Calculate UV coordinates (0.0-1.0 range) from local plane position
   * UV (0,0) = bottom-left, UV (1,1) = top-right
   */
  private calculateUVCoordinates(
    localPosition: Vec3,
    planeWidth: number,
    planeHeight: number
  ): Vec2 {
    const halfWidth = planeWidth / 2;
    const halfHeight = planeHeight / 2;

    // Map from [-halfWidth, halfWidth] to [0, 1]
    const u = (localPosition.x + halfWidth) / planeWidth;

    // Map from [-halfHeight, halfHeight] to [0, 1]
    const v = (localPosition.y + halfHeight) / planeHeight;

    return {
      x: Math.max(0, Math.min(1, u)),
      y: Math.max(0, Math.min(1, v)),
    };
  }

  /**
   * Debug helper: Draw ray line in editor
   */
  private drawDebugRay(origin: Vec3, end: Vec3): void {
    // In production Lens Studio, use Debug.drawLine or similar
    // This is a placeholder for visualization
    console.log(`[DEBUG] Ray from ${JSON.stringify(origin)} to ${JSON.stringify(end)}`);
  }

  /**
   * Get default (no-hit) intersection result
   */
  private getDefaultIntersection(): PlaneIntersection {
    return {
      hit: false,
      position: Vec3.zero(),
      localPosition: Vec3.zero(),
      uvCoordinates: { x: 0, y: 0 },
      distance: -1,
      normal: Vec3.zero(),
    };
  }

  /**
   * PUBLIC API: Get intersection in a single call with finger position
   * This is a convenience method that combines data from FingerTracker
   */
  getPlaneIntersection(fingerPosition: Vec3): PlaneIntersection {
    return this.raycastFingerToPlane(fingerPosition);
  }

  /**
   * PUBLIC API: Check if a point (in UV space) is within a bounding box
   * Useful for word/region detection
   */
  isPointInBoundingBox(
    uvPoint: Vec2,
    boxMin: Vec2,
    boxMax: Vec2
  ): boolean {
    return (
      uvPoint.x >= boxMin.x &&
      uvPoint.x <= boxMax.x &&
      uvPoint.y >= boxMin.y &&
      uvPoint.y <= boxMax.y
    );
  }

  /**
   * PUBLIC API: Recalculate plane dimensions
   * Call this if your physical plane changes size
   */
  setPlaneSize(width: number, height: number): void {
    this.planeWidth = width;
    this.planeHeight = height;
  }
}
