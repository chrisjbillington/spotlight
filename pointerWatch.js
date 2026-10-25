import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import * as Config from 'resource:///org/gnome/shell/misc/config.js';

// Function to call a callback with the pointer position whenever the pointer moves

const SHELL_MAJOR_VERSION = parseInt(Config.PACKAGE_VERSION.split('.')[0]);
const POINTER_POLL_RATE_MS = 1000 / 60;

let PointerWatcher = null;
if (SHELL_MAJOR_VERSION < 51) {
    // GNOME 50 and earlier
    PointerWatcher = await import('resource:///org/gnome/shell/ui/pointerWatcher.js');
}


class _CursorTrackerWatch {
    // GNOME 51+
    constructor(callback) {
        this._callback = callback;
        this._cursor_tracker = global.backend.get_cursor_tracker();
        this._later_id = 0;
        this._position_id = this._cursor_tracker.connect('position-invalidated', this._queue_update.bind(this));
    }

    _queue_update() {
        if (this._later_id) {
            return;
        }
        this._later_id = global.compositor.get_laters().add(Meta.LaterType.BEFORE_REDRAW, () => {
            this._later_id = 0;
            const [x, y] = global.get_pointer();
            this._callback(x, y);
            return GLib.SOURCE_REMOVE;
        });
    }

    remove() {
        if (this._position_id) {
            this._cursor_tracker.disconnect(this._position_id);
            this._position_id = 0;
        }
        if (this._later_id) {
            global.compositor.get_laters().remove(this._later_id);
            this._later_id = 0;
        }
    }
}


// Returns an object with a remove() method that stops the watch
export function addPointerWatch(callback) {
    if (PointerWatcher) {
        return PointerWatcher.getPointerWatcher().addWatch(POINTER_POLL_RATE_MS, callback);
    }
    return new _CursorTrackerWatch(callback);
}
