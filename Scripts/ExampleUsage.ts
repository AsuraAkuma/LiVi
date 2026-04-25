/**
 * ExampleUsage.ts
 * 
 * Example integration showing how to use the Spatial Reading Lens system.
 * This demonstrates practical usage patterns for audio playback, visual effects, and state management.
 */

import { Component, Serializable, SceneObject } from '@lens-studio/snapchat-sdk';
import { SpatialReadingController } from './SpatialReadingController';
import { EventManagerInstance } from './EventManager';

/**
 * EXAMPLE 1: Basic Audio Playback on Word Regions
 * 
 * This component demonstrates playing audio when the user's finger reaches specific words.
 */
@Component
export class AudioPlaybackExample {
  @Serializable({ displayName: 'Spatial Reading Controller' })
  controller!: SceneObject;

  /**
   * Define your audio content mapped to regions
   */
  private audioContent = [
    {
      regionName: 'StartWord',
      audioClip: 'audio/start_word.mp3',
      duration: 2.5,
    },
    {
      regionName: 'MiddleSection',
      audioClip: 'audio/middle_section.mp3',
      duration: 5.0,
    },
  ];

  private currentlyPlayingRegion: string | null = null;

  onAwake(): void {
    if (!this.controller) {
      console.error('AudioPlaybackExample: controller not assigned');
      return;
    }

    const spatialController = this.controller.getComponent(SpatialReadingController);
    if (!spatialController) {
      console.error('AudioPlaybackExample: SpatialReadingController not found');
      return;
    }

    // Set up audio triggers for each region
    this.audioContent.forEach((content) => {
      // Listen for entering region
      spatialController.addEventListener(`${content.regionName}_onEnter`, (data: any) => {
        console.log(`Playing audio for: ${content.regionName}`);
        this.playAudio(content.audioClip);
        this.currentlyPlayingRegion = content.regionName;
      });

      // Listen for exiting region
      spatialController.addEventListener(`${content.regionName}_onExit`, (data: any) => {
        console.log(`Stopping audio for: ${content.regionName}`);
        this.stopAudio();
        this.currentlyPlayingRegion = null;
      });
    });
  }

  private playAudio(clipPath: string): void {
    // Implementation depends on your audio system
    // Example:
    // AudioManager.playClip(clipPath);
    console.log(`[Audio] Playing: ${clipPath}`);
  }

  private stopAudio(): void {
    // Stop current playback
    console.log('[Audio] Stopped');
  }
}

/**
 * EXAMPLE 2: Visual Feedback with Highlighting
 * 
 * Shows how to highlight text regions as the user points to them.
 */
@Component
export class VisualHighlightExample {
  @Serializable({ displayName: 'Spatial Reading Controller' })
  controller!: SceneObject;

  @Serializable({ displayName: 'Highlight Material' })
  highlightMaterial!: any; // Material

  /**
   * Tracks which regions are currently highlighted
   */
  private highlightedRegions: Map<string, any> = new Map();

  onAwake(): void {
    const spatialController = this.controller.getComponent(SpatialReadingController);
    if (!spatialController) return;

    spatialController.addEventListener('StartWord_onEnter', () => {
      this.highlightRegion('StartWord', { r: 1, g: 0.5, b: 0 }); // Orange
    });

    spatialController.addEventListener('StartWord_onExit', () => {
      this.removeHighlight('StartWord');
    });

    spatialController.addEventListener('MiddleSection_onEnter', () => {
      this.highlightRegion('MiddleSection', { r: 0, g: 1, b: 0 }); // Green
    });

    spatialController.addEventListener('MiddleSection_onExit', () => {
      this.removeHighlight('MiddleSection');
    });
  }

  private highlightRegion(regionName: string, color: { r: number; g: number; b: number }): void {
    console.log(`[Visual] Highlighting ${regionName} with color:`, color);
    // Create visual effect at UV position
    // This might involve:
    // 1. Showing a highlight quad at the region
    // 2. Changing material emission
    // 3. Playing a particle effect
    this.highlightedRegions.set(regionName, color);
  }

  private removeHighlight(regionName: string): void {
    console.log(`[Visual] Removing highlight from ${regionName}`);
    this.highlightedRegions.delete(regionName);
  }
}

/**
 * EXAMPLE 3: Progress Tracking and State Management
 * 
 * Tracks reading progress and manages complex interactions.
 */
@Component
export class ProgressTrackerExample {
  @Serializable({ displayName: 'Spatial Reading Controller' })
  controller!: SceneObject;

  /**
   * Reading history tracking
   */
  private readingHistory: Array<{
    regionName: string;
    timestamp: number;
    uvPosition: { x: number; y: number };
  }> = [];

  private totalTimeInRegions: Map<string, number> = new Map();
  private regionEnterTime: Map<string, number> = new Map();

  onAwake(): void {
    // Hook into event system to track all region entries/exits
    EventManagerInstance.on('StartWord_onEnter', (data: any) => {
      this.handleRegionEntry('StartWord', data);
    });

    EventManagerInstance.on('MiddleSection_onEnter', (data: any) => {
      this.handleRegionEntry('MiddleSection', data);
    });

    EventManagerInstance.on('StartWord_onExit', (data: any) => {
      this.handleRegionExit('StartWord', data);
    });

    EventManagerInstance.on('MiddleSection_onExit', (data: any) => {
      this.handleRegionExit('MiddleSection', data);
    });
  }

  private handleRegionEntry(regionName: string, data: any): void {
    console.log(`[Progress] Entered region: ${regionName}`);

    // Record entry time
    this.regionEnterTime.set(regionName, Date.now());

    // Add to history
    this.readingHistory.push({
      regionName,
      timestamp: data.timestamp,
      uvPosition: data.uvPosition,
    });
  }

  private handleRegionExit(regionName: string, _data: any): void {
    console.log(`[Progress] Exited region: ${regionName}`);

    // Calculate time spent in region
    const enterTime = this.regionEnterTime.get(regionName);
    if (enterTime) {
      const timeSpent = Date.now() - enterTime;
      const currentTotal = this.totalTimeInRegions.get(regionName) || 0;
      this.totalTimeInRegions.set(regionName, currentTotal + timeSpent);

      console.log(`[Progress] Time in ${regionName}: ${(timeSpent / 1000).toFixed(2)}s`);
    }
  }

  /**
   * PUBLIC API: Get reading statistics
   */
  getReadingStats(): {
    regionsVisited: number;
    totalTimeTracked: number;
    regionBreakdown: Map<string, number>;
  } {
    let totalTime = 0;
    this.totalTimeInRegions.forEach((time) => {
      totalTime += time;
    });

    return {
      regionsVisited: this.readingHistory.length,
      totalTimeTracked: totalTime,
      regionBreakdown: this.totalTimeInRegions,
    };
  }

  /**
   * PUBLIC API: Get reading history
   */
  getReadingHistory(): typeof this.readingHistory {
    return [...this.readingHistory];
  }
}

/**
 * EXAMPLE 4: Adaptive Content Based on Reading Speed
 * 
 * Adjusts content complexity based on how quickly the user reads.
 */
@Component
export class AdaptiveContentExample {
  @Serializable({ displayName: 'Spatial Reading Controller' })
  controller!: SceneObject;

  private lastRegionExitTime: number = 0;
  private averageReadingSpeed: number = 0;

  onAwake(): void {
    const spatialController = this.controller.getComponent(SpatialReadingController);
    if (!spatialController) return;

    spatialController.addEventListener('StartWord_onExit', (data: any) => {
      this.analyzeReadingSpeed('StartWord', data);
    });

    spatialController.addEventListener('MiddleSection_onExit', (data: any) => {
      this.analyzeReadingSpeed('MiddleSection', data);
    });
  }

  private analyzeReadingSpeed(regionName: string, data: any): void {
    const currentTime = Date.now();
    const timeSinceLastRegion = currentTime - this.lastRegionExitTime;

    // Estimate reading speed (rough heuristic)
    // In a real implementation, would be more sophisticated
    this.averageReadingSpeed = (this.averageReadingSpeed + timeSinceLastRegion) / 2;

    console.log(`[Adaptive] Reading speed for ${regionName}: ${this.averageReadingSpeed.toFixed(0)}ms per region`);

    // Adjust content based on speed
    if (this.averageReadingSpeed < 500) {
      console.log('[Adaptive] User reading fast - show simple mode');
      this.setContentDifficulty('simple');
    } else if (this.averageReadingSpeed < 2000) {
      console.log('[Adaptive] User reading normal - show standard mode');
      this.setContentDifficulty('standard');
    } else {
      console.log('[Adaptive] User reading slow - show detailed mode');
      this.setContentDifficulty('detailed');
    }

    this.lastRegionExitTime = currentTime;
  }

  private setContentDifficulty(difficulty: 'simple' | 'standard' | 'detailed'): void {
    // Show/hide different UI elements based on reading pace
    console.log(`[Adaptive] Setting content difficulty to: ${difficulty}`);
  }
}

/**
 * EXAMPLE 5: Multi-Language Support with Finger Tracking
 * 
 * Demonstrates translating text as the user points to words.
 */
@Component
export class MultiLanguageExample {
  @Serializable({ displayName: 'Spatial Reading Controller' })
  controller!: SceneObject;

  /**
   * Vocabulary lookup (word region → translations)
   */
  private vocabularyMap: Map<
    string,
    {
      translations: { [key: string]: string };
      definitions: { [key: string]: string };
    }
  > = new Map([
    [
      'StartWord',
      {
        translations: { es: 'Palabra de Inicio', fr: 'Mot de Début', ja: 'スタート単語' },
        definitions: { en: 'The initial word', es: 'La palabra inicial', fr: 'Le mot initial' },
      },
    ],
  ]);

  private currentLanguage: string = 'es'; // Spanish by default

  onAwake(): void {
    const spatialController = this.controller.getComponent(SpatialReadingController);
    if (!spatialController) return;

    this.vocabularyMap.forEach((vocab, regionName) => {
      spatialController.addEventListener(`${regionName}_onEnter`, (data: any) => {
        this.showTranslation(regionName, vocab);
      });
    });
  }

  private showTranslation(
    regionName: string,
    vocab: { translations: { [key: string]: string }; definitions: { [key: string]: string } }
  ): void {
    const translation = vocab.translations[this.currentLanguage] || 'Translation not available';
    const definition = vocab.definitions[this.currentLanguage] || 'Definition not available';

    console.log(`[Multi-Language] ${regionName}:`);
    console.log(`  Translation: ${translation}`);
    console.log(`  Definition: ${definition}`);

    // Display as UI overlay
    // this.displayTranslationOverlay(translation, definition);
  }

  /**
   * PUBLIC API: Change active language
   */
  setLanguage(languageCode: string): void {
    this.currentLanguage = languageCode;
    console.log(`[Multi-Language] Language changed to: ${languageCode}`);
  }
}

/**
 * EXPORT: Simple helper to set up all examples
 * 
 * Usage in your main scene:
 * setupAllExamples(controllerObject);
 */
export function setupAllExamples(controllerObject: SceneObject): void {
  console.log('[Examples] Setting up all example components...');

  // In a real implementation, you would add these as components
  // controllerObject.addComponent(AudioPlaybackExample);
  // controllerObject.addComponent(VisualHighlightExample);
  // controllerObject.addComponent(ProgressTrackerExample);
  // controllerObject.addComponent(AdaptiveContentExample);
  // controllerObject.addComponent(MultiLanguageExample);

  console.log('[Examples] All examples initialized');
}
