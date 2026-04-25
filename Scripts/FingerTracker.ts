/**
 * FingerTracker.ts
 * 
 * Tracks the user's index finger using Lens Studio's HandTracking API.
 * Implements smoothing via low-pass filtering to reduce jitter.
 * 
 * SCENE SETUP INSTRUCTIONS:
 * 1. In Lens Studio Inspector, ensure you have a Hand Tracking scene object
 * 2. Add this script as a Component to any SceneObject (e.g., a root tracker object)
 * 3. In the Inspector, link the Hand Tracker reference to this script's 'handTracker' field
 * 4. Adjust smoothing factor (0.0-1.0) where higher = more smoothing (default: 0.7)
 */

import { Component, Serializable, Vec3, HandTracker, HandJoint } from '@lens-studio/snapchat-sdk';

interface SmoothedJointData {
  position: Vec3;
  velocity: Vec3;
  lastUpdateTime: number;
}

@Component
export class FingerTracker {
  /**
   * INSPECTOR LINK: Drag your Hand Tracking object here in Lens Studio Inspector
   */
  @Serializable({ displayName: 'Hand Tracker Reference' })
  handTracker: HandTracker;

  /**
   * Smoothing factor for low-pass filter (0.0 = no smoothing, 1.0 = max smoothing)
   * Start with 0.7 for natural tracking with reduced jitter
   */
  @Serializable({ displayName: 'Smoothing Factor', min: 0.0, max: 1.0 })
  smoothingFactor: number = 0.7;

  /**
   * Minimum confidence threshold for hand detection (0.0-1.0)
   * Only process tracking data if confidence exceeds this threshold
   */
  @Serializable({ displayName: 'Hand Confidence Threshold', min: 0.0, max: 1.0 })
  confidenceThreshold: number = 0.5;

  // Internal state for smoothing
  private smoothedIndexTipData: SmoothedJointData = {
    position: Vec3.zero(),
    velocity: Vec3.zero(),
    lastUpdateTime: 0,
  };

  private isHandDetected: boolean = false;
  private lastValidPosition: Vec3 = Vec3.zero();

  /**
   * Initialize the tracker
   */
  onAwake(): void {
    if (!this.handTracker) {
      console.error('FingerTracker: handTracker reference not assigned in Inspector');
      return;
    }
    console.log('FingerTracker initialized');
  }

  /**
   * Called every frame - updates finger position
   */
  onUpdate(): void {
    if (!this.handTracker) {
      return;
    }

    // Check if a hand is being tracked with sufficient confidence
    const handConfidence = this.handTracker.confidence;
    if (handConfidence < this.confidenceThreshold) {
      this.isHandDetected = false;
      return;
    }

    this.isHandDetected = true;

    // Get the index finger tip joint (HandJoint.INDEX_TIP or similar)
    // NOTE: Adjust the joint constant based on your Lens Studio version's HandJoint enum
    const indexTipJoint = this.handTracker.getJoint(HandJoint.INDEX_TIP);

    if (!indexTipJoint) {
      console.warn('FingerTracker: Could not retrieve index finger tip joint');
      return;
    }

    // Extract raw position from the joint
    const rawPosition = indexTipJoint.position;

    // Apply low-pass filter for smoothing
    const smoothedPosition = this.applyLowPassFilter(rawPosition);

    // Update internal state
    this.smoothedIndexTipData.position = smoothedPosition;
    this.smoothedIndexTipData.lastUpdateTime = Date.now();
    this.lastValidPosition = smoothedPosition;
  }

  /**
   * Low-pass filter for position smoothing
   * Reduces jitter from hand tremor while maintaining responsiveness
   * 
   * Formula: smoothed = smoothed * alpha + raw * (1 - alpha)
   * Higher alpha = more smoothing
   */
  private applyLowPassFilter(rawPosition: Vec3): Vec3 {
    const alpha = this.smoothingFactor;
    const filtered = new Vec3(
      this.smoothedIndexTipData.position.x * alpha + rawPosition.x * (1 - alpha),
      this.smoothedIndexTipData.position.y * alpha + rawPosition.y * (1 - alpha),
      this.smoothedIndexTipData.position.z * alpha + rawPosition.z * (1 - alpha)
    );
    return filtered;
  }

  /**
   * PUBLIC API: Get the current smoothed index finger tip position in world space
   */
  getIndexFingerTipPosition(): Vec3 {
    return this.smoothedIndexTipData.position.clone();
  }

  /**
   * PUBLIC API: Get the index finger tip position in local space relative to a transform
   * Useful for raycasting calculations
   */
  getIndexFingerTipLocalPosition(referenceTransform: any): Vec3 {
    // Convert world position to local space of reference transform
    const worldPos = this.smoothedIndexTipData.position;
    const localPos = referenceTransform.worldToLocalMatrix.multiplyPoint(worldPos);
    return localPos;
  }

  /**
   * PUBLIC API: Check if hand is currently being tracked
   */
  isTracking(): boolean {
    return this.isHandDetected;
  }

  /**
   * PUBLIC API: Get hand tracking confidence (0.0-1.0)
   */
  getTrackingConfidence(): number {
    return this.handTracker ? this.handTracker.confidence : 0.0;
  }

  /**
   * PUBLIC API: Get the index finger tip position AND confidence as a combined result
   */
  getTrackedFingerData(): { position: Vec3; confidence: number; isTracking: boolean } {
    return {
      position: this.getIndexFingerTipPosition(),
      confidence: this.getTrackingConfidence(),
      isTracking: this.isTracking(),
    };
  }

  /**
   * PUBLIC API: Reset smoothing filter (useful after a pause or scene transition)
   */
  resetSmoothing(): void {
    this.smoothedIndexTipData.position = this.lastValidPosition;
  }
}
