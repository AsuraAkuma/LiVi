/**
 * EventManager.ts
 * 
 * Custom Event Manager for the Spatial Reading Lens.
 * Handles event registration, emission, and debouncing.
 * 
 * Provides a centralized event bus for cross-system communication.
 */

type EventCallback = (data?: any) => void;
type EventCallbackMap = Map<string, EventCallback[]>;

interface EventSubscription {
  unsubscribe: () => void;
}

export interface EventData {
  eventName: string;
  timestamp: number;
  payload?: any;
}

/**
 * DebouncedEventEmitter: Prevents the same event from firing too frequently
 * Useful for preventing onStartWordReached from firing 60 times per second
 */
export class DebouncedEventEmitter {
  private lastEmitTime: Map<string, number> = new Map();
  private debounceTime: number;

  constructor(debounceMilliseconds: number = 100) {
    this.debounceTime = debounceMilliseconds;
  }

  /**
   * Check if enough time has passed since last emit for this event
   */
  canEmit(eventName: string): boolean {
    const now = Date.now();
    const lastTime = this.lastEmitTime.get(eventName) || 0;
    const timeSinceLastEmit = now - lastTime;

    if (timeSinceLastEmit >= this.debounceTime) {
      this.lastEmitTime.set(eventName, now);
      return true;
    }

    return false;
  }

  /**
   * Set debounce time for a specific event
   */
  setDebounceTime(eventName: string, milliseconds: number): void {
    this.debounceTime = milliseconds;
  }

  /**
   * Reset debounce timer for an event
   */
  resetDebounce(eventName: string): void {
    this.lastEmitTime.delete(eventName);
  }

  /**
   * Reset all debounce timers
   */
  resetAllDebounce(): void {
    this.lastEmitTime.clear();
  }
}

/**
 * EventManager: Central event bus for the Spatial Reading Lens
 * 
 * Usage:
 * - Subscribe: eventManager.on('eventName', callback)
 * - Emit: eventManager.emit('eventName', data)
 * - Unsubscribe: subscription.unsubscribe()
 */
export class EventManager {
  private eventCallbacks: EventCallbackMap = new Map();
  private debouncedEmitter: DebouncedEventEmitter;
  private eventHistory: EventData[] = [];
  private maxHistorySize: number = 100;

  constructor(debounceMilliseconds: number = 100) {
    this.debouncedEmitter = new DebouncedEventEmitter(debounceMilliseconds);
  }

  /**
   * Subscribe to an event
   * Returns a subscription object with unsubscribe method
   */
  on(eventName: string, callback: EventCallback): EventSubscription {
    if (!this.eventCallbacks.has(eventName)) {
      this.eventCallbacks.set(eventName, []);
    }

    const callbacks = this.eventCallbacks.get(eventName)!;
    callbacks.push(callback);

    // Return unsubscribe function
    return {
      unsubscribe: () => {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      },
    };
  }

  /**
   * Subscribe to an event, but only fire once
   */
  once(eventName: string, callback: EventCallback): EventSubscription {
    const wrappedCallback = (data?: any) => {
      callback(data);
      subscription.unsubscribe();
    };

    const subscription = this.on(eventName, wrappedCallback);
    return subscription;
  }

  /**
   * Emit an event (regular, not debounced)
   */
  emit(eventName: string, payload?: any): void {
    const callbacks = this.eventCallbacks.get(eventName);

    if (callbacks && callbacks.length > 0) {
      callbacks.forEach((callback) => {
        try {
          callback(payload);
        } catch (error) {
          console.error(`Error in event listener for '${eventName}':`, error);
        }
      });
    }

    // Add to history
    this.recordEventHistory(eventName, payload);
  }

  /**
   * Emit an event with debouncing (respects debounce timer)
   * Returns true if event was emitted, false if debounced
   */
  emitDebounced(eventName: string, payload?: any): boolean {
    if (this.debouncedEmitter.canEmit(eventName)) {
      this.emit(eventName, payload);
      return true;
    }
    return false;
  }

  /**
   * Remove all listeners for an event
   */
  removeAllListeners(eventName?: string): void {
    if (eventName) {
      this.eventCallbacks.delete(eventName);
    } else {
      this.eventCallbacks.clear();
    }
  }

  /**
   * Set debounce time for subsequent emitDebounced calls
   */
  setDebounceTime(milliseconds: number): void {
    this.debouncedEmitter.setDebounceTime('default', milliseconds);
  }

  /**
   * Record event in history for debugging
   */
  private recordEventHistory(eventName: string, payload?: any): void {
    const event: EventData = {
      eventName,
      timestamp: Date.now(),
      payload,
    };

    this.eventHistory.push(event);

    // Maintain max history size
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }
  }

  /**
   * Get event history (useful for debugging)
   */
  getEventHistory(limit?: number): EventData[] {
    if (limit) {
      return this.eventHistory.slice(-limit);
    }
    return [...this.eventHistory];
  }

  /**
   * Clear event history
   */
  clearEventHistory(): void {
    this.eventHistory = [];
  }

  /**
   * Get count of listeners for an event
   */
  listenerCount(eventName: string): number {
    const callbacks = this.eventCallbacks.get(eventName);
    return callbacks ? callbacks.length : 0;
  }
}

/**
 * Singleton instance of EventManager for global use
 * Access via: EventManagerInstance.on(...), etc.
 */
export const EventManagerInstance = new EventManager(100);
