export interface IDecomposedPromise<T> {
  promise: Promise<T>;
  isResolved: boolean;

  resolve: (result: T) => void;
  reject: (reason?: any) => void;
}

type Resolve<T> = (result: T) => void;
type Reject = (reason?: any) => void;

class DecomposedPromise<T> implements IDecomposedPromise<T> {
  private resolved: boolean = false;

  constructor(
    public readonly promise: Promise<T>,
    private readonly resolveProxy: Resolve<T>,
    private readonly rejectProxy: Reject
  ) {}

  public get isResolved() {
    return this.resolved;
  }

  public resolve: Resolve<T> = result => {
    if (this.resolved) {
      return;
    }
    this.resolved = true;
    this.resolveProxy(result);
  };

  public reject: Reject = reason => {
    if (this.resolved) {
      return;
    }
    this.resolved = true;
    this.rejectProxy(reason);
  };
}

export const decomposePromise = <T>(): IDecomposedPromise<T> => {
  let resolve: Resolve<T> | undefined;
  let reject: Reject | undefined;
  const promise = new Promise<T>((newResolve, newReject) => {
    resolve = newResolve;
    reject = newReject;
  });
  return new DecomposedPromise<T>(promise, resolve!, reject!);
};
