import { DecomposedPromise, decomposePromise } from "./promise";

import { Socket } from "net";

interface Logger {
  info: typeof console.info;
  warn: typeof console.warn;
  error: typeof console.error;
}

type ConnectionStateListener = (params: {
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

export enum ConnectionState {
  Connecting = "Connecting",
  Connected = "Connected",
  Disconnected = "Disconnected",
}

interface SendWorkOptions {
  /**
   * A function to check if a buffer is fulfilled for my request.
   * If the return value is a positive it would accept a buffer with that length,
   * otherwise wait more response would be come.
   */
  fulfill: ((buffer: string) => number) | RegExp | number;

  /**
   * A milliseconds to timeout this send work.
   */
  timeoutMillis: number;

  /**
   * A flag to add this send work into the front of queue.
   */
  urgent?: boolean;
}

interface SendWorkArguments {
  /**
   * A thing to do send.
   */
  message: string;
}

interface SendWorkInternal {
  dPromise: DecomposedPromise<string>;
  timer: NodeJS.Timer | null;
}

interface ISendWork
  extends SendWorkInternal,
    SendWorkArguments,
    SendWorkOptions {}

export default class NaiveSocket {
  private readonly host: string;
  private readonly port: number;
  private readonly logger: Logger;
  private readonly onConnectionStateChanged: ConnectionStateListener;

  private readonly sendWorks: ISendWork[] = [];
  private currentBuffer = "";
  private connectionState: ConnectionState = ConnectionState.Disconnected;
  private socket: Socket | null = null;
  private alive = true;

  private connectionRetryInterval: number;

  constructor({
    host,
    port,
    connectionRetryInterval = 5000,
    logger = {
      info: !!process.env.DEBUG ? console.info : () => 0,
      warn: console.warn,
      error: console.error,
    },
    onConnectionStateChanged = () => 0,
  }: NaiveSocketOptions) {
    this.host = host;
    this.port = port;
    this.connectionRetryInterval = connectionRetryInterval;
    this.logger = logger;
    this.onConnectionStateChanged = onConnectionStateChanged;
  }

  public send = (
    request: SendWorkArguments & Partial<SendWorkOptions>
  ): Promise<string> => {
    this.alive = true;
    const newWork = this.buildSendWork(request);
    if (request.urgent) {
      this.sendWorks.unshift(newWork);
    } else {
      this.sendWorks.push(newWork);
    }
    if (this.sendWorks.length === 1) {
      this.doNextSendWork();
    }
    return newWork.dPromise.promise;
  };

  public disconnect = (): void => {
    this.alive = false;
    this.logger.info(`[NaiveSocket]`, `Socket is dead`);
    this.doDisconnect();

    // Reject all send works.
    while (this.sendWorks.length > 0) {
      const work = this.sendWorks.shift()!;
      if (work.timer !== null) {
        clearTimeout(work.timer);
      }
      work.dPromise.reject(new Error(`DeadSocket`));
    }
  };

  private buildSendWork = ({
    message,
    fulfill = (buffer) => buffer.length,
    timeoutMillis = 0,
  }: SendWorkArguments & Partial<SendWorkOptions>): ISendWork => {
    const newWork: ISendWork = {
      message,
      fulfill,
      timeoutMillis,
      dPromise: decomposePromise<string>(),
      timer: null,
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

  private changeConnectionState = (newConnectionState: ConnectionState) => {
    this.connectionState = newConnectionState;
    this.onConnectionStateChanged({ socket: this, state: newConnectionState });
  };

  private connect = () => {
    this.logger.info(`[NaiveSocket]`, `Start to connect`);
    this.changeConnectionState(ConnectionState.Connecting);
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
    this.changeConnectionState(ConnectionState.Disconnected);
    this.socket = null;
  };

  private onConnect = () => {
    this.changeConnectionState(ConnectionState.Connected);
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
    if (this.connectionRetryInterval < 0) {
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
        // Try to reconnect at `onClose` handler if alive.
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
    if (!work) {
      this.logger.error(
        `[NaiveSocket]`,
        `No work but more response`,
        this.currentBuffer
      );
      this.currentBuffer = "";
      return;
    }

    const { fulfill } = work;
    const length =
      fulfill instanceof RegExp
        ? fulfillByRegex(fulfill, this.currentBuffer)
        : typeof fulfill === "number"
        ? fulfillByLength(fulfill, this.currentBuffer)
        : fulfill(this.currentBuffer);
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

    // Drop timeout occurred works.
    while (this.sendWorks[0]?.dPromise?.isResolved === true) {
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

const fulfillByRegex = (regex: RegExp, buffer: string) => {
  const match = buffer.match(regex);
  return match ? match[1].length : -1;
};

const fulfillByLength = (length: number, buffer: string) =>
  buffer.length >= length ? length : -1;
