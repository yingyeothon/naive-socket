"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const debug = (...args) => !!process.env.DEBUG ? console.debug(...args) : 0;
class Matcher {
    constructor(buffer) {
        this.buffer = buffer;
        this.captured = [];
        this.pos = 0;
        this.error = false;
        this.ensureState = () => {
            if (!this.error && (this.pos < 0 || this.pos > this.buffer.length)) {
                this.error = true;
            }
            return this;
        };
    }
    check(value) {
        if (this.error) {
            return this;
        }
        if (this.buffer.length < this.pos ||
            this.buffer.substring(this.pos, this.pos + value.length) !== value) {
            debug(`Cannot check`, value, `from`, this.buffer);
            this.error = true;
            return this;
        }
        this.pos += value.length;
        debug(`Check OK`, value, `from`, this.buffer);
        debug(`Pos`, this.pos);
        return this.ensureState();
    }
    capture(endMark) {
        if (this.error) {
            return this;
        }
        const start = this.pos;
        this.pos = this.buffer.indexOf(endMark, start);
        if (this.pos < 0) {
            this.error = true;
            debug(`Cannot check`, endMark, `from`, this.buffer);
            return this;
        }
        this.captured.push(this.buffer.slice(start, this.pos));
        debug(`Capture OK`, this.captured[this.captured.length - 1], `from`, this.buffer, `mark`, endMark);
        this.pos += endMark.length;
        debug(`Pos`, this.pos);
        return this.ensureState();
    }
    forward(delta) {
        if (this.error) {
            return this;
        }
        this.pos += delta;
        debug(`Pos`, this.pos, `forwarded`, delta);
        return this.ensureState();
    }
    loop(capturedIndex, loopCallback) {
        const count = +this.value(capturedIndex, "0");
        for (let i = 0; i < count; ++i) {
            if (this.error) {
                break;
            }
            debug(`In loop`, i, `pos`, this.pos);
            loopCallback(i, this);
            this.ensureState();
        }
        return this;
    }
    value(capturedIndex, defaultValue = "") {
        if (this.captured.length <= capturedIndex) {
            this.error = true;
            return defaultValue;
        }
        debug(`In captured`, capturedIndex, `is`, this.captured[capturedIndex]);
        return this.captured[capturedIndex];
    }
    values() {
        return [...this.captured];
    }
    evaluate() {
        return this.error ? -1 : this.pos;
    }
}
exports.default = Matcher;
exports.withMatcher = (check) => (buffer) => check(new Matcher(buffer)).evaluate();
//# sourceMappingURL=match.js.map