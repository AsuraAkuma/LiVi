#version 300 es

// ─────────────────────────────────────────────────────────────────────────────
// ImageProcessingShader.frag
// Lens Studio 5.15.4 Custom Material — OCR Pre-Processing Pipeline
//
// Single-pass GPU pipeline:
//   1. Grayscale         — ITU-R BT.601 luminance
//   2. Bilateral Denoise — edge-preserving noise suppression
//   3. High-Pass Sharpen — bilateral residual re-injection
//   4. Adaptive Binarize — local-mean threshold (handles uneven page lighting)
//
// Uniforms (set by ImageProcessingController.ts):
//   cameraTexture   — Device Camera texture (bind in Inspector)
//   texelSize       — vec2(1/width, 1/height) — set automatically by controller
//   sharpnessAmount — [0.0 – 3.0]  default 1.5
//   denoiseRadius   — [1.0 – 4.0]  default 2.0  (in texels)
//   thresholdBias   — [-0.2 – 0.2] default -0.05 (negative = prefer dark ink)
// ─────────────────────────────────────────────────────────────────────────────

precision highp float;
precision highp sampler2D;

uniform sampler2D cameraTexture;
uniform vec2      texelSize;
uniform float     sharpnessAmount;
uniform float     denoiseRadius;
uniform float     thresholdBias;

in  vec2 varTEXCOORD0;
out vec4 fragColor;

// ── Helpers ──────────────────────────────────────────────────────────────────

float luminance(vec3 c) {
    // ITU-R BT.601 — perceptual weights match human sensitivity to text contrast
    return dot(c, vec3(0.299, 0.587, 0.114));
}

float sampleGray(vec2 uv) {
    return luminance(texture(cameraTexture, uv).rgb);
}

// ── Main ─────────────────────────────────────────────────────────────────────

void main() {
    vec2 uv = varTEXCOORD0;

    // ── Step 1: Grayscale ─────────────────────────────────────────────────────
    float centerGray = sampleGray(uv);

    // ── Step 2: Edge-Preserving Bilateral Denoise ─────────────────────────────
    // Two Gaussian terms:
    //   Spatial  — weights fall off with pixel distance (blurs everything nearby)
    //   Range    — weights fall off with intensity difference (protects edges)
    // The product of both is near-zero across ink edges but high within paper grain,
    // so grain is blurred while ink boundaries remain sharp.
    float sigmaSp      = max(denoiseRadius * 0.5, 0.5);
    float sigmaRn      = 0.12; // 12% intensity window — tuned for printed-page contrast
    float inv2SigmaSp2 = 0.5 / (sigmaSp * sigmaSp);
    float inv2SigmaRn2 = 0.5 / (sigmaRn * sigmaRn);

    float bilSum   = 0.0;
    float wSum     = 0.0;
    float localSum = 0.0;
    float count    = 0.0;

    // Fixed outer bounds (max radius 4 = 9x9 kernel) with integer guard.
    // Constant outer bound keeps the loop unrollable on mobile GLSL compilers
    // that reject non-constant loop limits.
    int r = int(clamp(floor(denoiseRadius), 1.0, 4.0));

    for (int xi = -4; xi <= 4; xi++) {
        if (xi < -r || xi > r) continue;
        for (int yi = -4; yi <= 4; yi++) {
            if (yi < -r || yi > r) continue;

            float fx = float(xi);
            float fy = float(yi);
            float nb = sampleGray(uv + vec2(fx, fy) * texelSize);

            float spatialD = fx * fx + fy * fy;
            float rangeD   = (nb - centerGray) * (nb - centerGray);
            float w        = exp(-spatialD * inv2SigmaSp2)
                           * exp(-rangeD   * inv2SigmaRn2);

            bilSum   += nb * w;
            wSum     += w;
            localSum += nb;   // unweighted — feeds local mean in Step 4
            count    += 1.0;
        }
    }

    float denoised  = (wSum  > 0.0) ? bilSum  / wSum  : centerGray;
    float localMean = (count > 0.0) ? localSum / count : centerGray;

    // ── Step 3: High-Pass Sharpening ─────────────────────────────────────────
    // The bilateral filter is a low-pass. Its residual (original - smooth)
    // carries edge signal WITHOUT the paper noise attenuated by the range term.
    // Re-injecting it restores ink crispness lost to denoising.
    float detail    = centerGray - denoised;
    float sharpened = clamp(denoised + sharpnessAmount * detail, 0.0, 1.0);

    // ── Step 4: Adaptive Binarization ────────────────────────────────────────
    // Threshold against neighbourhood mean rather than a global constant so
    // shadows, highlights, and curved-page gradients don't force whole regions
    // to solid black or white.
    // thresholdBias shifts the boundary: negative biases toward black (ink),
    // positive toward white (background).
    float threshold = clamp(localMean + thresholdBias, 0.0, 1.0);
    float binary    = (sharpened >= threshold) ? 1.0 : 0.0;

    fragColor = vec4(binary, binary, binary, 1.0);
}
