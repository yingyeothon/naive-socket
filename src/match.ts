const debug = (...args: unknown[]) =>
  !!process.env.DEBUG ? console.debug(`[TEXT_MATCH]`, ...args) : 0;

export default class TextMatch {
  private captured: string[] = [];
  private pos = 0;
  private error = false;

  constructor(private readonly buffer: string) {}

  public capture(endMark: string): this {
    if (this.error) {
      return this;
    }
    const start = this.pos;
    this.pos = this.buffer.indexOf(endMark, start);
    if (this.pos < 0) {
      this.error = true;
      debug(`No endMark[${endMark}] in [${this.buffer}]`);
      return this;
    }
    const captured = this.buffer.slice(start, this.pos);
    this.captured.push(captured);
    debug(`Capture [${captured}] by endMark[${endMark} in [${this.buffer}]`);

    this.pos += endMark.length;
    debug(`Pos [${this.pos}]`);

    if (!this.error && (this.pos < 0 || this.pos > this.buffer.length)) {
      this.error = true;
    }
    return this;
  }

  public values(): string[] {
    return [...this.captured];
  }

  public evaluate(): number {
    return this.error ? -1 : this.pos;
  }
}

export type TextMatchChain = (m: TextMatch) => TextMatch;

export const withMatch = (check: TextMatchChain) => (buffer: string): number =>
  check(new TextMatch(buffer)).evaluate();
