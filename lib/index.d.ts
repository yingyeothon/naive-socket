interface ILogger {
    info: typeof console.info;
    warn: typeof console.warn;
    error: typeof console.error;
}
interface INaiveSocketOptions {
    host: string;
    port: number;
    connectionRetryInterval?: number;
    logger?: ILogger;
}
interface ISendWorkOptions {
    fulfill: ((buffer: string) => number) | RegExp | number;
    timeoutMillis: number;
}
interface ISendWorkArguments {
    message: string;
}
export default class NaiveSocket {
    private readonly host;
    private readonly port;
    private readonly logger;
    private readonly sendWorks;
    private currentBuffer;
    private connectionState;
    private socket;
    private alive;
    private connectionRetryInterval;
    constructor({ host, port, connectionRetryInterval, logger }: INaiveSocketOptions);
    send: (request: ISendWorkArguments & Partial<ISendWorkOptions>) => Promise<string>;
    disconnect: () => void;
    private buildSendWork;
    private connect;
    private doDisconnect;
    private onConnect;
    private onClose;
    private retryToConnect;
    private onError;
    private onData;
    private doNextSendWork;
}
export {};
