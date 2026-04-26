 # LiVi — LiVidere

 LiVi pairs smart spectacles with multimodal machine learning to turn printed text into an interactive, visual reading experience. By scanning pages (images or short video) and extracting concepts with OCR + NLP (e.g., Gemini or other ML models), LiVi overlays 3D models and builds dynamic mind maps to make content easier to understand, remember, and explore — especially for readers with learning differences or cognitive challenges.

## Current prototype status
The project is in an early prototype stage. The following features are implemented in the prototype today:

- **Character mind map (implemented):** The prototype generates a mind map focused on character names and their connections. See the XR prototype in `Livi_XR` for a demo of this functionality.
- **Keyword detection using Gemini (implemented):** Keyword and entity detection is integrated via Gemini and used by the prototype backend for indexing and tag detection (see `server/`).

All other capabilities described in this README — including full OCR pipelines, real-time 3D keyword overlays, offline/on-device processing, broader mind-map categories, and personalization — are planned or future features.

## AI tools used
The prototype and development work for this repository have used the following AI tools:

- **GitHub Copilot (GPT Codex):** assisted with code suggestions and prototyping.
- **Claude:** used for NLP experiments and prompt testing.
- **Cursor:** used for exploratory coding, code navigation, and iterative development.
- **Gemini:** used in the prototype backend for keyword and entity detection.

 ## Why this matters
 Long-form text can be a barrier for many readers: dense paragraphs, unfamiliar vocabulary, and weak memory for relationships all reduce comprehension. LiVi transforms text into visual, spatial, and interactive representations so readers can:

 - Grasp meaning quickly through visual cues and 3D models.
 - See relationships between characters, places, and events with an automatic mind map.
 - Persist and index important concepts over time for personalized review.

 These abilities make reading more accessible, engaging, and memorable.

 ## Core idea (high level)
 - Capture: Spectacles capture images or short video of a page or scene.
 - Read: An OCR step (Gemini or alternative OCR model) converts imagery to text.
 - Understand: NLP extracts keywords, named entities, and relationships; indexing builds a growing concept graph.
 - Augment: Keywords trigger AR overlays — 3D models, icons, or annotations — rendered on the spectacles.
 - Visualize: A linked mind map shows how characters, places, and events connect.
 - Iterate: The system learns and auto-indexes over time, improving relevance and recall.

 ## Key features
 - Real-time capture: Frame selection and preprocessing optimize for OCR from eyewear video.
 - Robust OCR + NLP: Text extraction followed by entity recognition and keyword ranking.
 - Keyword → 3D mapping: Keywords map to an extensible library of 3D assets that can be shown in AR.
 - Interactive mind maps: Auto-generated graphs that link characters, places, events, themes, and more.
 - Personalization & memory: Session indexing, user-defined keywords, and adaptive highlighting.
 - Accessibility-first design: Visual substitution, contextual anchors, and reduced cognitive load.

 ## Accessibility use cases (who benefits)
 LiVi is intentionally designed to support readers with a range of needs:

 - Dyslexia and language-processing differences: Visual reinforcement (3D models) bypasses decoding bottlenecks; mind maps anchor concepts.
 - ADHD: Stimulating, interactive 3D elements increase engagement; mind maps externalize structure and reduce working-memory demands.
 - Autism spectrum: Explicit categorization and predictable, non-social interactions make abstract content more interpretable.
 - Aphasia and TBI: Semantic substitution via visual models and spatial memory cues aid recall and comprehension.
 - Non-Verbal Learning Disability (NVLD): Guided visualization helps form spatial and proportional understanding of concepts.

 Each of the above can be supported by configurable presentation modes (simplified models, reduced animation, larger labels, audio cues, etc.).

 ## Technical architecture (prototype)
 The current prototype separates capture, processing, and rendering into modular components:

 1. Spectacles: capture images and stream frames/events to a local device or companion app.
 2. Ingest/Preprocess: select frames, denoise, and perform perspective correction.
 3. OCR: run a text-recognition model (Gemini, Tesseract, or an on-device OCR pipeline).
 4. NLP & Indexing: extract keywords, entities, and relationships; build/update a concept graph.
 5. Keyword routing: resolve keywords to 3D assets and presentation rules (size, position, interactivity).
 6. Renderer / UI: spectacles or companion device render 3D overlays and the mind-map UI; interactions update the index.

 Prototype artifacts in this repo:
 - [Livi_XR](Livi_XR): XR project assets and scenes (prototype AR experiences).
 - [server](server): backend processing (OCR, NLP, indexing and APIs).

 ## Example user flows
 - Quick lookup: glance at a paragraph, see a 3D model for a technical term, tap the node to get a short definition and context.
 - Character explorer: read a chapter, then open the mind map to trace relationships and events for a given character.
 - Study session: the system compiles indexed keywords into a review set; users revisit visual anchors to strengthen recall.

 ## Ethics, privacy & safety
 - Local-first design: when possible, text extraction and sensitive processing can run on-device to avoid sending raw images to remote servers.
 - User control: users choose whether to persist, sync, or share indexed data; opt-in only for cloud features.
 - Minimization: only extracted concepts (not raw page images) need to be retained for long-term indexing unless explicitly permitted.
 - Accessibility-first defaults: customizable presentation modes to avoid overstimulation.

 ## Roadmap / next milestones
 - Offline OCR & NLP pipelines for low-latency, private operation.
 - Expanded asset library and community contribution model for keyword→3D mapping.
 - Improved mind-map interaction and filtering (time-based, subject-based).
 - Pilot studies with educators and accessibility organizations; quantitative evaluation.
 - SDK for publishers and app partners to integrate LiVi features into other reading apps.

 ## Getting started (prototype)
 - See the prototype folders: [Livi_XR](Livi_XR) and [server](server).
 - Backend services and demos live in `server/` — consult [server/README.md](server/README.md) for run instructions.
 - Open the XR scenes in the `Livi_XR` project to explore AR prototypes.

 ## Contributing
 - Ideas, assets, and experiments welcome. Open issues and PRs for: asset mappings, OCR/NLP improvements, performance tuning, and accessibility testing.
 - If you're interested in pilots or research collaborations, please open an issue or contact the maintainers.

 ## Contact & acknowledgements
 - Project maintainers: AsuraAkuma and contributors.
 - Inspired by research in multimodal learning, AR-assisted education, and accessibility-first UX design.

 ---
 This README is a living document; it will expand as prototypes mature and pilot results inform product direction.
