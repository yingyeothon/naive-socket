export interface DecomposedPromise<T> {
    promise: Promise<T>;
    isResolved: boolean;
    resolve: (result: T) => void;
    reject: (reason?: unknown) => void;
}
export declare const decomposePromise: <T>() => DecomposedPromise<T>;
