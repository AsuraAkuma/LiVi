/**
 * ImageEnhancer.ts
 * Captures a still frame from the Spectacles camera and applies
 * GPU-accelerated noise reduction + sharpening via a custom shader material.
 *
 * Wiring (Inspector):
 *   outputImage       → Image component that displays the result
 *   enhancerMaterial  → Material using the EnhancerShader graph
 *
 * Call recapture() from any other script to re-trigger a capture.
 */

@component
export class ImageEnhancer extends BaseScriptComponent {

    // ── Output ────────────────────────────────────────────────
    @ui.label("Output")
    @ui.group_start("Output")

    @input
    @allowUndefined
    @hint("Image component that will display the enhanced result")
    outputImage?: Image;

    @input
    @allowUndefined
    @hint("Material that has the EnhancerShader graph applied")
    enhancerMaterial?: Material;

    @ui.group_end

    // ── Capture ───────────────────────────────────────────────
    @ui.separator
    @ui.label("Capture Settings")
    @ui.group_start("Capture")

    @input
    @hint("Seconds to wait before first capture (let lens stabilize)")
    captureDelay: number = 0.75;

    @input
    @hint("Warmup frames discarded so auto-exposure can settle")
    warmupFrames: number = 2;

    @input
    @hint("Interval between warmup frames in seconds")
    warmupInterval: number = 0.2;

    @ui.group_end

    // ── Enhancement ───────────────────────────────────────────
    @ui.separator
    @ui.label("Enhancement — tune these in Preview")
    @ui.group_start("Enhancement")

    @input
    @hint("Edge sharpening strength. 0 = off. 1.5 = recommended. 3 = max.")
    sharpness: number = 1.5;

    @input
    @hint("Noise reduction blur. 0 = off. 0.3 = light. 0.7 = heavy.")
    denoiseStrength: number = 0.3;

    @input
    @hint("Brightness offset applied after processing. Range: -0.3 to 0.3")
    brightness: number = 0.05;

    @input
    @hint("Contrast boost. 0 = none. 0.2 = subtle. 0.5 = strong.")
    contrastBoost: number = 0.15;

    @input
    @hint("Saturation multiplier. 1.0 = no change. 1.3 = more vivid.")
    saturation: number = 1.1;

    @ui.group_end

    // ── Debug ─────────────────────────────────────────────────
    @ui.separator
    @input enableLogging: boolean = false;

    // ── Private ───────────────────────────────────────────────
    private cameraModule: any = require('LensStudio:CameraModule');
    private capturing: boolean = false;

    onAwake(): void {
        this.createEvent('OnStartEvent').bind(() => { this.startCapture(); });
    }

    // ─────────────────────────────────────────────────────────
    // Public API
    // ─────────────────────────────────────────────────────────

    /** Re-trigger a capture+enhance cycle from any other script. */
    public recapture(): void {
        this.startCapture();
    }

    // ─────────────────────────────────────────────────────────
    // Capture pipeline
    // ─────────────────────────────────────────────────────────

    private async startCapture(): Promise<void> {
        if (this.capturing) return;
        this.capturing = true;

        try {
            await this.wait(this.captureDelay);

            for (let i = 0; i < this.warmupFrames; i++) {
                await this.captureFrame();
                await this.wait(this.warmupInterval);
            }

            const frame: any = await this.captureFrame();
            this.applyEnhancement(frame.texture);
            this.log("Enhancement applied.");

        } catch (err) {
            print("[ImageEnhancer] Capture error: " + err);
        } finally {
            this.capturing = false;
        }
    }

    private captureFrame(): Promise<any> {
        return this.cameraModule.requestImage(this.cameraModule.createImageRequest());
    }

    private wait(seconds: number): Promise<void> {
        return new Promise(resolve => {
            const e = this.createEvent('DelayedCallbackEvent');
            e.bind(() => { this.removeEvent(e); resolve(); });
            e.reset(Math.max(0, seconds));
        });
    }

    // ─────────────────────────────────────────────────────────
    // Enhancement pass
    // ─────────────────────────────────────────────────────────

    private applyEnhancement(texture: Texture): void {
        if (!texture) { print("[ImageEnhancer] No texture to enhance."); return; }
        if (!this.outputImage) { print("[ImageEnhancer] outputImage not assigned."); return; }

        const w = texture.getWidth();
        const h = texture.getHeight();
        const img = this.outputImage;

        if (this.enhancerMaterial && w > 0 && h > 0) {
            const pass = this.enhancerMaterial.mainPass;
            pass.baseTex        = texture;
            pass.texelSize      = new vec2(1.0 / w, 1.0 / h);
            pass.sharpness      = this.sharpness;
            pass.denoiseStrength = this.denoiseStrength;
            pass.brightness     = this.brightness;
            pass.contrastBoost  = this.contrastBoost;
            pass.saturation     = this.saturation;
            img.mainMaterial    = this.enhancerMaterial;
        } else {
            // Fallback: raw texture with no processing
            if (img.mainMaterial) {
                img.mainMaterial.mainPass.baseTex = texture;
            }
            this.log("enhancerMaterial not set — showing raw texture.");
        }
    }

    private log(msg: string): void {
        if (this.enableLogging) print("[ImageEnhancer] " + msg);
    }
}
