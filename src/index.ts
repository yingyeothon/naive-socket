import { Socket } from "net";
import { decomposePromise, IDecomposedPromise } from "./promise";

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

enum ConnectionState {
  Connecting = "Connecting",
  Connected = "Connected",
  Disconnected = "Disconnected"
}

interface ISendWorkOptions {
  /**
   * A function to check if a buffer is fulfilled for my request.
   * If the return value is a positive it would accept a buffer with that length,
   * otherwise wait more response would be come.
   */
  isFulfilled: (buffer: string) => number;

  /**
   * A milliseconds to timeout this send work.
   */
  timeoutMillis: number;
}

interface ISendWorkArguments {
  /**
   * A thing to do send.
   */
  message: string;
}

interface ISendWorkInternal {
  dPromise: IDecomposedPromise<string>;
  timer: NodeJS.Timer | null;
}

interface ISendWork
  extends ISendWorkInternal,
    ISendWorkArguments,
    ISendWorkOptions {}

export default class NaiveSocket {
  private readonly host: string;
  private readonly port: number;
  private readonly logger: ILogger;

  private readonly sendWorks: ISendWork[] = [];
  private currentBuffer: string = "";
  private connectionState: ConnectionState = ConnectionState.Disconnected;
  private socket: Socket | null = null;
  private alive: boolean = true;

  private connectionRetryInterval: number;

  constructor({
    host,
    port,
    connectionRetryInterval = 0,
    logger = {
      info: !!process.env.DEBUG ? console.info : () => 0,
      warn: console.warn,
      error: console.error
    }
  }: INaiveSocketOptions) {
    this.host = host;
    this.port = port;
    this.connectionRetryInterval = connectionRetryInterval;
    this.logger = logger;
  }

  public send = (
    request: ISendWorkArguments & Partial<ISendWorkOptions>
  ): Promise<string> => {
    this.alive = true;
    const newWork = this.buildSendWork(request);
    this.sendWorks.push(newWork);
    if (this.sendWorks.length === 1) {
      this.doNextSendWork();
    }
    return newWork.dPromise.promise;
  };

  public disconnect = () => {
    this.alive = false;
    this.logger.info(`[NaiveSocket]`, `Socket is dead`);
    this.doDisconnect();
  };

  private buildSendWork = ({
    message,
    isFulfilled = buffer => buffer.length,
    timeoutMillis = 0
  }: ISendWorkArguments & Partial<ISendWorkOptions>): ISendWork => {
    const newWork: ISendWork = {
      message,
      isFulfilled,
      timeoutMillis,
      dPromise: decomposePromise<string>(),
      timer: null
    };
    if (timeoutMillis > 0) {
      newWork.timer = setTimeout(
        () =>
          newWork.dPromise.reject(new Error(`Timeout ${timeoutMillis}millis`)),
        timeoutMillis
      );
    }
    return newWork;
  };

  private connect = () => {
    this.logger.info(`[NaiveSocket]`, `Start to connect`);
    this.connectionState = ConnectionState.Connecting;
    this.socket = new Socket();
    this.socket.addListener("connect", this.onConnect);
    this.socket.addListener("error", this.onError);
    this.socket.addListener("data", this.onData);
    this.socket.addListener("close", this.onClose);
    this.socket.connect(this.port, this.host);
  };

  private doDisconnect = () => {
    if (this.socket !== null) {
      this.logger.info(`[NaiveSocket]`, `Disconnect`);
      try {
        this.socket.destroy();
      } catch (error) {
        this.logger.warn(
          `[NaiveSocket]`,
          `Error occurred while disconnecting`,
          error
        );
      }
    }
    this.connectionState = ConnectionState.Disconnected;
    this.socket = null;
  };

  private onConnect = () => {
    this.connectionState = ConnectionState.Connected;
    this.doNextSendWork();
  };

  private onClose = () => {
    if (this.alive) {
      this.logger.info(`[NaiveSocket]`, `Try to reconnect`);
      this.retryToConnect();
    }
  };

  private retryToConnect = () => {
    this.doDisconnect();
    if (this.sendWorks.length === 0) {
      return;
    }
    if (this.connectionRetryInterval <= 0) {
      return;
    }
    setTimeout(() => {
      if (this.connectionState === ConnectionState.Disconnected) {
        this.connect();
      }
    }, this.connectionRetryInterval);
  };

  private onError = (error: Error) => {
    switch (this.connectionState) {
      case ConnectionState.Connecting:
        this.logger.warn(
          `[NaiveSocket]`,
          `Cannot connect to the opposite`,
          error
        );
        this.retryToConnect();
        break;
      case ConnectionState.Connected:
        // This error would be catched at onSend handler.
        break;
      case ConnectionState.Disconnected:
        // No error for this state.
        this.logger.error(
          `[NaiveSocket]`,
          `Invalid error in disconnected state`,
          error
        );
        break;
    }
  };

  private onData = (data: Buffer) => {
    this.currentBuffer += data.toString("utf-8");
    const work = this.sendWorks[0];
    const length = work.isFulfilled(this.currentBuffer);
    if (length <= 0) {
      return;
    }
    work.dPromise.resolve(this.currentBuffer.substring(0, length));
    if (work.timer !== null) {
      clearTimeout(work.timer);
    }

    this.currentBuffer = this.currentBuffer.substring(length);
    this.sendWorks.shift();
    this.doNextSendWork();
  };

  private doNextSendWork = () => {
    if (
      this.socket === null ||
      this.connectionState !== ConnectionState.Connected
    ) {
      this.connect();
      return;
    }

    // If no more works, stop.
    if (this.sendWorks.length === 0) {
      return;
    }

    // Drop timeout occurred works.
    while (this.sendWorks[0].dPromise.isResolved) {
      this.sendWorks.shift();
    }

    // If no more works, stop.
    if (this.sendWorks.length === 0) {
      return;
    }

    const firstWork = this.sendWorks[0];
    this.socket.write(firstWork.message, (error?: Error) => {
      if (!error) {
        return;
      }
      this.sendWorks.shift();
      firstWork.dPromise.reject(error);
      if (firstWork.timer !== null) {
        clearTimeout(firstWork.timer);
      }

      this.retryToConnect();
    });
  };
}
