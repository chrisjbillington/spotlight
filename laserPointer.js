import St from 'gi://St';
import GLib from 'gi://GLib';
import * as PointerWatcher from 'resource:///org/gnome/shell/ui/pointerWatcher.js';


const POINTER_POLL_RATE_MS = 1000 / 60;
const IDLE_TIMEOUT_MS = 1000;

export class LaserPointer {
    constructor() {
        this._widget = new St.Widget({
            style_class: 'spotlight-laser',
            visible: false,
        });
        global.stage.add_child(this._widget);
        this._widget.connect('destroy', () => {this._widget = null});
        this._pointer_watcher = PointerWatcher.getPointerWatcher();
        this._pointer_watch = null;
        this._idle_watch = null;
    }

    enable() {
        if (!this._widget) {
            return;
        }
        this._pointer_watch = this._pointer_watcher.addWatch(POINTER_POLL_RATE_MS, this._update_position.bind(this));
        const [x, y] = global.get_pointer();
        this._update_position(x, y);
        this._widget.show();
    }

    _on_idle() {
        if (this._widget.visible) {
            this._widget.visible = false;
        }
        this._idle_watch = null;
        return GLib.SOURCE_REMOVE;
    }

    _reset_idle_timeout() {
        if (this._idle_watch) {
            GLib.source_remove(this._idle_watch);
            this._idle_watch = null;
        }
        this._idle_watch = GLib.timeout_add(GLib.PRIORITY_DEFAULT, IDLE_TIMEOUT_MS, this._on_idle.bind(this));
    }

    _update_position(x, y) {
        if (!this._widget) {
            return;
        }
        this._reset_idle_timeout();
        // move laser to cursor position:
        let [width, height] = this._widget.get_size();
        this._widget.set_position(x - width / 2, y - height / 2);
        if (!this._widget.visible) {
            this._widget.visible = true;
        }
    }

    disable() {
        if (this._widget) {
            this._widget.hide();
        }
        if (this._pointer_watch) {
            this._pointer_watch.remove();
            this._pointer_watch = null;
        }
        if (this._idle_watch) {
            GLib.source_remove(this._idle_watch);
            this._idle_watch = null;
        }
    }

    set_enabled(enabled) {
        if (enabled) {
            this.enable();
        } else {
            this.disable();
        }
    }

    destroy() {
        this.disable();
        if (this._widget) {
            global.stage.remove_child(this._widget);
            this._widget.destroy();
        }
    }
}
