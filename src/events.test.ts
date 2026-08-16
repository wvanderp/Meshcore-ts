import { describe, it, expect, vi } from 'vitest';
import EventEmitter from './events';

describe('EventEmitter', () => {
    it('on registers and emit fires callbacks', async () => {
        const emitter = new EventEmitter();
        const callback = vi.fn();

        emitter.on('test', callback);
        emitter.emit('test', 'data1', 'data2');

        // callbacks are fired via setTimeout
        await vi.waitFor(() => {
            expect(callback).toHaveBeenCalledWith('data1', 'data2');
        });
    });

    it('off removes a callback', async () => {
        const emitter = new EventEmitter();
        const callback = vi.fn();

        emitter.on('test', callback);
        emitter.off('test', callback);
        emitter.emit('test');

        await new Promise((r) => setTimeout(r, 10));
        expect(callback).not.toHaveBeenCalled();
    });

    it('off is a no-op for unregistered events', () => {
        const emitter = new EventEmitter();
        const callback = vi.fn();
        // Should not throw
        emitter.off('nonexistent', callback);
    });

    it('once fires callback only once', async () => {
        const emitter = new EventEmitter();
        const callback = vi.fn();

        emitter.once('test', callback);
        emitter.emit('test', 'first');
        emitter.emit('test', 'second');

        await vi.waitFor(() => {
            expect(callback).toHaveBeenCalledTimes(1);
        });
        expect(callback).toHaveBeenCalledWith('first');
    });

    it('emit does nothing for unregistered events', () => {
        const emitter = new EventEmitter();
        // Should not throw
        emitter.emit('nonexistent', 'data');
    });

    it('supports multiple listeners on same event', async () => {
        const emitter = new EventEmitter();
        const cb1 = vi.fn();
        const cb2 = vi.fn();

        emitter.on('test', cb1);
        emitter.on('test', cb2);
        emitter.emit('test', 'val');

        await vi.waitFor(() => {
            expect(cb1).toHaveBeenCalledWith('val');
            expect(cb2).toHaveBeenCalledWith('val');
        });
    });
});
