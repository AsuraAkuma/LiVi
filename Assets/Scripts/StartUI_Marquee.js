// StartUI_Marquee.js
// Moves a SceneObject back-and-forth on X to create a subtle looping marquee feel.

//@input SceneObject target
//@input float amplitude = 10.0  // world units
//@input float speed = 0.6       // cycles per second-ish
//@input float yBobAmplitude = 0.6
//@input float yBobSpeed = 0.9

var t0 = getTime();
var basePos = null;

function init() {
    if (!script.target) {
        // Nothing to animate
        return;
    }
    basePos = script.target.getTransform().getLocalPosition();
}

function onUpdate() {
    if (!script.target || !basePos) {
        return;
    }
    var t = getTime() - t0;

    // Smooth back-and-forth (sinusoid)
    var x = basePos.x + Math.sin(t * script.speed * Math.PI * 2.0) * script.amplitude;
    var y = basePos.y + Math.sin(t * script.yBobSpeed * Math.PI * 2.0) * script.yBobAmplitude;

    script.target.getTransform().setLocalPosition(new vec3(x, y, basePos.z));
}

init();
var updateEvent = script.createEvent("UpdateEvent");
updateEvent.bind(onUpdate);
