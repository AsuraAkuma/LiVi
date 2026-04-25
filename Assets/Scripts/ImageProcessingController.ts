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

@component
export class ImageProcessingController extends BaseScriptComponent {

    // ── Inspector Bindings ────────────────────────────────────────────────────

    /** Drag the Device Camera Texture asset from the Resources panel here. */
    @input
    @allowUndefined
    cameraTexture!: Texture;

    /**
     * The Custom Material that has ImageProcessingShader.vert/.frag applied.
     * Drag it from the Resources panel or the Material slot on your screen quad.
     */
    @input
    @allowUndefined
    processingMaterial!: Material;

    /**
     * The output Render Target texture.
     * Create a Render Target asset in Resources, attach it to a Camera's
     * "Render Target" field, then drag that same asset here.
     */
    @input
    @allowUndefined
    outputRenderTarget!: Texture;

    // ── Tunable Pipeline Uniforms (live-editable in Inspector) ───────────────

    /** High-pass sharpening strength. 0 = off | 1.5 = balanced | 3 = aggressive. */
    @input
    sharpnessAmount: number = 1.5;

    /** Bilateral kernel radius in texels. 1 = fast 3x3 | 2 = default 5x5 | 4 = quality 9x9. */
    @input
    denoiseRadius: number = 2.0;

    /**
     * Adaptive threshold offset relative to local neighbourhood mean.
     * Negative = bias toward black (good for dark ink on bright paper).
     * Positive = bias toward white.
     */
    @input
    thresholdBias: number = -0.05;

    // ── Internal State ────────────────────────────────────────────────────────

    private mainPass: any = null;
    private isReady: boolean = false;

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    onAwake(): void {
        this.ensureDependencies();

        if (!this.validateInputs()) return;

        this.mainPass = this.resolveMainPass(this.processingMaterial);
        if (!this.mainPass) {
            console.error(
                '[ImageProcessing] processingMaterial does not expose a valid render pass. ' +
                'Assign a Custom Material that uses ImageProcessingShader.'
            );
            return;
        }

        try {
            // Bind the device camera feed to the shader's sampler2D slot.
            // The property name must match the GLSL uniform name exactly.
            this.mainPass.cameraTexture = this.cameraTexture;

            // Derive texel size from camera resolution so the shader can step
            // between neighbouring pixels in UV space.
            const size = this.tryGetTextureSize(this.cameraTexture);
            if (size) {
                this.mainPass.texelSize = new vec2(1.0 / size.width, 1.0 / size.height);
                console.log(`[ImageProcessing] Ready — camera ${size.width}x${size.height}`);
            } else {
                // Fallback keeps shader functional when camera texture metadata is not ready on Awake.
                this.mainPass.texelSize = new vec2(1.0 / 1024.0, 1.0 / 1024.0);
                console.warn('[ImageProcessing] Ready — camera size unavailable on Awake, using fallback texelSize 1/1024');
            }

            this.flushUniforms();
            this.isReady = true;
        } catch (err: unknown) {
            this.isReady = false;
            this.mainPass = null;
            console.error(`[ImageProcessing] Initialization failed: ${this.describeError(err)}`);
        }
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

    private ensureDependencies(): void {
        const camera = this.findOrCreateCamera();

        this.ensureOutputRenderTarget(camera);
        this.ensureCameraTexture(camera);
        this.ensureProcessingMaterial();

        if (camera && this.outputRenderTarget) {
            try {
                camera.renderTarget = this.outputRenderTarget;
            } catch (err: unknown) {
                console.warn(`[ImageProcessing] Failed to assign camera renderTarget: ${this.describeError(err)}`);
            }
        }
    }

    private findOrCreateCamera(): Camera | null {
        const existing = this.findFirstComponentInScene('Camera');
        if (existing) {
            return existing;
        }

        try {
            const cameraObject = global.scene.createSceneObject('ImageProcessing Auto Camera');
            const createdCamera = cameraObject.createComponent('Camera');
            console.warn('[ImageProcessing] Created fallback Camera object for automatic setup.');
            return createdCamera;
        } catch (err: unknown) {
            console.warn(`[ImageProcessing] Failed to create fallback Camera object: ${this.describeError(err)}`);
            return null;
        }
    }

    private ensureOutputRenderTarget(camera: Camera | null): void {
        if (this.outputRenderTarget && this.hasCopyFrame(this.outputRenderTarget)) {
            return;
        }

        let candidate: Texture | null = null;

        if (camera) {
            candidate = this.safeGetTexture(() => camera.renderTarget);
            if (candidate && !this.hasCopyFrame(candidate)) {
                candidate = null;
            }
        }

        if (!candidate) {
            candidate = this.safeGetTexture(() => global.scene.captureTarget);
            if (candidate && !this.hasCopyFrame(candidate)) {
                candidate = null;
            }
        }

        if (!candidate) {
            candidate = this.safeGetTexture(() => global.scene.liveTarget);
            if (candidate && !this.hasCopyFrame(candidate)) {
                candidate = null;
            }
        }

        if (!candidate) {
            candidate = this.tryRequireTexture([
                'Render Target.renderTarget',
                'Render Target',
                'Assets/Render Target.renderTarget',
            ]);
        }

        if (!candidate) {
            try {
                candidate = global.scene.createRenderTargetTexture();
                console.warn('[ImageProcessing] Created runtime Render Target texture for automatic setup.');
            } catch (err: unknown) {
                console.warn(`[ImageProcessing] Failed to create runtime Render Target texture: ${this.describeError(err)}`);
            }
        }

        if (candidate) {
            this.outputRenderTarget = candidate;
            if (camera) {
                try {
                    camera.renderTarget = candidate;
                } catch (err: unknown) {
                    console.warn(`[ImageProcessing] Failed to bind Render Target to Camera: ${this.describeError(err)}`);
                }
            }
        }
    }

    private ensureCameraTexture(camera: Camera | null): void {
        if (this.cameraTexture) {
            return;
        }

        let candidate: Texture | null = null;

        if (camera) {
            candidate = this.safeGetTexture(() => camera.inputTexture);
        }

        if (!candidate && this.outputRenderTarget) {
            candidate = this.safeGetTexture(() => (this.outputRenderTarget.control as any).inputTexture as Texture);
        }

        if (!candidate) {
            candidate = this.tryRequireTexture([
                'Device Camera Texture.deviceCameraTexture',
                'Device Camera Texture',
                'Assets/Device Camera Texture.deviceCameraTexture',
            ]);
        }

        if (!candidate) {
            candidate = this.safeGetTexture(() => global.scene.liveTarget);
        }

        if (candidate) {
            this.cameraTexture = candidate;
            if (camera) {
                try {
                    camera.inputTexture = candidate;
                } catch {
                    // Some camera setups do not expose writable inputTexture.
                }
            }
        }
    }

    private ensureProcessingMaterial(): void {
        if (this.processingMaterial) {
            return;
        }

        let candidate: Material | null = this.tryRequireMaterial([
            'Material.mat',
            'Material',
            'Image.mat',
            'Image',
            'Assets/Material.mat',
            'Assets/Image.mat',
        ]);

        if (!candidate) {
            const image = this.findFirstComponentInScene('Image');
            if (image) {
                try {
                    candidate = image.mainMaterial;
                } catch (err: unknown) {
                    console.warn(`[ImageProcessing] Failed to read material from existing Image component: ${this.describeError(err)}`);
                }
            }
        }

        if (!candidate) {
            candidate = this.createFallbackImageMaterial();
        }

        if (candidate) {
            this.processingMaterial = candidate;
        }
    }

    private createFallbackImageMaterial(): Material | null {
        try {
            const outputObject = global.scene.createSceneObject('ImageProcessing Auto Output');
            outputObject.setParentPreserveWorldTransform(this.sceneObject);
            outputObject.createComponent('ScreenTransform');
            const image = outputObject.createComponent('Image');

            if (this.outputRenderTarget) {
                try {
                    image.mainPass.baseTex = this.outputRenderTarget;
                } catch (err: unknown) {
                    console.warn(`[ImageProcessing] Failed to assign output texture to fallback Image: ${this.describeError(err)}`);
                }
            }

            console.warn('[ImageProcessing] Created fallback Image object to provide a runtime material.');
            return image.mainMaterial;
        } catch (err: unknown) {
            console.warn(`[ImageProcessing] Failed to create fallback Image material: ${this.describeError(err)}`);
            return null;
        }
    }

    private findFirstComponentInScene<K extends keyof ComponentNameMap>(typeName: K): ComponentNameMap[K] | null {
        const rootCount = global.scene.getRootObjectsCount();
        for (let i = 0; i < rootCount; i++) {
            const root = global.scene.getRootObject(i);
            const found = this.findFirstComponentInHierarchy(root, typeName);
            if (found) {
                return found;
            }
        }

        return null;
    }

    private findFirstComponentInHierarchy<K extends keyof ComponentNameMap>(
        node: SceneObject,
        typeName: K
    ): ComponentNameMap[K] | null {
        try {
            const component = node.getComponent(typeName);
            if (component && !isNull(component)) {
                return component;
            }
        } catch {
            // Some SceneObjects simply do not have a component of this type.
        }

        const childCount = node.getChildrenCount();
        for (let i = 0; i < childCount; i++) {
            const child = node.getChild(i);
            const found = this.findFirstComponentInHierarchy(child, typeName);
            if (found) {
                return found;
            }
        }

        return null;
    }

    private tryRequireTexture(names: string[]): Texture | null {
        for (let i = 0; i < names.length; i++) {
            const asset = this.tryRequireAsset(names[i]);
            if (this.isTexture(asset)) {
                return asset;
            }
        }

        return null;
    }

    private tryRequireMaterial(names: string[]): Material | null {
        for (let i = 0; i < names.length; i++) {
            const asset = this.tryRequireAsset(names[i]);
            if (this.isMaterial(asset)) {
                return asset;
            }
        }

        return null;
    }

    private tryRequireAsset(name: string): Asset | null {
        try {
            const asset = requireAsset(name);
            if (asset && !isNull(asset)) {
                return asset;
            }
        } catch {
            // Asset lookup can fail for invalid path/name candidates.
        }

        return null;
    }

    private safeGetTexture(getter: () => Texture): Texture | null {
        try {
            const texture = getter();
            if (texture && !isNull(texture)) {
                return texture;
            }
        } catch {
            // Host properties may throw while backing assets are still initializing.
        }

        return null;
    }

    private hasCopyFrame(texture: Texture): boolean {
        try {
            return typeof (texture.control as any)?.copyFrame === 'function';
        } catch {
            return false;
        }
    }

    private isTexture(value: unknown): value is Texture {
        const texture = value as Texture;
        return !!texture
            && typeof texture.getWidth === 'function'
            && typeof texture.getHeight === 'function';
    }

    private isMaterial(value: unknown): value is Material {
        const material = value as Material;
        return !!material
            && (typeof material.getPass === 'function' || !!(material as any).mainPass);
    }

    private validateInputs(): boolean {
        const missing: string[] = [];
        if (!this.cameraTexture) missing.push('cameraTexture');
        if (!this.processingMaterial) missing.push('processingMaterial');
        if (!this.outputRenderTarget) missing.push('outputRenderTarget');

        if (missing.length > 0) {
            console.error(`[ImageProcessing] Missing Inspector assignments: ${missing.join(', ')}`);
            return false;
        }
        return true;
    }

    private resolveMainPass(material: Material): any | null {
        try {
            const pass = (material as any).mainPass;
            if (pass) return pass;
        } catch (err: unknown) {
            console.warn(`[ImageProcessing] material.mainPass unavailable: ${this.describeError(err)}`);
        }

        try {
            const candidate = material as any;
            if (typeof candidate.getPass === 'function') {
                const pass = candidate.getPass(0);
                if (pass) return pass;
            }
        } catch (err: unknown) {
            console.warn(`[ImageProcessing] material.getPass(0) failed: ${this.describeError(err)}`);
        }

        return null;
    }

    private tryGetTextureSize(texture: Texture): { width: number; height: number } | null {
        try {
            const width = texture.getWidth();
            const height = texture.getHeight();
            if (width > 0 && height > 0) {
                return { width, height };
            }
        } catch (err: unknown) {
            console.warn(`[ImageProcessing] Failed to read camera texture size: ${this.describeError(err)}`);
        }

        return null;
    }

    private describeError(err: unknown): string {
        if (err instanceof Error) return err.message;
        return String(err);
    }

    private flushUniforms(): void {
        this.mainPass.sharpnessAmount = this.sharpnessAmount;
        this.mainPass.denoiseRadius = this.denoiseRadius;
        this.mainPass.thresholdBias = this.thresholdBias;
    }

    /**
     * Encode a Uint8Array as a base64 string.
     * Uses a local encoder so we do not depend on browser globals like btoa.
     */
    private encodeBase64(data: Uint8Array): string {
        const TABLE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
        let result = '';
        let i = 0;

        while (i + 2 < data.length) {
            const block = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
            result += TABLE[(block >> 18) & 63];
            result += TABLE[(block >> 12) & 63];
            result += TABLE[(block >> 6) & 63];
            result += TABLE[block & 63];
            i += 3;
        }

        const remaining = data.length - i;
        if (remaining === 1) {
            const block = data[i] << 16;
            result += TABLE[(block >> 18) & 63];
            result += TABLE[(block >> 12) & 63];
            result += '==';
        } else if (remaining === 2) {
            const block = (data[i] << 16) | (data[i + 1] << 8);
            result += TABLE[(block >> 18) & 63];
            result += TABLE[(block >> 12) & 63];
            result += TABLE[(block >> 6) & 63];
            result += '=';
        }

        return result;
    }
}
