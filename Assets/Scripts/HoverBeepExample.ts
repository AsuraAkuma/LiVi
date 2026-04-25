// HoverBeepExample.ts
// Simple example: play a local short SFX when the user taps a SceneObject (assign in Inspector)
// Inspector fields:
// @input SceneObject target  // assign the text or object you want to trigger the beep
// @input Component.AudioComponent beep  // assign an Audio Component with a short beep clip

declare var TouchGestures: any;
declare var script: any;

function playBeepLocal(): void {
  try {
    const audioComp = script.beep;
    if (!audioComp) {
      console.warn("HoverBeepExample: No audio component assigned.");
      return;
    }

    // Try common playback methods used in Lens Studio audio components
    if (typeof audioComp.start === 'function') {
      audioComp.start(0);
    } else if (typeof audioComp.play === 'function') {
      audioComp.play(0);
    } else {
      console.warn("HoverBeepExample: Audio component has no start/play method.");
    }
  } catch (e) {
    console.error("HoverBeepExample: Error playing beep", e);
  }
}

function onTap(eventData: any): void {
  playBeepLocal();
}

// Attach gesture handler when the script starts
function initialize(): void {
  if (!script.target) {
    console.warn("HoverBeepExample: assign a target SceneObject in the Inspector (target)");
    return;
  }

  try {
    TouchGestures.onTap(script.target, onTap);
    console.log("HoverBeepExample: Tap handler attached to target");
  } catch (e) {
    console.warn("HoverBeepExample: TouchGestures not available — audio will play only when you call playBeepLocal() programmatically.", e);
  }
}

initialize();

export {};
