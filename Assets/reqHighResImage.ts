@component
export class reqHighResImage extends BaseScriptComponent {
    @input displayTarget: Image | undefined = undefined;
    @input captureOnAwake: boolean = true;

    private readonly cameraModule: CameraModule = require("LensStudio:CameraModule") as CameraModule;
    private isCaptureInProgress = false;

    onAwake() {
        if (this.captureOnAwake) {
            void this.captureHighResImage();
        }

        // Trigger this with a Tap Event for manual recapture.
        this.createEvent("TapEvent").bind(() => {
            void this.captureHighResImage();
        });
    }

    private async captureHighResImage(): Promise<Texture | undefined> {
        if (this.isCaptureInProgress) {
            print("Capture already in progress, skipping request.");
            return undefined;
        }

        this.isCaptureInProgress = true;

        try {
            print("Capturing high-res frame...");

            const imageRequest = CameraModule.createImageRequest();
            const imageFrame = await this.cameraModule.requestImage(imageRequest);
            print("Image captured, processing...");

            if (this.displayTarget) {
                print("Displaying captured image...");
                this.displayTarget.mainPass.baseTex = imageFrame.texture;
            } else {
                print("No display target set, image captured but not displayed.");
            }

            print("Capture successful! Resolution: 3200x2400");
            return imageFrame.texture;
        } catch (error) {
            print("Capture failed: " + String(error));
            return undefined;
        } finally {
            this.isCaptureInProgress = false;
        }
    }
}

