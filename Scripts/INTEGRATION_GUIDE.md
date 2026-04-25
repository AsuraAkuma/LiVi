# Spatial Reading Lens - Integration Guide

Complete setup instructions for the Spatial Reading Lens system in Lens Studio 5.15.0.

## System Overview

The Spatial Reading Lens consists of three core systems:

1. **FingerTracker** - Tracks the user's index finger with smoothing
2. **RaycastEngine** - Casts rays to detect intersections with a text plane
3. **SpatialReadingController** - Orchestrates the systems and manages events

## Scene Setup Step-by-Step

### Step 1: Create the Scene Hierarchy

In Lens Studio, create the following scene structure:

```
Scene (root)
├── Camera (rename to "MainCamera")
├── HandTracker (ensure hand tracking is enabled)
├── WorldTracker (for tracking the physical book/page)
│   └── TextPlane (SceneObject with plane mesh/collider)
└── SpatialReadingController (empty SceneObject for controller logic)
```

### Step 2: Add the Camera Reference

1. Select or create your main **Camera** object
2. Ensure it's the active camera in the scene
3. You'll link this to both `RaycastEngine` and for raycasting calculations

### Step 3: Enable Hand Tracking

1. In Lens Studio's **Capabilities** panel, enable **Hand Tracking**
2. Create or ensure you have a **HandTracker** object in your scene
   - This object should already be set up by Lens Studio when you enable hand tracking
3. Note the exact name/path of this tracker for later

### Step 4: Create the Text Plane

1. Create a new **SceneObject** named "TextPlane"
2. Add a **Mesh** component with a plane geometry
   - Size: approximately 2 units wide × 3 units tall (adjust to match your page)
   - Ensure the plane faces the camera (normal pointing toward -Z in local space)
3. Add a **Collider** component (Plane or Box collider)
4. Position this plane in world space where your physical book/page would be
5. **Important**: The plane's local Z-axis should point away from the camera (for raycasting)

### Step 5: Set Up FingerTracker Script

1. Create a new **SceneObject** named "FingerTrackerObject" (or add to existing object)
2. In Lens Studio's Script Editor, add the **FingerTracker.ts** script as a component
3. In the **Inspector**, you'll see two fields:
   - **Hand Tracker Reference**: Drag your HandTracker object here
   - **Smoothing Factor**: Set to 0.7 (adjust 0.0-1.0 for more/less smoothing)
   - **Hand Confidence Threshold**: Set to 0.5 (minimum confidence to track)

### Step 6: Set Up RaycastEngine Script

1. Create a new **SceneObject** named "RaycastEngineObject" (or add to existing object)
2. Add the **RaycastEngine.ts** script as a component
3. In the **Inspector**, configure:
   - **Text Plane Reference**: Drag your TextPlane here
   - **Main Camera Reference**: Drag your Camera here
   - **Plane Width**: 2.0 (must match TextPlane width)
   - **Plane Height**: 3.0 (must match TextPlane height)
   - **Max Raycast Distance**: 100.0
   - **Debug Visualization**: Enable to see raycast lines during testing

### Step 7: Set Up SpatialReadingController Script

1. Select or create a **SceneObject** named "SpatialReadingController"
2. Add the **SpatialReadingController.ts** script as a component
3. In the **Inspector**, configure:
   - **Finger Tracker Object**: Drag the object from Step 5
   - **Raycast Engine Object**: Drag the object from Step 6
   - **Event Debounce Time**: 200 ms (prevents rapid-fire events)
   - **Debug Logging**: Enable for development, disable for production

## Word Region Configuration

The `SpatialReadingController` comes with default word regions, but you should customize them based on your actual text layout.

### Defining Word Regions Programmatically

```typescript
// Get reference to controller
const controller = sceneObject.getComponent(SpatialReadingController);

// Define regions in UV space (0.0-1.0 where 0,0 is bottom-left, 1,1 is top-right)
controller.setWordRegions([
  {
    name: 'StartWord',
    minUV: { x: 0.1, y: 0.8 },    // Lower-left of start word
    maxUV: { x: 0.3, y: 0.95 },   // Upper-right of start word
    eventName: 'onStartWordReached'
  },
  {
    name: 'Paragraph1',
    minUV: { x: 0.0, y: 0.5 },
    maxUV: { x: 1.0, y: 0.8 },
    eventName: 'onParagraph1Reached'
  }
]);
```

### Calculating UV Coordinates

To find the correct UV coordinates for your words:

1. Use the **Debug Logging** feature to print current UV positions
2. Point your index finger at different parts of the page
3. Note the UV coordinates printed to console
4. Use these to define your regions

Example console output:
```
[SpatialReading] Finger UV Position: (0.257, 0.612)
```

## Event Handling

### Subscribe to Events

```typescript
// Listen for specific word region events
controller.addEventListener('onStartWordReached', (data) => {
  console.log('User reached start word!', data);
  // Trigger spatial audio, visual effects, etc.
  playAudioClip('word_start.mp3');
});

// Listen for custom region events
controller.addEventListener('MiddleSection_onEnter', (data) => {
  console.log('Entered middle section');
  displayVisualEffect();
});

controller.addEventListener('MiddleSection_onExit', (data) => {
  console.log('Exited middle section');
  hideVisualEffect();
});
```

### Event Data Structure

Each event callback receives a data object:

```typescript
{
  regionName: 'StartWord',
  transitionType: 'onEnter',
  uvPosition: { x: 0.25, y: 0.62 },
  timestamp: 1234567890
}
```

## Coordinate Systems Reference

### World Space vs Local Space

- **World Space**: Global coordinates in your scene
- **Local Space**: Coordinates relative to the TextPlane object

The raycasting engine automatically converts between these:
- Raycast originates from **Camera (World Space)**
- Intersects with **TextPlane (World → Local conversion)**
- Returns **UV coordinates** (0-1 normalized space)

### UV Coordinate System

```
(0, 1) -------- (1, 1)
  |               |
  |   Your Text   |
  |               |
(0, 0) -------- (1, 0)

X-axis: Left (0.0) → Right (1.0)
Y-axis: Bottom (0.0) → Top (1.0)
```

## Debugging Tips

### Enable Debug Logging

1. Select the SpatialReadingController object
2. In Inspector, enable **Debug Logging**
3. Open Lens Studio's Console (View → Console)
4. You'll see real-time finger tracking data

### Common Debug Output

```
[SpatialReading] SpatialReadingController initializing...
[SpatialReading] Added word region: StartWord
[SpatialReading] Finger UV Position: (0.257, 0.612)
[SpatialReading] Region event: StartWord_onEnter
```

### Troubleshooting

| Issue | Solution |
|-------|----------|
| Hand not detected | Ensure hand tracking is enabled in Capabilities; check Hand Confidence Threshold |
| No plane intersection | Verify TextPlane is positioned in front of camera; check plane orientation |
| Events not firing | Enable Debug Logging; verify word regions overlap with tracked UV positions |
| Jittery finger tracking | Increase Smoothing Factor in FingerTracker (0.7-0.9 recommended) |
| Events firing too frequently | Increase Event Debounce Time in SpatialReadingController |

## Performance Optimization

### Best Practices

1. **Debounce Time**: Set to 200-500ms to prevent excessive event firing
2. **Smoothing Factor**: 0.6-0.8 balances responsiveness with smoothness
3. **Word Region Count**: Keep under 20 regions for optimal performance
4. **Raycast Distance**: Set just beyond your plane (default 100 is safe)

### Profiling

Enable Console profiling to monitor frame rate:
- Watch for stutters during hand tracking
- If frame rate drops below 60fps, reduce smoothing or increase debounce time

## Integration with Audio/Visuals

### Triggering Spatial Audio

```typescript
import { AudioManager } from './AudioManager'; // Your audio system

controller.addEventListener('onStartWordReached', (data) => {
  // Play audio for this word region
  AudioManager.playClipAtWorldPosition('word_audio.mp3', audioWorldPosition);
});
```

### Triggering Visual Effects

```typescript
import { ParticleEffectManager } from './ParticleEffectManager'; // Your VFX system

controller.addEventListener('Paragraph1_onEnter', (data) => {
  ParticleEffectManager.spawnEffect('highlight', data.uvPosition);
});
```

## Advanced Features

### Dynamic Region Updates

```typescript
// Add a region at runtime
controller.addWordRegion({
  name: 'DynamicWord',
  minUV: { x: 0.4, y: 0.5 },
  maxUV: { x: 0.6, y: 0.6 },
  eventName: 'onDynamicWordReached'
});

// Update debounce time
controller.setEventDebounceTime(300);
```

### Getting Current State

```typescript
// Check if currently intersecting with plane
if (controller.isIntersectingPlane()) {
  const uvPos = controller.getCurrentUVPosition();
  console.log(`Finger at UV: (${uvPos.x}, ${uvPos.y})`);
}

// Get active word regions (regions finger is currently in)
const activeRegions = controller.getActiveWordRegions();
console.log(`Active regions: ${activeRegions.map(r => r.name).join(', ')}`);
```

## Common Integration Scenarios

### Scenario 1: Read-Along Audio

```typescript
const bookContent = [
  { text: 'Once upon a time', audioFile: 'intro.mp3', region: 'Intro' },
  { text: 'There lived a dragon', audioFile: 'dragon.mp3', region: 'Dragon' }
];

bookContent.forEach(content => {
  controller.addEventListener(`${content.region}_onEnter`, () => {
    playAudio(content.audioFile);
  });
});
```

### Scenario 2: Word Highlighting

```typescript
controller.addEventListener('Word_onEnter', (data) => {
  highlightRegion(data.uvPosition);
});

controller.addEventListener('Word_onExit', (data) => {
  removeHighlight(data.uvPosition);
});
```

### Scenario 3: Translation/Definition Overlay

```typescript
const wordDefinitions = {
  'Vocabulary': { definition: '...' },
  'Understanding': { definition: '...' }
};

Object.entries(wordDefinitions).forEach(([word, def]) => {
  controller.addEventListener(`${word}_onEnter`, () => {
    showDefinitionOverlay(def);
  });
});
```

## FAQ

**Q: How accurate is finger tracking?**
A: Accuracy depends on hand pose and lighting. Typically ±5-10mm at 30cm distance.

**Q: Can I track multiple fingers?**
A: Currently only index finger is supported. Extend FingerTracker to support other joints.

**Q: What if the text plane moves?**
A: Ensure the WorldTracker (parent of TextPlane) is properly tracking the physical book.

**Q: How do I handle pages with different text layouts?**
A: Define separate word regions for each page, swap them when page changes.

---

**For support or feature requests, refer to Lens Studio documentation:** https://docs.snap.com/snap-camera/
