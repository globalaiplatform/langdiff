import { Operation } from './change-tracker';

// Use require to avoid TypeScript import issues
const jsonPatch = require('fast-json-patch');

/**
 * JSON Patch Operation interface
 */
interface JsonPatchOperation {
  op: 'add' | 'remove' | 'replace' | 'move' | 'copy' | 'test';
  path: string;
  value?: any;
  from?: string;
}

/**
 * Apply JSON Patch operations to an object.
 */
export function applyChange(obj: any, operations: Operation[]): void {
  const standardOps: JsonPatchOperation[] = [];
  
  for (const op of operations) {
    if (op.op === 'append') {
      // Handle custom append operation for string concatenation
      applyAppendOperation(obj, op);
    } else {
      // Convert to standard JSON Patch operation
      const standardOp: JsonPatchOperation = {
        op: op.op as any,
        path: op.path,
        value: op.value,
      };
      if (op.from) {
        standardOp.from = op.from;
      }
      standardOps.push(standardOp);
    }
  }
  
  if (standardOps.length > 0) {
    jsonPatch.applyPatch(obj, standardOps);
  }
}

/**
 * Apply a custom append operation for string concatenation.
 */
function applyAppendOperation(obj: any, operation: Operation): void {
  const path = operation.path;
  const value = operation.value;
  
  if (!path.startsWith('/')) {
    throw new Error('Invalid path: must start with "/"');
  }
  
  const pathParts = path.slice(1).split('/');
  let current = obj;
  
  // Navigate to the parent object
  for (let i = 0; i < pathParts.length - 1; i++) {
    const part = pathParts[i];
    current = current[part];
    if (current === undefined) {
      throw new Error(`Path not found: ${path}`);
    }
  }
  
  const lastPart = pathParts[pathParts.length - 1];
  
  if (typeof current[lastPart] !== 'string') {
    throw new Error('Append operation can only be applied to strings');
  }
  
  current[lastPart] += value;
}

export { Operation };
