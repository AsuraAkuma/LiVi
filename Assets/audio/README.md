Hover SFX (beep) — quick setup

1. Import a short beep MP3 into Lens Studio: drag `beep.mp3` into the `Resources` panel.
2. Create a SceneObject for the audio: right-click the Scene panel → `Add` → `Audio` → `Audio Component`.
3. Assign the imported `beep.mp3` to the Audio Component's clip property.
4. Add the `Scripts/HoverBeepExample.ts` script to the Scene (create a Script component and point to this asset).
5. In the Script component Inspector:
   - Set `target` to the SceneObject you want users to tap/hover (e.g., a text SceneObject).
   - Set `beep` to the Audio Component you created.

Notes:

- The example uses `TouchGestures.onTap(...)` to trigger playback. For hover-style UX you can wire TouchGestures hover/update events or adapt the script to use your existing TextHoverController.
- Keep the beep short (<= 0.5s) for immediate feedback on Spectacles 24.
