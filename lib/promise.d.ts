export interface IDecomposedPromise<T> {
    promise: Promise<T>;
    isResolved: boolean;
    resolve: (result: T) => void;
    reject: (reason?: any) => void;
}
export declare const decomposePromise: <T>() => IDecomposedPromise<T>;
