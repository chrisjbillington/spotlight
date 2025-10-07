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
        this._cursor_hidden = false;
    }

    show() {
        if (this._unfocus_inhibited) {
            this._seat.uninhibit_unfocus();
            this._unfocus_inhibited = false;
        }
        if (this._cursor_hidden) {
            if (this._cursor_tracker.uninhibit_cursor_visibility) {
                // GNOME 49+
                this._cursor_tracker.uninhibit_cursor_visibility();
            } else {
                // GNOME < 49
                this._cursor_tracker.set_pointer_visible(true);
                this._cursor_tracker.disconnectObject(this);
            }
            this._cursor_hidden = false;
        }
    }

    hide() {
        if (!this._unfocus_inhibited) {
            this._seat.inhibit_unfocus();
            this._unfocus_inhibited = true;
        }

        if (!this._cursor_hidden) {
            if (this._cursor_tracker.inhibit_cursor_visibility) {
                // GNOME 49+
                this._cursor_tracker.inhibit_cursor_visibility();
            } else {
                // GNOME < 49
                this._cursor_tracker.set_pointer_visible(false);
                // Attach callback to re-hide it if it changes:
                this._cursor_tracker.connectObject(
                    'visibility-changed', () => {
                        if (this._cursor_tracker.get_pointer_visible()) {
                            this._cursor_tracker.set_pointer_visible(false);
                        }
                    },
                    this,
                );
            }
            this._cursor_hidden = true;
            
        }
    }

    set_visible(visible) {
        if (visible) {
            this.show();
        } else {
            this.hide();
        }
    }

    destroy() {
        this.show();
    }
}
