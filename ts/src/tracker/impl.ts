import { ChangeTracker, Operation } from './change-tracker';

/**
 * Base class for JSON Patch change trackers with common proxy logic.
 */
abstract class BaseJSONPatchChangeTracker extends ChangeTracker {
  track<T>(obj: T): T {
    return this.createProxy(obj, '');
  }

  private createProxy<T>(obj: T, path: string): T {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return this.createArrayProxy(obj, path) as unknown as T;
    }

    return this.createObjectProxy(obj as Record<string, any>, path) as unknown as T;
  }

  private createObjectProxy(obj: Record<string, any>, path: string): Record<string, any> {
    const tracker = this;
    
    // First, wrap all existing properties that are objects or arrays
    for (const [key, value] of Object.entries(obj)) {
      if (value !== null && typeof value === 'object') {
        const propPath = path + '/' + key;
        obj[key] = tracker.createProxy(value, propPath);
      }
    }
    
    return new Proxy(obj, {
      set(target, property, value, receiver) {
        const propPath = path + '/' + String(property);
        const oldValue = target[property as string];
        
        tracker.handleObjectPropertyChange(oldValue, value, propPath);
        
        // Wrap the new value in a proxy if it's an object
        const proxiedValue = tracker.createProxy(value, propPath);
        return Reflect.set(target, property, proxiedValue, receiver);
      },
      
      deleteProperty(target, property) {
        const propPath = path + '/' + String(property);
        tracker.addChange({
          op: 'remove',
          path: propPath,
        });
        return Reflect.deleteProperty(target, property);
      },
    });
  }

  /**
   * Handle array element change - to be implemented by subclasses
   */
  protected abstract handleArrayElementChange(
    target: any[],
    index: number,
    newValue: any,
    propPath: string
  ): void;

  /**
   * Handle object property change - to be implemented by subclasses
   */
  protected abstract handleObjectPropertyChange(
    oldValue: any,
    newValue: any,
    propPath: string
  ): void;

  private createArrayProxy(arr: any[], path: string): any[] {
    const tracker = this;
    
    // First, wrap all existing array elements that are objects
    for (let i = 0; i < arr.length; i++) {
      if (arr[i] !== null && typeof arr[i] === 'object') {
        const itemPath = path + '/' + i;
        arr[i] = tracker.createProxy(arr[i], itemPath);
      }
    }
    
    return new Proxy(arr, {
      set(target, property, value, receiver) {
        if (property === 'length') {
          return Reflect.set(target, property, value, receiver);
        }
        
        const index = Number(property);
        if (isNaN(index)) {
          return Reflect.set(target, property, value, receiver);
        }
        
        const propPath = path + '/' + String(property);
        
        tracker.handleArrayElementChange(target, index, value, propPath);
        
        // Wrap the new value in a proxy if it's an object
        const proxiedValue = tracker.createProxy(value, propPath);
        return Reflect.set(target, property, proxiedValue, receiver);
      },
      
      get(target, property, receiver) {
        if (property === 'push') {
          return function(...items: any[]) {
            const startIndex = target.length;
            const result = Array.prototype.push.apply(target, items);
            
            // Track each pushed item
            items.forEach((item, i) => {
              const itemIndex = startIndex + i;
              const itemPath = path + '/' + itemIndex;
              tracker.addChange({
                op: 'add',
                path: path + '/-',
                value: item,
              });
              
              // Replace the item with a proxy version
              const proxiedItem = tracker.createProxy(item, itemPath);
              target[itemIndex] = proxiedItem;
            });
            
            return result;
          };
        }
        
        if (property === 'pop') {
          return function() {
            const lastIndex = target.length - 1;
            if (lastIndex >= 0) {
              tracker.addChange({
                op: 'remove',
                path: path + '/' + lastIndex,
              });
            }
            return Array.prototype.pop.apply(target);
          };
        }
        
        if (property === 'splice') {
          return function(start: number, deleteCount?: number, ...items: any[]) {
            const oldLength = target.length;
            
            // For simplicity, track splice as individual operations
            // Remove elements
            if (deleteCount && deleteCount > 0) {
              for (let i = 0; i < deleteCount; i++) {
                tracker.addChange({
                  op: 'remove',
                  path: path + '/' + (start + i),
                });
              }
            }
            
            // Add new elements
            if (items.length > 0) {
              items.forEach((item, i) => {
                const insertIndex = start + i;
                tracker.addChange({
                  op: 'add',
                  path: path + '/' + insertIndex,
                  value: item,
                });
              });
            }
            
            const result = Array.prototype.splice.apply(target, [start, deleteCount || 0, ...items]);
            
            // Re-proxy all items that are objects
            for (let i = 0; i < target.length; i++) {
              if (target[i] !== null && typeof target[i] === 'object') {
                const itemPath = path + '/' + i;
                target[i] = tracker.createProxy(target[i], itemPath);
              }
            }
            
            return result;
          };
        }
        
        return Reflect.get(target, property, receiver);
      },
    });
  }
}

/**
 * JSON Patch change tracker that generates standard JSON Patch operations.
 */
export class JSONPatchChangeTracker extends BaseJSONPatchChangeTracker {
  protected handleArrayElementChange(
    target: any[],
    index: number,
    newValue: any,
    propPath: string
  ): void {
    const isNewIndex = index >= target.length;
    
    if (isNewIndex) {
      // Add operation for new array elements
      this.addChange({
        op: 'add',
        path: propPath.replace(/\/\d+$/, '/-'),
        value: newValue,
      });
    } else {
      // Standard replace operation for existing elements
      this.addChange({
        op: 'replace',
        path: propPath,
        value: newValue,
      });
    }
  }

  protected handleObjectPropertyChange(
    oldValue: any,
    newValue: any,
    propPath: string
  ): void {
    if (oldValue === undefined) {
      // Add operation
      this.addChange({
        op: 'add',
        path: propPath,
        value: newValue,
      });
    } else {
      // Standard replace operation only (no append optimization)
      this.addChange({
        op: 'replace',
        path: propPath,
        value: newValue,
      });
    }
  }
}

/**
 * Enhanced JSON Patch change tracker with efficient string append operations.
 */
export class EfficientJSONPatchChangeTracker extends BaseJSONPatchChangeTracker {
  protected handleArrayElementChange(
    target: any[],
    index: number,
    newValue: any,
    propPath: string
  ): void {
    const isNewIndex = index >= target.length;
    const oldValue = isNewIndex ? undefined : target[index];
    
    if (isNewIndex) {
      // Add operation for new array elements
      this.addChange({
        op: 'add',
        path: propPath.replace(/\/\d+$/, '/-'),
        value: newValue,
      });
    } else {
      // Check for string append operation on existing elements
      if (typeof oldValue === 'string' && typeof newValue === 'string' && newValue.startsWith(oldValue)) {
        const appendedPart = newValue.slice(oldValue.length);
        if (appendedPart.length > 0) {
          this.addChange({
            op: 'append',
            path: propPath,
            value: appendedPart,
          });
        }
      } else {
        // Replace operation
        this.addChange({
          op: 'replace',
          path: propPath,
          value: newValue,
        });
      }
    }
  }

  protected handleObjectPropertyChange(
    oldValue: any,
    newValue: any,
    propPath: string
  ): void {
    // Check for string append operation
    if (typeof oldValue === 'string' && typeof newValue === 'string' && newValue.startsWith(oldValue)) {
      const appendedPart = newValue.slice(oldValue.length);
      if (appendedPart.length > 0) {
        this.addChange({
          op: 'append',
          path: propPath,
          value: appendedPart,
        });
      }
    } else if (oldValue === undefined) {
      // Add operation
      this.addChange({
        op: 'add',
        path: propPath,
        value: newValue,
      });
    } else {
      // Replace operation
      this.addChange({
        op: 'replace',
        path: propPath,
        value: newValue,
      });
    }
  }
}
