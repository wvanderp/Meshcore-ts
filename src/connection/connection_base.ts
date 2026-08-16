import Constants from '../constants';
import EventEmitter from '../events';

import type { ByteArrayLike } from './connection_types';

/**
 * Base class for all MeshCore companion connection implementations.
 *
 * Extends {@link EventEmitter} and defines the abstract interface that
 * transport subclasses must implement: {@link sendToRadioFrame},
 * {@link deviceQuery}, and {@link close}.  Handles the connected /
 * disconnected lifecycle events and exposes a {@link createPromise}
 * helper for wrapping callbacks in Promises.
 *
 * @example
 * // Subclass to implement a custom transport
 * class MyTransport extends ConnectionBase {
 *     async sendToRadioFrame(data) { /* write bytes to device *\/ }
 *     async close()               { /* release the port *\/ }
 *     async deviceQuery(ver)      { /* send DeviceQuery command *\/ }
 * }
 */
class ConnectionBase extends EventEmitter {

    async onConnected(): Promise<void> {

        try {
            await this.deviceQuery(Constants.SupportedCompanionProtocolVersion);
        } catch {
            // ignore
        }

        this.emit('connected');

    }

    onDisconnected(): void {
        this.emit('disconnected');
    }

    async close(): Promise<void> {
        throw new Error('This method must be implemented by the subclass.');
    }

    async sendToRadioFrame(data: ByteArrayLike): Promise<void> {
        void data;
        throw new Error('This method must be implemented by the subclass.');
    }

    createPromise<T>(
        work: (
            resolve: (value?: T | PromiseLike<T>) => void,
            reject: (reason?: unknown) => void,
        ) => Promise<void | T> | Promise<T> | void,
    ): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            const resolveOptional = (value?: T | PromiseLike<T>) => {
                resolve(value as T | PromiseLike<T>);
            };
            void Promise.resolve(work(resolveOptional, reject)).catch(reject);
        });
    }

    async deviceQuery(appTargetVer: number): Promise<unknown> {
        void appTargetVer;
        throw new Error('This method must be implemented by the subclass.');
    }

}

export default ConnectionBase;
