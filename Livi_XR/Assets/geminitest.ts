import { Gemini } from 'RemoteServiceGateway.lspkg/HostedExternal/Gemini';
import { GeminiTypes } from 'RemoteServiceGateway.lspkg/HostedExternal/GeminiTypes';

@component
export class GeminiTest extends BaseScriptComponent {
  @input cameraModule: CameraModule;

  @input modelHailMary: SceneObject;
  @input modelBlipA: SceneObject;
  @input modelRocky: SceneObject;

  @input cameraObject: SceneObject;
  @input scanningText: SceneObject;

  // How long to wait between auto-scans (seconds)
  private scanInterval: number = 4.0;

  private cameraTexture: Texture | null = null;
  private cameraReady: boolean = false;
  private isScanning: boolean = false;
  private lastKeyword: string = 'NONE';

  onAwake() {
    this.createEvent('OnStartEvent').bind(() => {
      this.setupCamera();
      this.hideAllModels();
      if (this.scanningText) this.scanningText.enabled = false;
    });
  }

  setupCamera() {
    print('Setting up camera...');

    const request = CameraModule.createCameraRequest();
    request.cameraId = CameraModule.CameraId.Default_Color;

    this.cameraTexture = this.cameraModule.requestCamera(request);

    if (!this.cameraTexture) {
      print('❌ requestCamera returned null');
      return;
    }

    print('Camera requested. Waiting for first frame...');

    const provider = this.cameraTexture.control as CameraTextureProvider;
    provider.onNewFrame.add(() => {
      if (this.cameraReady) return;

      const w = this.cameraTexture!.getWidth();
      const h = this.cameraTexture!.getHeight();
      if (w === 0 || h === 0) return;

      this.cameraReady = true;
      print('✅ Camera ready (' + w + 'x' + h + '). Starting auto-scan.');

      // Kick off the always-on scan loop as soon as the camera is ready
      this.scanLoop();
    });
  }

  // Recursive timed loop: scan, wait, scan, wait... forever
  scanLoop() {
    this.scanPage();

    const delayedEvent = this.createEvent('DelayedCallbackEvent');
    delayedEvent.bind(() => {
      this.scanLoop();
    });
    delayedEvent.reset(this.scanInterval);
  }

  scanPage() {
    if (this.isScanning) {
      print('(previous scan still running, skipping this cycle)');
      return;
    }
    if (!this.cameraReady || !this.cameraTexture) {
      return;
    }

    this.isScanning = true;
    if (this.scanningText) this.scanningText.enabled = true;

    Base64.encodeTextureAsync(
      this.cameraTexture,
      (base64String: string) => {
        this.askGeminiForKeyword(base64String);
      },
      () => {
        print('❌ Failed to encode camera texture');
        this.endScan();
      },
      CompressionQuality.LowQuality,
      EncodingType.Jpg
    );
  }

  endScan() {
    if (this.scanningText) this.scanningText.enabled = false;
    this.isScanning = false;
  }

  askGeminiForKeyword(base64Image: string) {
    const prompt =
      'You are looking at a page of the novel "Project Hail Mary" by Andy Weir. ' +
      'Read the text on the page. Reply with EXACTLY ONE WORD from this list, no punctuation, no explanation:\n' +
      '- ROCKY (if the page describes the alien named Rocky, his body, his five legs, his carapace, or his shirt)\n' +
      '- BLIPA (if the page describes the alien ship called Blip-A, the manual control panel, or the spin drives)\n' +
      '- HAILMARY (if the page shows or describes the Hail Mary ship, the thrust configuration, or the centrifuge mode)\n' +
      '- NONE (if the camera shows no readable book page at all — e.g. a wall, hands, a desk, a closed book, or a blurry frame — OR if the page is about something else entirely)\n\n' +
      'Reply with one word only.';

    const request: GeminiTypes.Models.GenerateContentRequest = {
      model: 'gemini-2.5-flash',
      type: 'generateContent',
      body: {
        contents: [
          {
            parts: [
              { inline_data: { mime_type: 'image/jpeg', data: base64Image } },
              { text: prompt },
            ],
            role: 'user',
          },
        ],
      },
    };

    Gemini.models(request)
      .then((response) => {
        const raw = response.candidates[0].content.parts[0].text || '';
        const keyword = this.normalizeKeyword(raw);
        print('🧠 Gemini: "' + raw.trim() + '" → ' + keyword);
        this.handleKeyword(keyword);
        this.endScan();
      })
      .catch((error) => {
        print('❌ Error: ' + error);
        this.endScan();
      });
  }

  normalizeKeyword(raw: string): string {
    const cleaned = raw.toUpperCase().replace(/[^A-Z]/g, '');
    if (cleaned.indexOf('ROCKY') !== -1) return 'ROCKY';
    if (cleaned.indexOf('BLIPA') !== -1) return 'BLIPA';
    if (cleaned.indexOf('HAILMARY') !== -1) return 'HAILMARY';
    return 'NONE';
  }

  hideAllModels() {
    if (this.modelHailMary) this.modelHailMary.enabled = false;
    if (this.modelBlipA) this.modelBlipA.enabled = false;
    if (this.modelRocky) this.modelRocky.enabled = false;
  }

  handleKeyword(keyword: string) {
    // Don't re-spawn the same model if Gemini returns the same keyword twice in a row.
    if (keyword === this.lastKeyword) {
      return;
    }
    this.lastKeyword = keyword;

    this.hideAllModels();

    let modelToShow: SceneObject | null = null;
    switch (keyword) {
      case 'ROCKY':
        modelToShow = this.modelRocky;
        print('👽 Showing Rocky.');
        break;
      case 'BLIPA':
        modelToShow = this.modelBlipA;
        print('🛸 Showing Blip-A.');
        break;
      case 'HAILMARY':
        modelToShow = this.modelHailMary;
        print('🚀 Showing Hail Mary.');
        break;
      case 'NONE':
        print('🤷 No matching keyword — keeping models hidden.');
        return;
    }

    if (modelToShow) {
      this.placeInFrontOfUser(modelToShow);
      modelToShow.enabled = true;
    }
  }

  placeInFrontOfUser(obj: SceneObject) {
    if (!this.cameraObject) return;

    const camTransform = this.cameraObject.getTransform();
    const camPos = camTransform.getWorldPosition();
    const camForward = camTransform.back;

    const distance = 200;
    const targetPos = new vec3(
      camPos.x + camForward.x * distance,
      camPos.y + camForward.y * distance,
      camPos.z + camForward.z * distance
    );

    const objTransform = obj.getTransform();
    objTransform.setWorldPosition(targetPos);

    const lookAtPos = new vec3(camPos.x, targetPos.y, camPos.z);
    const direction = lookAtPos.sub(targetPos).normalize();
    const rotation = quat.lookAt(direction, vec3.up());
    objTransform.setWorldRotation(rotation);
  }
}