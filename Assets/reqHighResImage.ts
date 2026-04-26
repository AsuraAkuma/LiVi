@component
export class reqHighResImage extends BaseScriptComponent {
    @input image?: Image = undefined;

    @input("Component.ScriptComponent")
    @hint("Optional: ScriptComponent for ImageEnhancer. If assigned, captured frames will be sent to its processTexture API for enhancement.")
    @allowUndefined
    enhancerScript?: ScriptComponent;

    @input
    captureDelaySeconds: number = 0.75;

    @input
    useWarmupCapture: boolean = true;

    @input
    warmupCaptureCount: number = 2;

    @input
    warmupCaptureIntervalSeconds: number = 0.25;

    @input
    previewBrightness: number = 1.0;

    @input
    enableAdaptiveBrightness: boolean = true;

    @input
    focalPoint: vec2 = new vec2(0.5, 0.5);

    @input
    focalSampleRadius: number = 0.12;

    @input
    targetFocalLuma: number = 0.58;

    @input
    minAdaptiveBrightness: number = 0.55;

    @input
    maxAdaptiveBrightness: number = 1.25;

    private cameraModule: CameraModule = require('LensStudio:CameraModule');
    private isCapturing: boolean = false;
    private grayscaleBuffer: Uint8Array | undefined = undefined;
    private grayscaleBufferWidth: number = 0;
    private grayscaleBufferHeight: number = 0;

    onAwake() {
        this.createEvent('OnStartEvent').bind(() => {
            this.requestStillImage();
        });
    }

    private resolveOutputImage(): Image | undefined {
        if (this.image) {
            return this.image;
        }

        const sceneImage = this.getSceneObject().getComponent('Component.Image') as Image | null;
        if (sceneImage) {
            this.image = sceneImage;
        }

        return this.image;
    }

    private delay(seconds: number): Promise<void> {
        const clampedDelay = Math.max(0, seconds);
        return new Promise((resolve) => {
            const delayEvent = this.createEvent('DelayedCallbackEvent');
            delayEvent.bind(() => {
                this.removeEvent(delayEvent);
                resolve();
            });
            delayEvent.reset(clampedDelay);
        });
    }

    private async captureFrame(): Promise<ImageFrame> {
        const imageRequest = CameraModule.createImageRequest();
        return await this.cameraModule.requestImage(imageRequest);
    }

    private clamp(value: number, minValue: number, maxValue: number): number {
        return Math.max(minValue, Math.min(maxValue, value));
    }

    private getGrayscaleBuffer(width: number, height: number): Uint8Array {
        if (!this.grayscaleBuffer || this.grayscaleBufferWidth !== width || this.grayscaleBufferHeight !== height) {
            this.grayscaleBuffer = new Uint8Array(width * height);
            this.grayscaleBufferWidth = width;
            this.grayscaleBufferHeight = height;
        }

        return this.grayscaleBuffer;
    }

    private getAdaptiveBrightness(texture: Texture): number {
        if (!this.enableAdaptiveBrightness) {
            return this.previewBrightness;
        }

        try {
            const width = texture.getWidth();
            const height = texture.getHeight();
            if (width <= 0 || height <= 0) {
                return this.previewBrightness;
            }

            const buffer = this.getGrayscaleBuffer(width, height);
            TensorMath.textureToGrayscale(texture, buffer, new vec3(width, height, 1));

            const normalizedX = this.clamp(this.focalPoint.x, 0, 1);
            const normalizedY = this.clamp(this.focalPoint.y, 0, 1);
            const centerX = Math.floor(normalizedX * (width - 1));
            const centerY = Math.floor(normalizedY * (height - 1));

            const radiusRatio = this.clamp(this.focalSampleRadius, 0.01, 0.5);
            const radiusPixels = Math.max(1, Math.floor(Math.min(width, height) * radiusRatio));

            const minX = Math.max(0, centerX - radiusPixels);
            const maxX = Math.min(width - 1, centerX + radiusPixels);
            const minY = Math.max(0, centerY - radiusPixels);
            const maxY = Math.min(height - 1, centerY + radiusPixels);

            let luminanceSum = 0;
            let sampleCount = 0;
            for (let y = minY; y <= maxY; y++) {
                const rowOffset = y * width;
                for (let x = minX; x <= maxX; x++) {
                    luminanceSum += buffer[rowOffset + x];
                    sampleCount++;
                }
            }

            if (sampleCount <= 0) {
                return this.previewBrightness;
            }

            const focalLuma = (luminanceSum / sampleCount) / 255;
            const safeLuma = Math.max(0.05, focalLuma);
            const targetLuma = this.clamp(this.targetFocalLuma, 0.1, 0.95);
            const exposureScale = targetLuma / safeLuma;
            const desiredBrightness = this.previewBrightness * exposureScale;
            const minBrightness = this.minAdaptiveBrightness;
            const maxBrightness = Math.max(this.minAdaptiveBrightness, this.maxAdaptiveBrightness);

            return this.clamp(desiredBrightness, minBrightness, maxBrightness);
        } catch (error) {
            print('Adaptive brightness analysis failed: ' + error);
            return this.previewBrightness;
        }
    }

    private applyPreviewBrightness(outputImage: Image, texture: Texture) {
        const brightness = this.getAdaptiveBrightness(texture);
        outputImage.mainPass.baseColor = new vec4(brightness, brightness, brightness, 1);
    }

    async requestStillImage() {
        if (this.isCapturing) {
            return;
        }

        this.isCapturing = true;

        try {
            await this.delay(this.captureDelaySeconds);

            if (this.useWarmupCapture) {
                // Discard a few early frames so auto-exposure can settle in bright scenes.
                const warmupCount = Math.max(0, Math.floor(this.warmupCaptureCount));
                for (let i = 0; i < warmupCount; i++) {
                    await this.captureFrame();
                    await this.delay(this.warmupCaptureIntervalSeconds);
                }
            }

            const imageFrame: ImageFrame = await this.captureFrame();
            const outputImage = this.resolveOutputImage();

            if (this.enhancerScript) {
                // If an ImageEnhancer ScriptComponent is wired, send the captured texture to it.
                try {
                    const api: any = (this.enhancerScript as any).api ?? this.enhancerScript;
                    const proc = api?.processTexture;
                    if (typeof proc === 'function') {
                        proc.call(api, imageFrame.texture);
                    } else {
                        // Fallback: no processTexture API found
                        if (outputImage) {
                            outputImage.mainPass.baseTex = imageFrame.texture;
                            this.applyPreviewBrightness(outputImage, imageFrame.texture);
                        } else {
                            print('Still image captured, but no Image component was found to display it.');
                        }
                    }
                } catch (e) {
                    print('[reqHighResImage] enhancer process failed: ' + e);
                    if (outputImage) {
                        outputImage.mainPass.baseTex = imageFrame.texture;
                        this.applyPreviewBrightness(outputImage, imageFrame.texture);
                    }
                }
            } else {
                if (outputImage) {
                    outputImage.mainPass.baseTex = imageFrame.texture;
                    this.applyPreviewBrightness(outputImage, imageFrame.texture);
                } else {
                    print('Still image captured, but no Image component was found to display it.');
                }
            }
        } catch (error) {
            print('Still image request failed: ' + error);
        } finally {
            this.isCapturing = false;
        }
    }

}

