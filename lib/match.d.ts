export default class TextMatch {
    private readonly buffer;
    private captured;
    private pos;
    private error;
    constructor(buffer: string);
    capture(endMark: string): this;
    values(): string[];
    evaluate(): number;
}
export type TextMatchChain = (m: TextMatch) => TextMatch;
export declare const withMatch: (check: TextMatchChain) => (buffer: string) => number;
