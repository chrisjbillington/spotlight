import Gio from 'gi://Gio';
import {EventEmitter} from 'resource:///org/gnome/shell/misc/signals.js';

const SERVICE_NAME = 'org.gnome.shell.extensions.spotlight';
const OBJECT_PATH = '/org/gnome/shell/extensions/spotlight';
const INTERFACE_NAME = 'org.gnome.shell.extensions.spotlight';

const INTERFACE_SCHEMA = `
<node>
    <interface name="${INTERFACE_NAME}">
        <method name="switch_mode"/>
    </interface>
</node>
`;

export class DbusService {
    // Class to receive events over dbus from the Python evdev process and emit events
    // Application should connect to the following signals emitted by DbusServer.events
    // (currently only one):
    //
    // - switch-mode: the user has double-clicked to switch mode, cycling between
    //   ordinary cursor, laser pointer, and spotlight modes.
    //
    constructor() {
        this.events = new EventEmitter();

        this._interface = Gio.DBusExportedObject.wrapJSObject(INTERFACE_SCHEMA, {
            switch_mode: this._switch_mode_received.bind(this)
        });
        this._interface.export(Gio.DBus.session, OBJECT_PATH);
        // Own the bus name
        Gio.DBus.session.own_name(
            SERVICE_NAME,
            Gio.BusNameOwnerFlags.NONE,
            null, null
        );
    }

    _switch_mode_received() {
        this.events.emit('switch-mode');
    }

    destroy() {
        if (this._interface) {
            this._interface.unexport();
            this._interface = null;
        }
    }
}
