type EventName = number | string;
type EventListener<TArgs extends unknown[] = unknown[]> = (...data: TArgs) => void;

/**
 * A minimal, type-safe event emitter.
 *
 * Supports registering multiple listeners per event name (string or
 * number) via {@link on}, removing them via {@link off}, and
 * one-shot subscriptions via {@link once}.  Listeners are invoked
 * synchronously in registration order by {@link emit}.
 *
 * @example
 * const emitter = new EventEmitter();
 * emitter.on("data", (payload: { value: number }) => console.log(payload.value));
 * emitter.emit("data", { value: 42 }); // logs 42
 * emitter.once("close", () => console.log("closed"));
 */
class EventEmitter {

    eventListenersMap: Map<EventName, EventListener[]>;

    constructor() {
        this.eventListenersMap = new Map();
    }

    on<TArgs extends unknown[]>(event: EventName, callback: EventListener<TArgs>) {

        // create list of listeners for event if it doesn't exist
        if(!this.eventListenersMap.has(event)){
            this.eventListenersMap.set(event, []);
        }

        // add listener for event
        this.eventListenersMap.get(event)!.push(callback as EventListener);

    }

    off<TArgs extends unknown[]>(event: EventName, callback: EventListener<TArgs>) {

        // remove callback from listeners for this event
        if(this.eventListenersMap.has(event)){
            const callbacks = this.eventListenersMap.get(event)!.filter((cb) => cb !== (callback as EventListener));
            this.eventListenersMap.set(event, callbacks);
        }

    }

    once<TArgs extends unknown[]>(event: EventName, callback: EventListener<TArgs>) {

        // internal callback to handle the event
        let called = false;
        const internalCallback: EventListener = (...data) => {

            if (called) return;
            called = true;

            // we received an event, so lets remove the event listener
            this.off(event, internalCallback);

            // fire the original callback provided by the user
            setTimeout(() => callback(...(data as TArgs)), 0);

        };

        // listen to this event
        this.on(event, internalCallback);

    }

    emit(event: EventName, ...data: unknown[]) {

        const eventListeners = this.eventListenersMap.get(event);

        // invoke each listener for this event
        if(eventListeners){
            for(const eventListener of eventListeners){
                setTimeout(() => eventListener(...data), 0);
            }
        }

    }

}

export default EventEmitter;
