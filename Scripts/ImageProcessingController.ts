/**
 * ImageProcessingController.ts
 * Lens Studio 5.15.4 — @Component
 *
 * Routes the Device Camera Texture through the GLSL pipeline defined in
 * ImageProcessingShader.frag and writes the binarized result to a Render Target.
 *
 * Scene wiring (see setup instructions in the response):
 *   cameraTexture      → Device Camera Texture asset (Resources panel)
 *   processingMaterial → Custom Material with ImageProcessingShader applied
 *   outputRenderTarget → Render Target texture asset (linked to a Camera component)
 */

import { Component, Serializable, Texture, Material, vec2 } from '@lens-studio/snapchat-sdk';

@Component
export class ImageProcessingController {

    // ── Inspector Bindings ────────────────────────────────────────────────────

    /** Drag the Device Camera Texture asset from the Resources panel here. */
    @Serializable({ displayName: 'Camera Texture' })
    cameraTexture!: Texture;

    /**
     * The Custom Material that has ImageProcessingShader.vert/.frag applied.
     * Drag it from the Resources panel or the Material slot on your screen quad.
     */
    @Serializable({ displayName: 'Processing Material' })
    processingMaterial!: Material;

    /**
     * The output Render Target texture.
     * Create a Render Target asset in Resources, attach it to a Camera's
     * "Render Target" field, then drag that same asset here.
     */
    @Serializable({ displayName: 'Output Render Target' })
    outputRenderTarget!: Texture;

    // ── Tunable Pipeline Uniforms (live-editable in Inspector) ───────────────

    /** High-pass sharpening strength. 0 = off | 1.5 = balanced | 3 = aggressive. */
    @Serializable({ displayName: 'Sharpness Amount', min: 0.0, max: 3.0 })
    sharpnessAmount: number = 1.5;

    /** Bilateral kernel radius in texels. 1 = fast 3x3 | 2 = default 5x5 | 4 = quality 9x9. */
    @Serializable({ displayName: 'Denoise Radius', min: 1.0, max: 4.0 })
    denoiseRadius: number = 2.0;

    /**
     * Adaptive threshold offset relative to local neighbourhood mean.
     * Negative = bias toward black (good for dark ink on bright paper).
     * Positive = bias toward white.
     */
    @Serializable({ displayName: 'Threshold Bias', min: -0.2, max: 0.2 })
    thresholdBias: number = -0.05;

    // ── Internal State ────────────────────────────────────────────────────────

    private mainPass: any = null;
    private isReady: boolean = false;

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    onAwake(): void {
        if (!this.validateInputs()) return;

        this.mainPass = this.processingMaterial.mainPass;

        // Bind the device camera feed to the shader's sampler2D slot.
        // The property name must match the GLSL uniform name exactly.
        this.mainPass.cameraTexture = this.cameraTexture;

        // Derive texel size from camera resolution so the shader can step
        // between neighbouring pixels in UV space.
        const w = this.cameraTexture.getWidth();
        const h = this.cameraTexture.getHeight();
        this.mainPass.texelSize = new vec2(1.0 / w, 1.0 / h);

        this.flushUniforms();

        this.isReady = true;
        console.log(`[ImageProcessing] Ready — camera ${w}x${h}`);
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Update a pipeline uniform at runtime (e.g., driven by a debug slider).
     * paramName must match a GLSL uniform name and a field of this class.
     */
    setUniform(
        paramName: 'sharpnessAmount' | 'denoiseRadius' | 'thresholdBias',
        value: number
    ): void {
        if (!this.mainPass) return;
        (this as any)[paramName] = value;
        this.mainPass[paramName] = value;
    }

    /**
     * Extract the current processed frame from the Render Target as a base64 string.
     *
     * Resolves with a base64-encoded RGBA byte sequence.
     * Pass the result to your OCR engine or encode it as a data-URI.
     *
     * GPU->CPU readback has one-frame latency. Do not call from onAwake —
     * wait until the pipeline has rendered at least one frame.
     */
    captureProcessedFrame(): Promise<string> {
        if (!this.isReady) {
            return Promise.reject(new Error('[ImageProcessing] Not initialized — call after onAwake'));
        }

        return new Promise<string>((resolve, reject) => {
            const provider = this.outputRenderTarget.control as any;

            if (typeof provider?.copyFrame !== 'function') {
                reject(new Error(
                    '[ImageProcessing] RenderTargetProvider.copyFrame() unavailable. ' +
                    'Ensure outputRenderTarget is a Render Target asset, not a plain texture.'
                ));
                return;
            }

            // copyFrame delivers raw RGBA pixels: Uint8Array, 4 bytes per pixel, row-major.
            provider.copyFrame((frame: Uint8Array) => {
                if (!frame || frame.length === 0) {
                    reject(new Error('[ImageProcessing] copyFrame returned empty data'));
                    return;
                }
                resolve(this.encodeBase64(frame));
            });
        });
    }

    /**
     * Convenience wrapper: capture the current frame and log the result length.
     * Replace the console.log with your actual OCR engine handoff.
     */
    triggerOCR(): void {
        this.captureProcessedFrame()
            .then((base64) => {
                console.log(`[ImageProcessing] Frame captured — ${base64.length} base64 chars`);
                // Hand off to your OCR module here:
                // ocrModule.processBase64(base64);
            })
            .catch((err: Error) => {
                console.error(`[ImageProcessing] ${err.message}`);
            });
    }

    // ── Private Helpers ───────────────────────────────────────────────────────

    private validateInputs(): boolean {
        const missing: string[] = [];
        if (!this.cameraTexture)      missing.push('cameraTexture');
        if (!this.processingMaterial) missing.push('processingMaterial');
        if (!this.outputRenderTarget) missing.push('outputRenderTarget');

        if (missing.length > 0) {
            console.error(`[ImageProcessing] Missing Inspector assignments: ${missing.join(', ')}`);
            return false;
        }
        return true;
    }

    private flushUniforms(): void {
        this.mainPass.sharpnessAmount = this.sharpnessAmount;
        this.mainPass.denoiseRadius   = this.denoiseRadius;
        this.mainPass.thresholdBias   = this.thresholdBias;
    }

    /**
     * Encode a Uint8Array as a base64 string.
     * Processes in 32 KB chunks to avoid blowing the JS call stack when
     * spread-calling String.fromCharCode on large frame buffers.
     */
    private encodeBase64(data: Uint8Array): string {
        const CHUNK = 0x8000;
        let binary  = '';
        for (let offset = 0; offset < data.length; offset += CHUNK) {
            binary += String.fromCharCode(...data.subarray(offset, offset + CHUNK));
        }
        return btoa(binary);
    }
}
