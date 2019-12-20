export default class Matcher {
    private readonly buffer;
    private captured;
    private pos;
    private error;
    constructor(buffer: string);
    check(value: string): this;
    capture(endMark: string): this;
    forward(delta: number): this;
    loop(capturedIndex: number, loopCallback: (index: number, match: Matcher) => any): this;
    value(capturedIndex: number, defaultValue?: string): string;
    values(): string[];
    evaluate(): number;
    private ensureState;
}
export declare const withMatcher: (check: (m: Matcher) => Matcher) => (buffer: string) => number;
