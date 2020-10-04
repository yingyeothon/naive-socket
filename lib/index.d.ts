interface Logger {
    info: typeof console.info;
    warn: typeof console.warn;
    error: typeof console.error;
}
declare type ConnectionStateListener = (params: {
    socket: NaiveSocket;
    state: ConnectionState;
}) => void;
interface NaiveSocketOptions {
    host: string;
    port: number;
    connectionRetryInterval?: number;
    logger?: Logger;
    onConnectionStateChanged?: ConnectionStateListener;
}
export declare enum ConnectionState {
    Connecting = "Connecting",
    Connected = "Connected",
    Disconnected = "Disconnected"
}
interface SendWorkOptions {
    fulfill: ((buffer: string) => number) | RegExp | number;
    timeoutMillis: number;
    urgent?: boolean;
}
interface SendWorkArguments {
    message: string;
}
export default class NaiveSocket {
    private readonly host;
    private readonly port;
    private readonly logger;
    private readonly onConnectionStateChanged;
    private readonly sendWorks;
    private currentBuffer;
    private connectionState;
    private socket;
    private alive;
    private connectionRetryInterval;
    constructor({ host, port, connectionRetryInterval, logger, onConnectionStateChanged, }: NaiveSocketOptions);
    send: (request: SendWorkArguments & Partial<SendWorkOptions>) => Promise<string>;
    disconnect: () => void;
    private buildSendWork;
    private changeConnectionState;
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
