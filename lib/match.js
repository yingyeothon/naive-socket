"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.withMatch = void 0;
const debug = (...args) => !!process.env.DEBUG ? console.debug(`[TEXT_MATCH]`, ...args) : 0;
class TextMatch {
    constructor(buffer) {
        this.buffer = buffer;
        this.captured = [];
        this.pos = 0;
        this.error = false;
    }
    capture(endMark) {
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
    values() {
        return [...this.captured];
    }
    evaluate() {
        return this.error ? -1 : this.pos;
    }
}
exports.default = TextMatch;
const withMatch = (check) => (buffer) => check(new TextMatch(buffer)).evaluate();
exports.withMatch = withMatch;
//# sourceMappingURL=match.js.map