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

    setVisible(visible) {
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


const SpotlightIndicator = GObject.registerClass(
class SpotlightIndicator extends QuickSettings.SystemIndicator {
    _init(extension) {
        super._init();
        this._indicator = this._addIndicator();
        this._indicator.iconName = ICON_NAME;
        this._indicator.visible = false;
    }
    
    setVisible(visible) {
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
        
        // Create red dot widget
        this._laser = new St.Widget({
            style_class: 'spotlight-laser',
            visible: false,
        });
       
        // Add laser to the stage
        Main.uiGroup.add_child(this._laser);
        
        this._system_cursor = new SystemCursor();

        this._timeoutId = null;
        this._cursor_tracker = global.backend.get_cursor_tracker();

    }

    _onToggled(toggle) {
        console.log("_onToggled()");
        const enabled = toggle.checked;
        this._indicator.setVisible(enabled);
        this._laser.visible = enabled;
        this._system_cursor.setVisible(!enabled)

        // Stop any previous timeout:
        if (this._timeoutId) {
            GLib.source_remove(this._timeoutId);
            this._timeoutId = null;
        }

        if (enabled) {
            // Start mouse poll timeout:
            this._timeoutId = GLib.timeout_add(
                GLib.PRIORITY_HIGH,
                MOUSE_POLL_INTERVAL_MS,
                this._onTimeout.bind(this),
            )
        }
    }
    
    _onTimeout() {
        // move laser to cursor position:
        let [x, y] = global.get_pointer();
        let [laser_width, laser_height] = this._laser.get_size();
        this._laser.set_position(x - laser_width / 2, y - laser_width / 2);
        return GLib.SOURCE_CONTINUE;
    }

    disable() {
        console.log("disable()");
        this._system_cursor.destroy();
        this._toggle.destroy();
        this._indicator.destroy();
        this._laser.destroy();
    }
}
