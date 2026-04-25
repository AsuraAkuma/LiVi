/**
 * SpatialReadingController.ts
 * 
 * Main orchestrator for the Spatial Reading Lens.
 * Integrates FingerTracker, RaycastEngine, and EventManager.
 * 
 * SCENE SETUP INSTRUCTIONS:
 * 1. Create a root SceneObject named "SpatialReadingController"
 * 2. Add this script as a Component to that object
 * 3. Assign all required scene objects in the Inspector:
 *    - Hand Tracker (passed to FingerTracker)
 *    - Main Camera (passed to RaycastEngine)
 *    - Text Plane (passed to RaycastEngine)
 * 4. Define your word regions in the Inspector (bounding boxes in UV space)
 * 5. Events will fire automatically when finger enters/exits regions
 */

import { Component, Serializable, Vec3, SceneObject } from '@lens-studio/snapchat-sdk';
import { FingerTracker } from './FingerTracker';
import { RaycastEngine } from './RaycastEngine';
import { EventManagerInstance, DebouncedEventEmitter } from './EventManager';

interface Vec2 {
  x: number;
  y: number;
}

/**
 * Represents a word region in UV space
 * Useful for text-based events (reading specific words)
 */
interface WordRegion {
  name: string;
  minUV: Vec2;
  maxUV: Vec2;
  isCurrentlyActive: boolean;
  eventName: string;
}

@Component
export class SpatialReadingController {
  /**
   * INSPECTOR LINK: Assign the SceneObject with FingerTracker component
   */
  @Serializable({ displayName: 'Finger Tracker Object' })
  fingerTrackerObject!: SceneObject;

  /**
   * INSPECTOR LINK: Assign the SceneObject with RaycastEngine component
   */
  @Serializable({ displayName: 'Raycast Engine Object' })
  raycastEngineObject!: SceneObject;

  /**
   * Debounce time for word region events (milliseconds)
   * Prevents rapid firing when finger lingers on a word
   */
  @Serializable({ displayName: 'Event Debounce Time (ms)' })
  eventDebounceTime: number = 200;

  /**
   * Enable debug logging to console
   */
  @Serializable({ displayName: 'Debug Logging' })
  debugLogging: boolean = true;

  // References to the sub-systems
  private fingerTracker: FingerTracker | null = null;
  private raycastEngine: RaycastEngine | null = null;
  private debouncedEmitter: DebouncedEventEmitter = new DebouncedEventEmitter(200);

  // Word regions for event detection
  private wordRegions: WordRegion[] = [];

  // Current intersection state
  private currentIntersection: any = null;
  private currentUVPosition: Vec2 = { x: -1, y: -1 };
  private isCurrentlyIntersecting: boolean = false;

  /**
   * Initialize the controller
   */
  onAwake(): void {
    this.log('SpatialReadingController initializing...');

    // Retrieve component references
    if (this.fingerTrackerObject) {
      this.fingerTracker = this.fingerTrackerObject.getComponent(FingerTracker);
      if (!this.fingerTracker) {
        this.log('ERROR: FingerTracker component not found on assigned object', true);
      }
    }

    if (this.raycastEngineObject) {
      this.raycastEngine = this.raycastEngineObject.getComponent(RaycastEngine);
      if (!this.raycastEngine) {
        this.log('ERROR: RaycastEngine component not found on assigned object', true);
      }
    }

    this.debouncedEmitter = new DebouncedEventEmitter(this.eventDebounceTime);

    // Initialize default word regions (override in Inspector or setWordRegions())
    this.initializeDefaultRegions();

    this.log('SpatialReadingController ready');

    // Subscribe to key events for logging
    EventManagerInstance.on('onStartWordReached', (data) => {
      this.log(`Event fired: onStartWordReached - ${JSON.stringify(data)}`);
    });
  }

  /**
   * Update loop - runs every frame
   */
  onUpdate(): void {
    if (!this.fingerTracker || !this.raycastEngine) {
      return;
    }

    // Step 1: Get tracked finger position
    const trackedData = this.fingerTracker.getTrackedFingerData();
    if (!trackedData.isTracking) {
      // No hand detected
      this.handleNoHandDetected();
      return;
    }

    // Step 2: Raycast from camera through finger to text plane
    const intersection = this.raycastEngine.raycastFingerToPlane(trackedData.position);

    // Step 3: Store current state
    this.currentIntersection = intersection;
    this.isCurrentlyIntersecting = intersection.hit;

    if (intersection.hit) {
      this.currentUVPosition = intersection.uvCoordinates;

      // Step 4: Check word region crossings
      this.updateWordRegionStates();

      // Debug visualization
      if (this.debugLogging) {
        this.log(
          `Finger UV Position: (${intersection.uvCoordinates.x.toFixed(3)}, ${intersection.uvCoordinates.y.toFixed(3)})`
        );
      }
    } else {
      // Ray did not hit text plane
      this.handleNoPlaneIntersection();
    }
  }

  /**
   * Check each word region to see if finger entered/exited
   */
  private updateWordRegionStates(): void {
    if (!this.raycastEngine) return;
    for (const region of this.wordRegions) {
      const isNowActive = this.raycastEngine.isPointInBoundingBox(
        this.currentUVPosition,
        region.minUV,
        region.maxUV
      );

      // Detect state transition from inactive to active (ENTRY)
      if (isNowActive && !region.isCurrentlyActive) {
        region.isCurrentlyActive = true;
        this.emitWordRegionEvent(region, 'onEnter');
      }

      // Detect state transition from active to inactive (EXIT)
      if (!isNowActive && region.isCurrentlyActive) {
        region.isCurrentlyActive = false;
        this.emitWordRegionEvent(region, 'onExit');
      }
    }
  }

  /**
   * Emit an event when entering/exiting a word region
   * Uses debouncing to prevent rapid-fire events
   */
  private emitWordRegionEvent(region: WordRegion, transitionType: string): void {
    const eventName = `${region.name}_${transitionType}`;

    const canEmit = this.debouncedEmitter.canEmit(eventName);
    if (canEmit) {
      const payload = {
        regionName: region.name,
        transitionType,
        uvPosition: { ...this.currentUVPosition },
        timestamp: Date.now(),
      };

      // Emit custom event
      EventManagerInstance.emit(eventName, payload);

      // Also emit to the default event name if it matches
      if (region.eventName === 'onStartWordReached' && transitionType === 'onEnter') {
        EventManagerInstance.emit(region.eventName, payload);
      }

      this.log(`Region event: ${eventName}`);
    }
  }

  /**
   * Handle case where no hand is detected
   */
  private handleNoHandDetected(): void {
    // Deactivate all regions
    for (const region of this.wordRegions) {
      if (region.isCurrentlyActive) {
        region.isCurrentlyActive = false;
        this.emitWordRegionEvent(region, 'onExit');
      }
    }
    this.isCurrentlyIntersecting = false;
  }

  /**
   * Handle case where ray doesn't intersect with plane
   */
  private handleNoPlaneIntersection(): void {
    // Similar to no hand detected
    this.handleNoHandDetected();
  }

  /**
   * Initialize default word regions (example)
   * Override or extend this based on your actual text layout
   */
  private initializeDefaultRegions(): void {
    // Example: "Start Word" region at UV (0.1-0.3, 0.4-0.6)
    this.addWordRegion({
      name: 'StartWord',
      minUV: { x: 0.1, y: 0.4 },
      maxUV: { x: 0.3, y: 0.6 },
      eventName: 'onStartWordReached',
    });

    // Example: "Middle Section" region
    this.addWordRegion({
      name: 'MiddleSection',
      minUV: { x: 0.3, y: 0.3 },
      maxUV: { x: 0.7, y: 0.7 },
      eventName: 'onMiddleSectionReached',
    });
  }

  /**
   * PUBLIC API: Add a word region dynamically
   */
  addWordRegion(config: {
    name: string;
    minUV: Vec2;
    maxUV: Vec2;
    eventName: string;
  }): void {
    const region: WordRegion = {
      name: config.name,
      minUV: config.minUV,
      maxUV: config.maxUV,
      isCurrentlyActive: false,
      eventName: config.eventName,
    };

    this.wordRegions.push(region);
    this.log(`Added word region: ${config.name}`);
  }

  /**
   * PUBLIC API: Set word regions (replace all existing)
   */
  setWordRegions(regions: Array<{ name: string; minUV: Vec2; maxUV: Vec2; eventName: string }>): void {
    this.wordRegions = regions.map((config) => ({
      name: config.name,
      minUV: config.minUV,
      maxUV: config.maxUV,
      isCurrentlyActive: false,
      eventName: config.eventName,
    }));
    this.log(`Set ${this.wordRegions.length} word regions`);
  }

  /**
   * PUBLIC API: Get current intersection data
   */
  getCurrentIntersection(): any {
    return this.currentIntersection;
  }

  /**
   * PUBLIC API: Get current UV position
   */
  getCurrentUVPosition(): Vec2 {
    return { ...this.currentUVPosition };
  }

  /**
   * PUBLIC API: Check if currently intersecting with plane
   */
  isIntersectingPlane(): boolean {
    return this.isCurrentlyIntersecting;
  }

  /**
   * PUBLIC API: Get active word regions
   */
  getActiveWordRegions(): WordRegion[] {
    return this.wordRegions.filter((r) => r.isCurrentlyActive);
  }

  /**
   * PUBLIC API: Subscribe to custom events
   * Example: controller.addEventListener('onStartWordReached', callback)
   */
  addEventListener(eventName: string, callback: (data?: any) => void): void {
    EventManagerInstance.on(eventName, callback);
  }

  /**
   * PUBLIC API: Unsubscribe from custom events
   */
  removeEventListener(eventName: string): void {
    EventManagerInstance.removeAllListeners(eventName);
  }

  /**
   * PUBLIC API: Update debounce time for all events
   */
  setEventDebounceTime(milliseconds: number): void {
    this.eventDebounceTime = milliseconds;
    this.debouncedEmitter = new DebouncedEventEmitter(milliseconds);
  }

  /**
   * Utility: Logging helper with optional error flag
   */
  private log(message: string, isError: boolean = false): void {
    if (this.debugLogging || isError) {
      const prefix = isError ? '[ERROR]' : '[SpatialReading]';
      console.log(`${prefix} ${message}`);
    }
  }

  /**
   * Called on script destruction (scene cleanup)
   */
  onDestroy(): void {
    EventManagerInstance.removeAllListeners();
    this.log('SpatialReadingController destroyed');
  }
}
