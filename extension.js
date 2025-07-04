import * as Main from 'resource:///org/gnome/shell/ui/main.js'
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js'
import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import * as QuickSettings from 'resource:///org/gnome/shell/ui/quickSettings.js';
import Gio from 'gi://Gio';


const ICON_NAME = 'applications-graphics-symbolic';
const MOUSE_POLL_INTERVAL_MS = 16;


// class for showing and hiding system cursor
class SystemCursor {
    constructor() {
        this._cursor_tracker = global.backend.get_cursor_tracker();
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
            this._hide()
            this._cursor_hidden = true;
            // Attach callback to re-hide it if it changes. From GNOME 49 we could use
            // this._cursorTracker.{un,}inhibit_cursor_visibility() instead
            this._cursor_tracker.connectObject(
                'visibility-changed', this._hide.bind(this), this,
            )
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
            this._cursor_tracker.set_pointer_visible(true)
        }
    }

    _hide() {
        if (this._cursor_tracker.get_pointer_visible()) {
            this._cursor_tracker.set_pointer_visible(false)
        }
    }

    destroy() {
        this.show();
        this._seat.destroy();
        this._cursor_tracker.destroy();
    }
}


class LaserCursor {
    constructor() {
        this._widget = new St.Widget({
            style_class: 'spotlight-laser',
            visible: false,
        });
        global.stage.add_child(this._widget);
        this._callbackId = null;
        this._laters = global.compositor.get_laters();
    }

    _schedule_update() {
        if (this._callbackId) {
            return;
        }
        this._callbackId = this._laters.add(Meta.LaterType.BEFORE_REDRAW, () => {
            this._moveToCursor();
            this._callbackId = null;
            this._schedule_update(); // next frame
        });
    }

    show() {
        this._moveToCursor();
        this._widget.show();
        this._schedule_update();
    }

    _moveToCursor() {
        // move laser to cursor position:
        let [x, y] = global.get_pointer();
        let [width, height] = this._widget.get_size();
        this._widget.set_position(x - width / 2, y - height / 2);
    }

    hide() {
        this._widget.hide();
        if (this._callbackId) {
            this._laters.remove(this._callbackId);
            this._callbackId = null;
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
        this.hide();
        global.stage.remove_child(this._widget);
        this._widget.destroy();
    }
}


const SpotlightIndicator = GObject.registerClass(
class SpotlightIndicator extends QuickSettings.SystemIndicator {
    _init(extension) {
        super._init();
        this._indicator = this._addIndicator();
        this._indicator.iconName = ICON_NAME;
        this._indicator.visible = false;
    }
    
    set_visible(visible) {
        this._indicator.visible = visible;
    }
});


export default class SpotlightExtension extends Extension {
    constructor(metadata) {
        console.log("constructor()")
        super(metadata);
    }

    enable() {
        console.log("enable()");
        this._toggle = new QuickSettings.QuickToggle({
            title: 'Spotlight',
            iconName: ICON_NAME,
            toggleMode: true
        });
        this._indicator = new SpotlightIndicator();
        this._indicator.quickSettingsItems.push(this._toggle);
        this._toggle.connectObject('clicked', this._onToggled.bind(this), this);

        // Add indicator to Quick Settings menu
        Main.panel.statusArea.quickSettings.addExternalIndicator(this._indicator);
        
        this._system_cursor = new SystemCursor();
        this._laser_cursor = new LaserCursor();
    }

    _onToggled(toggle) {
        console.log("_onToggled()");
        const enabled = toggle.checked;
        this._indicator.set_visible(enabled);
        this._laser_cursor.set_visible(enabled)
        this._system_cursor.set_visible(!enabled)
    }
    
    disable() {
        console.log("disable()");
        this._laser_cursor.destroy();
        this._system_cursor.destroy();
        this._toggle.destroy();
        this._indicator.destroy();
    }
}
