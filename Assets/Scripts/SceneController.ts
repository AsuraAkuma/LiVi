// SceneController.ts
// Top-level orchestrator to wire components in the Scene Inspector.
// Inspector fields:
// @input Asset.ScriptComponent ttsScript
// @input Asset.ScriptComponent sfxScript
// @input Asset.ScriptComponent hoverController

declare var script: any;

script.api = script.api || {};

script.initializeElevenLabs = function() {
    console.log("SceneController: initializeElevenLabs called");
    if (script.ttsScript) console.log("SceneController: TTS script present");
    if (script.sfxScript) console.log("SceneController: SFX script present");
    if (script.hoverController) console.log("SceneController: Hover controller present");
};

script.api.initialize = script.initializeElevenLabs;

script.initializeElevenLabs();

export {};
