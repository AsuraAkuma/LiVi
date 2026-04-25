# Spatial Reading Lens - Complete TypeScript Architecture

A modern, strictly-typed TypeScript implementation of a spatial reading system for Snapchat Spectacles using Lens Studio 5.15.0. This system uses finger tracking and raycasting to create an interactive reading experience with spatial audio and 3D visual events.

## 📋 Quick Reference

**Files Generated:**
- `FingerTracker.ts` - Hand tracking with low-pass smoothing filter
- `RaycastEngine.ts` - Ray-plane intersection detection with UV coordinate calculation
- `EventManager.ts` - Custom event bus with debouncing support
- `SpatialReadingController.ts` - Main orchestrator and state machine
- `Types.ts` - TypeScript type definitions and interfaces
- `ExampleUsage.ts` - Practical integration examples
- `INTEGRATION_GUIDE.md` - Complete setup instructions

---

## 🎯 System Architecture

### Three Core Systems

```
┌─────────────────────────────────────────────────────┐
│     SpatialReadingController (Orchestrator)          │
│  - Manages word region state machine                 │
│  - Emits events on region entry/exit                 │
│  - Provides public API for integration               │
└──────────────┬──────────────────────────────────────┘
               │
       ┌───────┼────────┐
       │       │        │
       ▼       ▼        ▼
   ┌─────┐ ┌──────┐ ┌──────────┐
   │Finger│ │Ray-  │ │Event     │
   │Track │ │cast  │ │Manager   │
   │er    │ │Engine│ │(Debounce)│
   └──────┘ └──────┘ └──────────┘
       │       │        │
       ▼       ▼        ▼
    Hand      Camera + Text    Event
    Tracker   Plane Collision  Bus
```

### Data Flow Pipeline

```
Hand Tracking → Finger Position → Raycast → UV Coordinates → Word Regions → Events
   (60fps)      (Smoothed)        Ray      (0.0-1.0 range)  (Bounding    (Debounced)
                                Intersection               Boxes)
```

---

## 📦 Component Overview

### 1. **FingerTracker.ts**
Tracks the user's index finger joint with configurable smoothing.

**Key Features:**
- Hooks into Lens Studio's `HandTracking` API
- Isolates `HandJoint.INDEX_TIP`
- Implements low-pass filter: `smoothed = smoothed * α + raw * (1-α)`
- Confidence-based filtering (discard low-confidence data)
- Exposes smoothed position to raycaster

**Public Methods:**
```typescript
getIndexFingerTipPosition(): Vec3
getIndexFingerTipLocalPosition(referenceTransform): Vec3
isTracking(): boolean
getTrackingConfidence(): number
getTrackedFingerData(): { position, confidence, isTracking }
```

**Inspector Settings:**
- `Hand Tracker Reference` - Link your HandTracker object
- `Smoothing Factor` - 0.0 (raw) to 1.0 (max smoothing), default 0.7
- `Hand Confidence Threshold` - Minimum tracking confidence, default 0.5

---

### 2. **RaycastEngine.ts**
Casts rays from camera through finger to intersect with text plane.

**Key Features:**
- Ray-plane mathematical intersection (analytical solution)
- UV coordinate calculation (0.0-1.0 normalized space)
- World-to-local coordinate transforms
- Optional debug visualization
- Bounding box collision for regions

**Mathematical Model:**
```
Ray: P(t) = O + t*D
Plane: dot(N, P - PC) = 0

Intersection: t = dot(PC - O, N) / dot(D, N)
Hit Point: P = O + t*D
```

**Public Methods:**
```typescript
raycastFingerToPlane(fingerPosition: Vec3): PlaneIntersection
getPlaneIntersection(fingerPosition: Vec3): PlaneIntersection
isPointInBoundingBox(uvPoint, boxMin, boxMax): boolean
setPlaneSize(width, height): void
```

**Intersection Result:**
```typescript
{
  hit: boolean,
  position: Vec3,              // World space
  localPosition: Vec3,          // Plane-relative
  uvCoordinates: {x: 0-1, y: 0-1},
  distance: number,
  normal: Vec3
}
```

---

### 3. **EventManager.ts**
Custom event bus with debouncing to prevent rapid-fire events.

**Key Features:**
- Centralized event subscription system
- `emitDebounced()` - Respects minimum time between events
- One-time subscriptions with `.once()`
- Event history for debugging (last 100 events)
- Configurable per-event debounce timers

**Core Types:**
```typescript
EventManager.on(eventName, callback): EventSubscription
EventManager.emitDebounced(eventName, payload): boolean
EventManager.once(eventName, callback): EventSubscription
```

**Usage Example:**
```typescript
const eventManager = new EventManager(200); // 200ms debounce
eventManager.on('onStartWordReached', (data) => {
  console.log('Word reached:', data);
});
```

---

### 4. **SpatialReadingController.ts**
Master orchestrator that integrates all three systems.

**Key Features:**
- State machine for word region tracking
- Entry/exit detection with debouncing
- Automatic event emission on region crossings
- Configurable word regions (programmatic API)
- Query API for current state

**Word Region State Machine:**
```
Inactive → [Enter] → Active → [Exit] → Inactive
           (emit event)        (emit event)
```

**Public API:**
```typescript
// Configuration
setWordRegions(regions): void
addWordRegion(config): void
setEventDebounceTime(milliseconds): void

// Queries
getCurrentUVPosition(): Vec2
getCurrentIntersection(): PlaneIntersection
isIntersectingPlane(): boolean
getActiveWordRegions(): WordRegion[]

// Events
addEventListener(eventName, callback): void
removeEventListener(eventName): void
```

---

## 🔧 Scene Setup Checklist

```
[ ] Enable Hand Tracking in Capabilities
[ ] Create HandTracker object in scene
[ ] Create MainCamera (assign as active camera)
[ ] Create TextPlane with Plane mesh + Collider
    - Size: 2.0 width × 3.0 height (adjustable)
    - Position: In front of camera
    - Normal: Pointing toward camera
[ ] Create FingerTrackerObject
    - Add FingerTracker component
    - Link HandTracker reference
[ ] Create RaycastEngineObject
    - Add RaycastEngine component
    - Link TextPlane reference
    - Link Camera reference
[ ] Create SpatialReadingController
    - Add SpatialReadingController component
    - Link FingerTrackerObject reference
    - Link RaycastEngineObject reference
[ ] Define word regions (programmatically or via inspector)
[ ] Set up event listeners for your content
```

---

## 📍 Coordinate System Reference

### UV Space (Normalized Coordinates)

```
Scene view (looking at text):

(0.0, 1.0) ─────────────── (1.0, 1.0)
    │                           │
    │  Your Text on Page        │
    │                           │
(0.0, 0.0) ─────────────── (1.0, 0.0)

X-axis: Left (0.0) ← → Right (1.0)
Y-axis: Bottom (0.0) ← → Top (1.0)
```

### Finding UV Coordinates

1. Enable Debug Logging in SpatialReadingController
2. Point finger at different words
3. Read UV position from console: `Finger UV Position: (0.257, 0.612)`
4. Use these values for word region definitions

---

## 📝 Code Examples

### Example 1: Basic Setup

```typescript
// In your main scene setup script
import { SpatialReadingController } from './Scripts/SpatialReadingController';

const controller = sceneObject.getComponent(SpatialReadingController);

// Define your reading regions
controller.setWordRegions([
  {
    name: 'Title',
    minUV: { x: 0.2, y: 0.85 },
    maxUV: { x: 0.8, y: 0.98 },
    eventName: 'onTitleReached'
  },
  {
    name: 'Introduction',
    minUV: { x: 0.05, y: 0.55 },
    maxUV: { x: 0.95, y: 0.85 },
    eventName: 'onIntroductionReached'
  }
]);

// Listen for events
controller.addEventListener('onTitleReached', (data) => {
  console.log('User reached title!');
  playAudio('title_narration.mp3');
});
```

### Example 2: Audio Synchronization

```typescript
controller.addEventListener('Introduction_onEnter', (data) => {
  const audioClip = 'audio/intro_part_1.mp3';
  AudioManager.playClipAtWorldPosition(audioClip, soundWorldPosition);
});

controller.addEventListener('Introduction_onExit', (data) => {
  AudioManager.stopCurrentClip();
});
```

### Example 3: Visual Highlighting

```typescript
controller.addEventListener('Key Word_onEnter', (data) => {
  // Show highlight at finger position
  visualEffects.showHighlight(data.uvPosition);
});

controller.addEventListener('Key Word_onExit', (data) => {
  visualEffects.hideHighlight();
});
```

### Example 4: Performance Monitoring

```typescript
// Get reading statistics
const stats = progressTracker.getReadingStats();
console.log(`Pages read: ${stats.regionsVisited}`);
console.log(`Total time: ${stats.totalTimeTracked / 1000}s`);
```

---

## ⚡ Performance Optimization

### Recommended Settings

| Setting | Value | Notes |
|---------|-------|-------|
| Smoothing Factor | 0.7 | Balances responsiveness (0.5 = responsive, 0.9 = smooth) |
| Event Debounce | 200ms | Minimum time between same event fires |
| Max Raycast Distance | 100.0 | Distance beyond which ray stops (units) |
| Hand Confidence Threshold | 0.5 | Only track if confidence > 50% |
| Max Word Regions | 20 | More regions = higher CPU cost |

### Profiling

```typescript
// Monitor events being fired
EventManagerInstance.getEventHistory(5).forEach(evt => {
  console.log(`${evt.eventName} @ ${evt.timestamp}`);
});
```

---

## 🐛 Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| Hand not detected | Hand tracking not enabled | Enable Hand Tracking in Capabilities |
| Finger position jittery | Smoothing too low | Increase Smoothing Factor to 0.8-0.9 |
| No plane intersection | TextPlane not positioned correctly | Verify plane is in front of camera, normal faces camera |
| Events firing too frequently | Debounce time too short | Increase Event Debounce Time to 200-500ms |
| High CPU usage | Too many regions or low smoothing | Reduce regions, increase smoothing factor |
| False region entries | Regions too large or overlapping | Verify region boundaries don't overlap |

---

## 📚 Advanced Features

### Dynamic Region Updates at Runtime

```typescript
// Add region after scene starts
controller.addWordRegion({
  name: 'NewContent',
  minUV: { x: 0.3, y: 0.4 },
  maxUV: { x: 0.7, y: 0.6 },
  eventName: 'onNewContentReached'
});

// Change debounce timing
controller.setEventDebounceTime(300);
```

### State Queries

```typescript
// Get current finger position in UV space
const uvPos = controller.getCurrentUVPosition();

// Check if finger intersects plane
if (controller.isIntersectingPlane()) {
  const regions = controller.getActiveWordRegions();
  console.log(`In regions: ${regions.map(r => r.name).join(', ')}`);
}

// Get full intersection data
const intersection = controller.getCurrentIntersection();
console.log(`Distance from camera: ${intersection.distance}m`);
```

### Multi-Page Support

```typescript
// Define page 1 regions
const page1Regions = [...];

// Define page 2 regions
const page2Regions = [...];

// Switch pages
function switchToPage(pageNumber) {
  if (pageNumber === 1) {
    controller.setWordRegions(page1Regions);
  } else if (pageNumber === 2) {
    controller.setWordRegions(page2Regions);
  }
}
```

---

## 🔗 Lens Studio API References

**Required Lens Studio APIs:**
- `HandTracking` - Hand pose tracking
- `HandJoint` - Hand joint enum (INDEX_TIP, THUMB_TIP, etc.)
- `@Component` - Component decorator
- `@Serializable` - Inspector property binding
- `Transform` - Position, rotation, scale
- `Vec3` - 3D vector math
- `Ray` - Ray for intersection tests

**Assuming Lens Studio 5.15.0 Component Model:**
```typescript
// Modern component pattern
@Component
export class MySystem {
  @Serializable({ displayName: 'Property' })
  myProperty: SomeType;
  
  onAwake(): void { /* initialization */ }
  onUpdate(): void { /* per-frame update */ }
  onDestroy(): void { /* cleanup */ }
}
```

---

## 📋 Integration Checklist

**Before Deployment:**
- [ ] All scene objects linked correctly in Inspector
- [ ] Hand Tracking is enabled in Capabilities
- [ ] Word regions defined and verified via debug logging
- [ ] Event debounce time tested with actual gesture speed
- [ ] Audio/visual systems integrated
- [ ] Performance tested on target device (60fps maintained)
- [ ] Hand confidence threshold tuned for lighting conditions
- [ ] Smoothing factor optimized for responsiveness

---

## 📖 Files Generated

```
Scripts/
├── FingerTracker.ts              (250 lines)
├── RaycastEngine.ts              (300 lines)
├── EventManager.ts               (250 lines)
├── SpatialReadingController.ts   (350 lines)
├── Types.ts                      (60 lines)
├── ExampleUsage.ts               (400 lines)
├── INTEGRATION_GUIDE.md          (400 lines)
└── README.md                     (this file)
```

**Total: ~2000 lines of production-ready TypeScript**

---

## 🎓 Learning Path

1. **Start with Integration Guide** - Understand scene setup
2. **Review FingerTracker.ts** - Understand hand tracking pipeline
3. **Review RaycastEngine.ts** - Understand raycasting mathematics
4. **Review EventManager.ts** - Understand event system
5. **Review SpatialReadingController.ts** - Understand orchestration
6. **Study ExampleUsage.ts** - Learn practical patterns
7. **Integrate with your content** - Audio, visuals, analytics

---

## 🤝 Support

For issues or questions:
1. Enable Debug Logging and check console output
2. Verify Inspector linkages are correct
3. Review INTEGRATION_GUIDE.md for troubleshooting
4. Check ExampleUsage.ts for similar use cases
5. Refer to Lens Studio documentation: https://docs.snap.com/snap-camera/

---

**Created for Lens Studio 5.15.0**
**Strictly-typed modern TypeScript with @Component decorator pattern**
**Production-ready architecture for Snapchat Spectacles AR experiences**
