#version 300 es

// ─────────────────────────────────────────────────────────────────────────────
// ImageProcessingShader.vert
// Pass-through vertex shader for Lens Studio 5.15.4 Custom Material.
// Applies the model-view-projection matrix and forwards UV to the fragment stage.
// ─────────────────────────────────────────────────────────────────────────────

in vec4 position;
in vec2 texture0;

uniform mat4 sc_ModelViewProjectionMatrix;

out vec2 varTEXCOORD0;

void main() {
    gl_Position  = sc_ModelViewProjectionMatrix * vec4(position.xyz, 1.0);
    varTEXCOORD0 = texture0;
}
