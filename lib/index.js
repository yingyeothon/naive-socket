"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const net_1 = require("net");
const promise_1 = require("./promise");
var ConnectionState;
(function (ConnectionState) {
    ConnectionState["Connecting"] = "Connecting";
    ConnectionState["Connected"] = "Connected";
    ConnectionState["Disconnected"] = "Disconnected";
})(ConnectionState || (ConnectionState = {}));
class NaiveSocket {
    constructor({ host, port, connectionRetryInterval = 0, logger = console }) {
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
            this.doDisconnect();
        };
        this.buildSendWork = ({ message, isFulfilled = buffer => buffer.length, timeoutMillis = 0 }) => {
            const newWork = {
                message,
                isFulfilled,
                timeoutMillis,
                dPromise: promise_1.decomposePromise(),
                timer: null
            };
            if (timeoutMillis > 0) {
                newWork.timer = setTimeout(() => newWork.dPromise.reject(new Error(`Timeout ${timeoutMillis}millis`)), timeoutMillis);
            }
            return newWork;
        };
        this.connect = () => {
            console.debug(`start to connect`);
            this.connectionState = ConnectionState.Connecting;
            this.socket = new net_1.Socket();
            this.socket.addListener("connect", this.onConnect);
            this.socket.addListener("error", this.onError);
            this.socket.addListener("data", this.onData);
            this.socket.addListener("close", this.onClose);
            this.socket.connect(this.port, this.host);
        };
        this.doDisconnect = () => {
            console.debug(`disconnect`);
            if (this.socket !== null) {
                try {
                    this.socket.destroy();
                }
                catch (error) {
                    this.logger.warn(`Error occurred while disconnecting`, error);
                }
            }
            this.connectionState = ConnectionState.Disconnected;
            this.socket = null;
        };
        this.onConnect = () => {
            this.connectionState = ConnectionState.Connected;
            this.doNextSendWork();
        };
        this.onClose = () => {
            if (this.alive) {
                this.retryToConnect();
            }
        };
        this.retryToConnect = () => {
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
        this.onError = (error) => {
            switch (this.connectionState) {
                case ConnectionState.Connecting:
                    this.logger.warn(`Cannot connect to the opposite`, error);
                    this.retryToConnect();
                    break;
                case ConnectionState.Connected:
                    break;
                case ConnectionState.Disconnected:
                    this.logger.error(`Invalid error in disconnected state`, error);
                    break;
            }
        };
        this.onData = (data) => {
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
        this.doNextSendWork = () => {
            if (this.socket === null ||
                this.connectionState !== ConnectionState.Connected) {
                this.connect();
                return;
            }
            if (this.sendWorks.length === 0) {
                return;
            }
            while (this.sendWorks[0].dPromise.isResolved) {
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
    }
}
exports.default = NaiveSocket;
//# sourceMappingURL=index.js.map