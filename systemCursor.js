import Clutter from 'gi://Clutter';
import Meta from 'gi://Meta';

// Class to hide and show the system cursor

export class SystemCursor {
    constructor() {
        if (global.backend && global.backend.get_cursor_tracker) {
            // GNOME 47+
            this._cursor_tracker = global.backend.get_cursor_tracker();
        } else {
            // GNOME 46
            this._cursor_tracker = Meta.CursorTracker.get_for_display(global.display);
        }

        this._seat = Clutter.get_default_backend().get_default_seat();
        this._unfocus_inhibited = false;
    }

    show() {
        this._cursor_tracker.disconnectObject(this);
        if (this._unfocus_inhibited) {
            this._seat.uninhibit_unfocus();
            this._unfocus_inhibited = false;
        }
        this._show();
        this._cursor_hidden = false;
    }

    hide() {
        if (!this._unfocus_inhibited) {
            this._seat.inhibit_unfocus();
            this._unfocus_inhibited = true;
        }

        if (!this._cursor_hidden) {
            this._hide();
            this._cursor_hidden = true;
            // Attach callback to re-hide it if it changes. From GNOME 49 we could use
            // this._cursorTracker.{un,}inhibit_cursor_visibility() instead
            this._cursor_tracker.connectObject(
                'visibility-changed', this._hide.bind(this), this,
            );
        }
    }

    set_visible(visible) {
        if (visible) {
            this.show();
        } else {
            this.hide();
        }
    }

    _show() {
        if (!this._cursor_tracker.get_pointer_visible()) {
            this._cursor_tracker.set_pointer_visible(true);
        }
    }

    _hide() {
        if (this._cursor_tracker.get_pointer_visible()) {
            this._cursor_tracker.set_pointer_visible(false);
        }
    }

    destroy() {
        this.show();
    }
}
