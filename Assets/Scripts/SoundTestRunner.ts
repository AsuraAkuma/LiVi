// SoundTestRunner.ts
// Minimal runner to trigger the LiViElevenLabsTest harness from the Inspector or other scripts.
// Inspector fields:
// @input Asset.ScriptComponent testHarness

declare var script: any;

function run() {
    if (script.testHarness && script.testHarness.api && typeof script.testHarness.api.runAllTests === 'function') {
        try { script.testHarness.api.runAllTests(); } catch (e) { console.warn("SoundTestRunner: error running tests", e); }
    } else {
        console.warn("SoundTestRunner: testHarness not configured or missing runAllTests()");
    }
}

script.api = script.api || {};
script.api.run = run;

export {};
