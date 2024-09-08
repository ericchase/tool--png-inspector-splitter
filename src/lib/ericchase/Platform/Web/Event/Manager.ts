// ! WIP

// type ListenerCallback = (event: Event & { options: EventOption }, remove: () => void) => void;

// // interface EventOptions {
// //   direction?: 'bubble' | 'capture';
// //   once?: boolean;
// //   passive?: boolean;
// // }

// type EventOption = 'bubble' | 'capture' | 'once' | 'passive';

// interface EventSource {
//   addEventListener: (type: any, listener: (event: any) => any, useCapture: any) => void;
//   removeEventListener: (type: any, listener: (event: any) => any, useCapture: any) => void;
// }

// type N<T> = T | T[];

// class EventGroup {
//   add(types: N<string>, callbacks: N<ListenerCallback>, options?: N<EventOption>) {}
//   clear() {}
//   refresh() {}
//   remove() {}
// }

// class GlobalEventManager {
//   /** The EventManager is intended to be a global object (typically 'window' for browsers) used between multiple scripts. There may or may not be different major versions of this class. The static GetGlobalManager function will retrieve the global object satisfying this class' major version. If an appropriate object does not exist, a new one will be created. */
//   static GetGlobalInstance() {
//     const _ = (window as any).ECEventManager1 as GlobalEventManager;
//     if (_ !== null && _ !== undefined && typeof _ === 'object' && typeof _.add == 'function' && typeof _.refresh == 'function' && _.version === GlobalEventManager.Version) {
//       return _;
//     }
//     return ((window as any).ECEventManager1 = new GlobalEventManager());
//   }
//   static Version = 'github.com/ericchase|EventManager(v0)';

//   eventListenerMap = new Map<ListenerCallback, {}>();
//   version = GlobalEventManager.Version;

//   new(sources: EventSource | EventSource[]): EventGroup {}

//   /**
//    * Create one or more event listeners for each event type in `types`, for each event source in `sources`, for each listener callback in `callbacks`, and for each event options in `options`. (Passing multiple values to any parameter will result in the creation of multiple event listeners.)
//    *
//    * @parameter options: if `{}`, `[]`, or undefined, the default event options `{ direction: 'bubble', once: false, passive: false }` will be used for each event listener created.
//    * @returns a function for removing the event listeners created with this specific call to the `add` method. Event listeners associated with the combination of properties passed to `removeParams` will be removed. Passing `[]` to a property of `removeParams` will remove all the listeners associated with that specific property in combination with the other properties. Ultimately, passing `[]` to all properties (or leaving `removeParams` undefined) will remove every listener associated with this call.
//    */
//   add(
//     types: string | string[], //
//     sources: EventSource | EventSource[],
//     callbacks: ListenerCallback | ListenerCallback[],
//     options: EventOption | EventOption[] = { direction: 'bubble', once: false, passive: false },
//   ) {
//     // TODO
//     return {
//       remove: (
//         types: string | string[] = [], //
//         sources: EventSource | EventSource[] = [],
//         options: EventOption | EventOption[] = [],
//       ) => {
//         // TODO
//       },
//     };
//   }
//   /**
//    * Remove and re-add the listeners associated with the parameters provided. The listener callbacks will not be destroyed; they will be continue to exist with their associated listeners. This is an advanced operation for specific situations. Normally, there is no need to call `refresh`.
//    */
//   refresh(
//     types: string | string[], //
//     sources: EventSource | EventSource[],
//     options: EventOption | EventOption[] = [],
//   ) {
//     // TODO
//   }
// }

// export const EventManager = GlobalEventManager.GetGlobalInstance();
