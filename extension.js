import * as Main from 'resource:///org/gnome/shell/ui/main.js'
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js'
import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import * as QuickSettings from 'resource:///org/gnome/shell/ui/quickSettings.js';
import Gio from 'gi://Gio';
import Shell from 'gi://Shell';


const ICON_NAME = 'find-location-symbolic';
const SPOTLIGHT_DIAMETER_FRACTION = 0.32;
const SPOTLIGHT_BORDER_WIDTH = 8;


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


class SpotlightOverlay {
    constructor() {
        this._container = new St.Widget({
            visible: false,
        });
        this._container.set_size(global.screen_width, global.screen_height);
        this._container.set_position(0, 0);
        
        // Create a massive ring that covers the entire screen
        let spotlightRadius = (global.screen_height * SPOTLIGHT_DIAMETER_FRACTION) / 2;
        let maxDimension = Math.max(global.screen_width, global.screen_height);
        let ringSize = maxDimension * 10; // Make it huge to cover any screen
        let ringRadius = ringSize / 2;
        let borderThickness = ringRadius - spotlightRadius;
        
        this._ring = new St.Widget({
            style_class: 'spotlight-ring',
        });
        this._ring.set_size(ringSize, ringSize);
        this._ring.set_style(`
            border-radius: ${ringRadius}px;
            border: ${borderThickness}px solid rgba(0, 0, 0, 0.35);
            background-color: rgba(0, 0, 0, 0);
        `);
        
        // Create the green border
        let borderSize = (spotlightRadius + SPOTLIGHT_BORDER_WIDTH) * 2;
        this._border = new St.Widget({
            style_class: 'spotlight-border',
        });
        this._border.set_size(borderSize, borderSize);
        this._border.set_style(`
            border-radius: ${spotlightRadius + SPOTLIGHT_BORDER_WIDTH}px;
            border: ${SPOTLIGHT_BORDER_WIDTH}px solid rgba(0, 255, 0, 0.5);
            background-color: rgba(0, 0, 0, 0);
        `);
        
        this._spotlightRadius = spotlightRadius;
        
        this._container.add_child(this._ring);
        this._container.add_child(this._border);
        
        global.stage.add_child(this._container);
        this._callbackId = null;
        this._laters = global.compositor.get_laters();
        this._ringRadius = ringRadius;
    }

    _schedule_update() {
        if (this._callbackId) {
            return;
        }
        this._callbackId = this._laters.add(Meta.LaterType.BEFORE_REDRAW, () => {
            this._updatePosition();
            this._callbackId = null;
            this._schedule_update(); // next frame
        });
    }

    show() {
        this._updatePosition();
        this._container.show();
        this._schedule_update();
    }

    _updatePosition() {
        // Update spotlight position to follow cursor
        let [x, y] = global.get_pointer();
        
        // Center the ring on the cursor
        this._ring.set_position(x - this._ringRadius, y - this._ringRadius);
        
        // Position the green border
        let borderOffset = this._spotlightRadius + SPOTLIGHT_BORDER_WIDTH;
        this._border.set_position(x - borderOffset, y - borderOffset);
    }

    hide() {
        this._container.hide();
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
        global.stage.remove_child(this._container);
        this._container.destroy();
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
        this._spotlight_overlay = new SpotlightOverlay();
        this._spotlight_mode = false;

        // Add keybinding for spotlight mode
        this._settings = this.getSettings('org.gnome.shell.extensions.spotlight');
        Main.wm.addKeybinding('toggle-spotlight-mode',
            this._settings, 
            Meta.KeyBindingFlags.NONE,
            Shell.ActionMode.NORMAL,
            this._toggleSpotlightMode.bind(this)
        );
    }

    _onToggled(toggle) {
        console.log("_onToggled()");
        const enabled = toggle.checked;
        this._indicator.set_visible(enabled);
        this._laser_cursor.set_visible(enabled && !this._spotlight_mode)
        this._updateSystemCursor();
    }

    _updateSystemCursor() {
        // Hide system cursor if either laser or spotlight is enabled
        const shouldHideCursor = this._toggle.checked || this._spotlight_mode;
        this._system_cursor.set_visible(!shouldHideCursor);
    }

    _toggleSpotlightMode() {
        console.log("_toggleSpotlightMode()");
        this._spotlight_mode = !this._spotlight_mode;
        this._spotlight_overlay.set_visible(this._spotlight_mode);
        this._laser_cursor.set_visible(this._toggle.checked && !this._spotlight_mode);
        this._updateSystemCursor();
    }
    
    disable() {
        console.log("disable()");
        Main.wm.removeKeybinding('toggle-spotlight-mode');
        this._spotlight_overlay.destroy();
        this._laser_cursor.destroy();
        this._system_cursor.destroy();
        this._toggle.destroy();
        this._indicator.destroy();
    }
}
