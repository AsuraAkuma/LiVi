import { Gemini } from 'RemoteServiceGateway.lspkg/HostedExternal/Gemini';
import { GeminiTypes } from 'RemoteServiceGateway.lspkg/HostedExternal/GeminiTypes';
import { MindMapData, parseMindMap } from './MindMap/Scripts/MindMapTypes';

@component
export class GeminiTest extends BaseScriptComponent {
  @input cameraModule: CameraModule;

  @input modelHailMary: SceneObject;
  @input modelBlipA: SceneObject;
  @input modelRocky: SceneObject;

  @input cameraObject: SceneObject;
  @input scanningText: SceneObject;
  @input playSoundScript?: ScriptComponent;

  // How long to wait between auto-scans (seconds)
  private scanInterval: number = 4.0;

  private cameraTexture: Texture | null = null;
  private cameraReady: boolean = false;
  private isScanning: boolean = false;
  private lastKeyword: string = 'NONE';
  private mindMapObjects: SceneObject[] = [];
  private mindMapTransforms: Transform[] = [];

  onAwake() {
    this.createEvent('OnStartEvent').bind(() => {
      this.setupCamera();
      this.hideAllModels();
      this.hideMindMap();
      if (this.scanningText) this.scanningText.enabled = false;
    });

    this.createEvent('UpdateEvent').bind(() => {
      this.updateMindMapFacing();
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

    this.triggerDetectionSound(keyword);

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
        this.hideMindMap();
        return;
    }

    if (modelToShow) {
      this.placeInFrontOfUser(modelToShow);
      modelToShow.enabled = true;
    }

    this.showMindMapForKeyword(keyword);
  }

  private triggerDetectionSound(keyword: string) {
    if (!this.playSoundScript) {
      return;
    }

    const scriptAsAny = this.playSoundScript as any;
    const api = scriptAsAny.api as any;

    if (api && typeof api.play === 'function') {
      api.play();
      print('[Audio] Triggered playSound for keyword ' + keyword + '.');
      return;
    }

    if (api && typeof api.playRequestedSound === 'function') {
      api.playRequestedSound();
      print('[Audio] Triggered playRequestedSound for keyword ' + keyword + '.');
      return;
    }

    print('[Audio] playSoundScript is assigned but does not expose api.play().');
  }

  private showMindMapForKeyword(keyword: string) {
    if (!this.cameraObject) {
      print('[MindMap] cameraObject is missing, cannot render mindmap.');
      return;
    }

    const data = this.buildMindMapData(keyword);
    this.hideMindMap();

    const camTransform = this.cameraObject.getTransform();
    const camPos = camTransform.getWorldPosition();
    const forward = this.safeNormalize(camTransform.back, new vec3(0, 0, -1));
    const right = this.safeNormalize(camTransform.right, new vec3(1, 0, 0));
    const up = this.safeNormalize(camTransform.up, new vec3(0, 1, 0));

    const rootPos = camPos
      .add(forward.uniformScale(170))
      .add(up.uniformScale(-10));

    const rootLabel = data.root.title + '\n' + this.truncate(data.root.description, 84);
    this.createMindMapTextNode('MindMapRoot', rootLabel, rootPos, 34);

    const childCount = data.children.length;
    const radiusX = 90;
    const radiusY = 56;

    for (let i = 0; i < childCount; i++) {
      const angle = (i / Math.max(1, childCount)) * Math.PI * 2;
      const offset = right
        .uniformScale(Math.cos(angle) * radiusX)
        .add(up.uniformScale(Math.sin(angle) * radiusY));

      const child = data.children[i];
      const childLabel = child.title + '\n' + this.truncate(child.description, 60);
      this.createMindMapTextNode('MindMap_' + child.id, childLabel, rootPos.add(offset), 22);
    }

    this.updateMindMapFacing();
  }

  private buildMindMapData(keyword: string): MindMapData {
    let rawJson = '';

    switch (keyword) {
      case 'ROCKY':
        rawJson = '{"root":{"id":"rocky","title":"Rocky","description":"Rocky is an Eridian engineer and Grace\'s first alien ally."},"children":[{"id":"biology","title":"Biology","description":"Rocky has a carapace body, five legs, and senses vibrations instead of light."},{"id":"language","title":"Language","description":"Grace and Rocky build a shared language through sound patterns and symbols."},{"id":"engineering","title":"Engineering","description":"Rocky solves problems with practical engineering and chemistry expertise."},{"id":"friendship","title":"Friendship","description":"Their trust evolves into a mission-critical friendship across species."}]}';
        break;
      case 'BLIPA':
        rawJson = '{"root":{"id":"blipa","title":"Blip-A","description":"Blip-A is Rocky\'s ship with distinct controls and spin-drive systems."},"children":[{"id":"controls","title":"Manual Controls","description":"Its control surfaces are tactile and tuned to Eridian interaction."},{"id":"drives","title":"Spin Drives","description":"The ship uses spin-drive mechanics to move efficiently through space."},{"id":"layout","title":"Ship Layout","description":"Compartments and tools are designed around Rocky\'s biology and workflow."},{"id":"cooperation","title":"Cooperation","description":"Blip-A becomes a shared workspace for joint science and repair efforts."}]}';
        break;
      case 'HAILMARY':
        rawJson = '{"root":{"id":"hailmary","title":"Hail Mary","description":"The Hail Mary is Grace\'s interstellar mission ship built for survival and science."},"children":[{"id":"mission","title":"Mission","description":"Its purpose is to investigate and stop the stellar dimming threat."},{"id":"propulsion","title":"Propulsion","description":"Thrust and fuel systems are tuned for long-duration deep-space travel."},{"id":"centrifuge","title":"Centrifuge Mode","description":"Rotation provides artificial gravity and helps preserve crew health."},{"id":"systems","title":"Core Systems","description":"Life support, navigation, and lab systems enable autonomous operations."}]}';
        break;
      default:
        rawJson = '{"root":{"id":"topic","title":"Topic","description":"No matching topic found."},"children":[]}';
        break;
    }

    try {
      return parseMindMap(rawJson);
    } catch (error) {
      print('[MindMap] Failed to parse generated mindmap JSON: ' + error);
      return {
        root: {
          id: 'fallback',
          title: keyword,
          description: 'Unable to build mindmap data.'
        },
        children: []
      };
    }
  }

  private createMindMapTextNode(name: string, label: string, worldPos: vec3, fontSize: number) {
    const nodeObject = global.scene.createSceneObject(name);
    const nodeTransform = nodeObject.getTransform();
    nodeTransform.setWorldPosition(worldPos);

    const text = nodeObject.createComponent('Component.Text') as Text;
    if (text) {
      text.text = label;
      text.fontSize = fontSize;
    }

    this.mindMapObjects.push(nodeObject);
    this.mindMapTransforms.push(nodeTransform);
  }

  private updateMindMapFacing() {
    if (!this.cameraObject || this.mindMapTransforms.length === 0) {
      return;
    }

    const cameraPos = this.cameraObject.getTransform().getWorldPosition();
    for (let i = 0; i < this.mindMapTransforms.length; i++) {
      const transform = this.mindMapTransforms[i];
      const nodePos = transform.getWorldPosition();
      const toCamera = cameraPos.sub(nodePos);

      if (toCamera.length < 0.0001) {
        continue;
      }

      const facing = toCamera.normalize().uniformScale(-1);
      transform.setWorldRotation(quat.lookAt(facing, vec3.up()));
    }
  }

  private hideMindMap() {
    for (let i = 0; i < this.mindMapObjects.length; i++) {
      this.mindMapObjects[i].destroy();
    }

    this.mindMapObjects = [];
    this.mindMapTransforms = [];
  }

  private truncate(text: string, maxLength: number): string {
    const clean = (text || '').trim();
    if (clean.length <= maxLength) {
      return clean;
    }

    return clean.slice(0, maxLength - 3) + '...';
  }

  private safeNormalize(value: vec3, fallback: vec3): vec3 {
    const length = value.length;
    if (!length || length < 0.0001) {
      return fallback;
    }

    return value.uniformScale(1 / length);
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