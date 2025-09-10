/**
 * Represents a JSON Patch operation.
 */
export interface Operation {
  op: string;
  path: string;
  value?: any;
  from?: string;
}

/**
 * Base class for change tracking implementations.
 */
export abstract class ChangeTracker {
  protected changes: Operation[] = [];

  /**
   * Track changes to an object and return a proxy.
   */
  abstract track<T>(obj: T): T;

  /**
   * Get and clear accumulated changes.
   */
  flush(): Operation[] {
    const result = [...this.changes];
    this.changes = [];
    return result;
  }

  /**
   * Get accumulated changes without clearing them.
   */
  getChanges(): Operation[] {
    return [...this.changes];
  }

  /**
   * Clear accumulated changes.
   */
  clear(): void {
    this.changes = [];
  }

  /**
   * Add a change operation.
   */
  protected addChange(operation: Operation): void {
    this.changes.push(operation);
  }
}

/**
 * Interface for objects that can provide a diff buffer.
 */
export interface DiffBuffer {
  flush(): Operation[];
  getChanges(): Operation[];
  clear(): void;
}
