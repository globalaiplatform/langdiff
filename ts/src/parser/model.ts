import { z } from 'zod';
import { BaseSchema } from './schema';

/**
 * Base class for streaming values that are built incrementally.
 */
export abstract class StreamingValue<TOut, TIn = TOut> {
  private _onStartCallbacks: Array<() => void> = [];
  private _onCompleteCallbacks: Array<(value: TOut) => void> = [];
  protected _started: boolean = false;
  protected _completed: boolean = false;

  /**
   * Register a callback that is called when the streaming starts.
   */
  onStart(callback: () => void): void {
    this._onStartCallbacks.push(callback);
  }

  /**
   * Register a callback that is called when the streaming completes.
   */
  onComplete(callback: (value: TOut) => void): void {
    this._onCompleteCallbacks.push(callback);
  }

  /**
   * Trigger start callbacks if not already started.
   */
  protected triggerStart(): void {
    if (!this._started) {
      this._started = true;
      for (const callback of this._onStartCallbacks) {
        callback();
      }
    }
  }

  /**
   * Trigger complete callbacks.
   */
  protected triggerComplete(value: TOut): void {
    if (!this._completed) {
      this._completed = true;
      for (const callback of this._onCompleteCallbacks) {
        callback(value);
      }
    }
  }

  /**
   * Update the streaming value with new data.
   */
  abstract update(value: TIn): void;

  /**
   * Mark the streaming value as complete.
   */
  abstract complete(): void;
}

/**
 * Represents a string that is streamed incrementally.
 */
export class StreamingString extends StreamingValue<string | null> {
  private _value: string | null = null;
  private _onAppendCallbacks: Array<(chunk: string) => void> = [];

  /**
   * Register a callback that is called with each new chunk of the string.
   */
  onAppend(callback: (chunk: string) => void): void {
    this._onAppendCallbacks.push(callback);
  }

  override update(value: string | null): void {
    this.triggerStart();
    
    let chunk: string | null;
    if (this._value === null) {
      chunk = value;
    } else {
      if (value === null || !value.startsWith(this._value)) {
        throw new Error(
          'StreamingString can only be updated with a continuation of the current value.'
        );
      }
      if (value.length === this._value.length) {
        return;
      }
      chunk = value.slice(this._value.length);
    }
    
    if (chunk !== null) {
      for (const callback of this._onAppendCallbacks) {
        callback(chunk);
      }
    }
    this._value = value;
  }

  override complete(): void {
    this.triggerComplete(this._value);
  }

  get value(): string | null {
    return this._value;
  }
}

type UnwrapStreamingValue<T> = T extends StreamingValue<infer U> ? U : never;

/**
 * Represents a list that is streamed incrementally.
 */
export class StreamingList<T extends StreamingValue<any>> extends StreamingValue<UnwrapStreamingValue<T>[]> {
  private _value: UnwrapStreamingValue<T>[] = [];
  private _itemSchema: BaseSchema<T>;
  private _streamingValues: T[] = [];
  private _onAppendCallbacks: Array<(item: T, index: number) => void> = [];

  constructor(itemSchema: BaseSchema<T>) {
    super();
    this._itemSchema = itemSchema;
  }

  /**
   * Register a callback that is called when a new item is appended to the list.
   */
  onAppend(callback: (item: T, index: number) => void): void {
    this._onAppendCallbacks.push(callback);
  }

  override update(value: UnwrapStreamingValue<T>[] | null): void {
    this.triggerStart();
    // Handle null values like Python version - treat as empty array
    const actualValue = value || [];
    if (actualValue.length === 0) {
      this._value = actualValue;
      return;
    }
    this._updateStreaming(actualValue);
  }

  private _updateStreaming(value: UnwrapStreamingValue<T>[]): void {
    const prevCount = this._value.length;
    const count = value.length;
    
    if (count > prevCount) {
      // Complete previous item if exists
      if (prevCount > 0) {
        const s = this._streamingValues[prevCount - 1]!;
        s.update(value[prevCount - 1]);
        s.complete();
      }
      
      // Add new complete items
      for (let i = prevCount; i < count - 1; i++) {
        const s = this._itemSchema.create();
        this._streamingValues.push(s);
        for (const callback of this._onAppendCallbacks) {
          callback(s, i);
        }
        s.update(value[i]);
        s.complete();
      }

      // Add new streaming item
      const s = this._itemSchema.create();
      this._streamingValues.push(s);
      for (const callback of this._onAppendCallbacks) {
        callback(s, count - 1);
      }
      s.update(value[count - 1]);
    } else {
      // Update last item
      const s = this._streamingValues[this._streamingValues.length - 1]!;
      s.update(value[value.length - 1]);
    }
    
    this._value = value;
  }

  override complete(): void {
    if (this._streamingValues.length > 0) {
      const lastValue = this._streamingValues[this._streamingValues.length - 1]!;
      lastValue.complete();
    }
    this.triggerComplete(this._value);
  }

  get value(): T[] {
    return this._value;
  }
}

/**
 * Represents a list that is streamed incrementally.
 */
export class StreamingAtomList<T> extends StreamingValue<T[], unknown[] | null> {
  private _value: unknown[] = [];
  private _outValues: T[] = [];
  private _itemZodSchema: z.ZodType<T>;
  private _onAppendCallbacks: Array<(item: T, index: number) => void> = [];

  constructor(itemZodSchema: z.ZodType<T>) {
    super();
    this._itemZodSchema = itemZodSchema;
  }

  /**
   * Register a callback that is called when a new item is appended to the list.
   */
  onAppend(callback: (item: T, index: number) => void): void {
    this._onAppendCallbacks.push(callback);
  }

  override update(value: unknown[] | null): void {
    this.triggerStart();
    // Handle null values like Python version - treat as empty array
    if (value === null || value.length === 0) {
      this._value = [];
      return;
    }
    this._updateComplete(value);
  }

  private _updateComplete(value: unknown[]): void {
    const prevCount = this._value.length;
    const count = value.length;
    
    if (count > prevCount) {
      const startIdx = prevCount > 0 ? prevCount - 1 : 0;
      for (let i = startIdx; i < count - 1; i++) {
        const s = this._itemZodSchema.parse(value[i]);
        this._outValues.push(s);
        for (const callback of this._onAppendCallbacks) {
          callback(s, i);
        }
      }
    }
    this._value = value;
  }

  override complete(): void {
    if (this._value.length > 0) {
      const i = this._value.length - 1;
      const s = this._itemZodSchema.parse(this._value[i]);
      this._outValues.push(s);
      for (const callback of this._onAppendCallbacks) {
        callback(s, i);
      }
    }

    this.triggerComplete(this._outValues);
  }

  get value(): T[] {
    return this._outValues;
  }
}

/**
 * Represents an atomic value that is received whole, not streamed incrementally.
 */
export class Atom<T> extends StreamingValue<T, unknown> {
  private _value?: unknown;
  private _outValue?: T;

  constructor(private schema: z.ZodType<T>) {
    super();
  }

  override update(value: unknown): void {
    this.triggerStart();
    this._value = value;
  }

  override complete(): void {
    if (this._outValue !== undefined) {
      return;
    }
    this._outValue = this.schema.parse(this._value);
    this.triggerComplete(this._outValue);
  }

  get value(): T | undefined {
    return this._outValue;
  }
}

type UnwrapStreamingObject<T> = {
  [K in keyof T]: T[K] extends StreamingValue<infer U> ? U : never
};

/**
 * Base class for objects that are streamed incrementally.
 */
export class StreamingObject<T extends Record<string, StreamingValue<any>>> extends StreamingValue<UnwrapStreamingObject<T>, Record<string, any>> {
  private _fields: T;
  private _keys: (keyof T)[];
  private _value: Record<string, any> = {};
  private _lastKeyIndex: number | null = null;
  private _onUpdateCallbacks: Array<(value: Record<string, any>) => void> = [];

  constructor(fields: T) {
    super();
    this._fields = fields;
    this._keys = Object.keys(fields);
  }

  /**
   * Register a callback that is called whenever the object is updated.
   */
  onUpdate(callback: (value: Record<string, any>) => void): void {
    this._onUpdateCallbacks.push(callback);
  }

  update(value: Record<string, any>): void {
    this.triggerStart();
    
    // Find the highest index of keys present in the value
    let maxKeyIndex = -1;
    for (let i = 0; i < this._keys.length; i++) {
      if (this._keys[i] in value) {
        maxKeyIndex = i;
      }
    }
    
    // If no keys are found, just update the value
    if (maxKeyIndex === -1) {
      this._value = value;
      for (const callback of this._onUpdateCallbacks) {
        callback(this._value);
      }
      return;
    }
    
    // Complete previous fields if needed
    const startIdx = this._lastKeyIndex === null ? 0 : this._lastKeyIndex + 1;
    
    for (let i = startIdx; i <= maxKeyIndex; i++) {
      const key = this._keys[i];
      if (key in value) {
        // Complete the previous field if this is not the first field
        if (this._lastKeyIndex !== null && this._lastKeyIndex < i) {
          const lastKey = this._keys[this._lastKeyIndex];
          const s = this._fields[lastKey];
          s.update(value[lastKey as string]);
          s.complete();
        }
        this._lastKeyIndex = i;
      }
    }
    
    // Update the current field
    if (maxKeyIndex >= 0) {
      const currentKey = this._keys[maxKeyIndex];
      if (currentKey in value) {
        const s = this._fields[currentKey];
        s.update(value[currentKey as string]);
      }
    }
    
    this._value = value;
    
    for (const callback of this._onUpdateCallbacks) {
      callback(this._value);
    }
  }

  complete(): void {
    // Complete the last active field if there was one
    if (this._lastKeyIndex !== null) {
      const lastKey = this._keys[this._lastKeyIndex];
      const lastValue = this._fields[lastKey];
      lastValue.complete();
    }
    this.triggerComplete(this._value as any);
  }

  getValue(): Record<string, any> {
    return this._value;
  }
}

// Type aliases for convenience
export type String = StreamingString;
export type Object = StreamingObject<any>;
