"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.decomposePromise = void 0;
class DecomposedPromise {
    constructor(promise, resolveProxy, rejectProxy) {
        this.promise = promise;
        this.resolveProxy = resolveProxy;
        this.rejectProxy = rejectProxy;
        this.resolved = false;
        this.resolve = (result) => {
            if (this.resolved) {
                return;
            }
            this.resolved = true;
            this.resolveProxy(result);
        };
        this.reject = (reason) => {
            if (this.resolved) {
                return;
            }
            this.resolved = true;
            this.rejectProxy(reason);
        };
    }
    get isResolved() {
        return this.resolved;
    }
}
exports.decomposePromise = () => {
    let resolve;
    let reject;
    const promise = new Promise((newResolve, newReject) => {
        resolve = newResolve;
        reject = newReject;
    });
    return new DecomposedPromise(promise, resolve, reject);
};
//# sourceMappingURL=promise.js.map