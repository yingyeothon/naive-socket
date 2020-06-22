"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const promise_1 = require("./promise");
const net_1 = require("net");
var ConnectionState;
(function (ConnectionState) {
    ConnectionState["Connecting"] = "Connecting";
    ConnectionState["Connected"] = "Connected";
    ConnectionState["Disconnected"] = "Disconnected";
})(ConnectionState || (ConnectionState = {}));
class NaiveSocket {
    constructor({ host, port, connectionRetryInterval = 5000, logger = {
        info: !!process.env.DEBUG ? console.info : () => 0,
        warn: console.warn,
        error: console.error,
    }, onConnectionStateChanged = () => 0, }) {
        this.sendWorks = [];
        this.currentBuffer = "";
        this.connectionState = ConnectionState.Disconnected;
        this.socket = null;
        this.alive = true;
        this.send = (request) => {
            this.alive = true;
            const newWork = this.buildSendWork(request);
            this.sendWorks.push(newWork);
            if (this.sendWorks.length === 1) {
                this.doNextSendWork();
            }
            return newWork.dPromise.promise;
        };
        this.disconnect = () => {
            this.alive = false;
            this.logger.info(`[NaiveSocket]`, `Socket is dead`);
            this.doDisconnect();
            while (this.sendWorks.length > 0) {
                const work = this.sendWorks.shift();
                if (work.timer !== null) {
                    clearTimeout(work.timer);
                }
                work.dPromise.reject(new Error(`DeadSocket`));
            }
        };
        this.buildSendWork = ({ message, fulfill = (buffer) => buffer.length, timeoutMillis = 0, }) => {
            const newWork = {
                message,
                fulfill,
                timeoutMillis,
                dPromise: promise_1.decomposePromise(),
                timer: null,
            };
            if (timeoutMillis > 0) {
                newWork.timer = setTimeout(() => newWork.dPromise.reject(new Error(`Timeout ${timeoutMillis}millis`)), timeoutMillis);
            }
            return newWork;
        };
        this.changeConnectionState = (newConnectionState) => {
            this.connectionState = newConnectionState;
            this.onConnectionStateChanged({ socket: this, state: newConnectionState });
        };
        this.connect = () => {
            this.logger.info(`[NaiveSocket]`, `Start to connect`);
            this.changeConnectionState(ConnectionState.Connecting);
            this.socket = new net_1.Socket();
            this.socket.addListener("connect", this.onConnect);
            this.socket.addListener("error", this.onError);
            this.socket.addListener("data", this.onData);
            this.socket.addListener("close", this.onClose);
            this.socket.connect(this.port, this.host);
        };
        this.doDisconnect = () => {
            if (this.socket !== null) {
                this.logger.info(`[NaiveSocket]`, `Disconnect`);
                try {
                    this.socket.destroy();
                }
                catch (error) {
                    this.logger.warn(`[NaiveSocket]`, `Error occurred while disconnecting`, error);
                }
            }
            this.changeConnectionState(ConnectionState.Disconnected);
            this.socket = null;
        };
        this.onConnect = () => {
            this.changeConnectionState(ConnectionState.Connected);
            this.doNextSendWork();
        };
        this.onClose = () => {
            if (this.alive) {
                this.logger.info(`[NaiveSocket]`, `Try to reconnect`);
                this.retryToConnect();
            }
        };
        this.retryToConnect = () => {
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
        this.onError = (error) => {
            switch (this.connectionState) {
                case ConnectionState.Connecting:
                    this.logger.warn(`[NaiveSocket]`, `Cannot connect to the opposite`, error);
                    break;
                case ConnectionState.Connected:
                    break;
                case ConnectionState.Disconnected:
                    this.logger.error(`[NaiveSocket]`, `Invalid error in disconnected state`, error);
                    break;
            }
        };
        this.onData = (data) => {
            this.currentBuffer += data.toString("utf-8");
            const work = this.sendWorks[0];
            if (!work) {
                this.logger.error(`[NaiveSocket]`, `No work but more response`, this.currentBuffer);
                this.currentBuffer = "";
                return;
            }
            const { fulfill } = work;
            const length = fulfill instanceof RegExp
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
        this.doNextSendWork = () => {
            var _a, _b;
            if (this.socket === null ||
                this.connectionState !== ConnectionState.Connected) {
                this.connect();
                return;
            }
            while (((_b = (_a = this.sendWorks[0]) === null || _a === void 0 ? void 0 : _a.dPromise) === null || _b === void 0 ? void 0 : _b.isResolved) === true) {
                this.sendWorks.shift();
            }
            if (this.sendWorks.length === 0) {
                return;
            }
            const firstWork = this.sendWorks[0];
            this.socket.write(firstWork.message, (error) => {
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
        this.host = host;
        this.port = port;
        this.connectionRetryInterval = connectionRetryInterval;
        this.logger = logger;
        this.onConnectionStateChanged = onConnectionStateChanged;
    }
}
exports.default = NaiveSocket;
const fulfillByRegex = (regex, buffer) => {
    const match = buffer.match(regex);
    return match ? match[1].length : -1;
};
const fulfillByLength = (length, buffer) => buffer.length >= length ? length : -1;
//# sourceMappingURL=index.js.map