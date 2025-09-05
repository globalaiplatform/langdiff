import {StreamingObject} from './model';
import {StreamMode, StreamParser} from "openai-partial-stream";

/**
 * Parser for streaming JSON that can handle partial/incomplete JSON strings.
 */
export class Parser {
  private root: StreamingObject<any>;
  private _streamParser: StreamParser;

  constructor(root: StreamingObject<any>) {
    this.root = root;
    this._streamParser = new StreamParser(StreamMode.StreamObjectKeyValueTokens);
  }

  /**
   * Push a chunk of JSON string to the parser.
   */
  push(chunk: string): void {
    if (chunk === '') {
      return;
    }

    const parsed = this._streamParser.parse(chunk);
    if (parsed && (parsed.status === 'COMPLETED' || parsed.status === 'PARTIAL')) {
      this.root.update(parsed.data);
    }
  }

  /**
   * Mark the parsing as complete.
   */
  complete(): void {
    this.root.complete();
  }

  /**
   * Use the parser with automatic completion.
   * Equivalent to Python's context manager behavior.
   * 
   * @example
   * const parser = new Parser(root);
   * parser.use((p) => {
   *   p.push(chunk1);
   *   p.push(chunk2);
   *   // complete() is called automatically
   * });
   */
  use(callback: (parser: Parser) => void): void {
    try {
      callback(this);
    } finally {
      this.complete();
    }
  }
}
