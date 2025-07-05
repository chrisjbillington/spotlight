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
        this._spotlightRadius = (global.screen_height * SPOTLIGHT_DIAMETER_FRACTION) / 2;
        this._overlayRadius = Math.sqrt(global.screen_width**2 + global.screen_height**2);
        let borderThickness = this._overlayRadius - this._spotlightRadius;
        
        this._overlay = new St.Widget({
            style_class: 'spotlight-overlay',
        });
        this._overlay.set_size(2 * this._overlayRadius, 2 * this._overlayRadius);
        this._overlay.set_style(`
            border-radius: ${this._overlayRadius}px;
            border: ${borderThickness}px solid rgba(0, 0, 0, 0.35);
            background-color: rgba(0, 0, 0, 0);
        `);
        
        // Create the green border
        let borderSize = (this._spotlightRadius + SPOTLIGHT_BORDER_WIDTH) * 2;
        this._border = new St.Widget({
            style_class: 'spotlight-border',
        });
        this._border.set_size(borderSize, borderSize);
        this._border.set_style(`
            border-radius: ${this._spotlightRadius + SPOTLIGHT_BORDER_WIDTH}px;
            border: ${SPOTLIGHT_BORDER_WIDTH}px solid rgba(0, 255, 0, 0.5);
            background-color: rgba(0, 0, 0, 0);
        `);
        
        this._container.add_child(this._overlay);
        this._container.add_child(this._border);
        global.stage.add_child(this._container);
        this._callbackId = null;
        this._laters = global.compositor.get_laters();

        this._container.connect('destroy', () => {this._container = null});
        this._overlay.connect('destroy', () => {this._overlay = null});
        this._border.connect('destroy', () => {this._border = null});
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
        if (!this._container) {
            return;
        }
        this._updatePosition();
        this._container.show();
        this._schedule_update();
    }

    _updatePosition() {
        if (!this._overlay || !this._border  || !this._container) {
            return;
        }
        // Update spotlight position to follow cursor
        let [x, y] = global.get_pointer();
        
        // Center the spotlight on the cursor
        this._overlay.set_position(x - this._overlayRadius, y - this._overlayRadius);
        
        // Position the border
        let borderOffset = this._spotlightRadius + SPOTLIGHT_BORDER_WIDTH;
        this._border.set_position(x - borderOffset, y - borderOffset);
    }

    hide() {
        if (this._container) {
            this._container.hide();
        }
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
        if (this._border) {
            this._border.destroy();
        }
        if (this._overlay) {
            this._overlay.destroy();
        }
        if (this._container) {
            global.stage.remove_child(this._container);
            this._container.destroy();
        }
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
        this._widget.connect('destroy', () => {this._widget = null});
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
        if (!this._widget) {
            return;
        }
        this._moveToCursor();
        this._widget.show();
        this._schedule_update();
    }

    _moveToCursor() {
        if (!this._widget) {
           return;
       }
        // move laser to cursor position:
        let [x, y] = global.get_pointer();
        let [width, height] = this._widget.get_size();
        this._widget.set_position(x - width / 2, y - height / 2);
    }

    hide() {
        if (this._widget) {
            this._widget.hide();
        }
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
        if (this._widget) {
            global.stage.remove_child(this._widget);
            this._widget.destroy();
        }
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
        // console.log("constructor()")
        super(metadata);
    }

    enable() {
        // console.log("enable()");
        this._toggle = new QuickSettings.QuickToggle({
            title: 'Laser pointer',
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
        // console.log("_onToggled()");
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
        // console.log("_toggleSpotlightMode()");
        this._spotlight_mode = !this._spotlight_mode;
        this._spotlight_overlay.set_visible(this._spotlight_mode);
        this._laser_cursor.set_visible(this._toggle.checked && !this._spotlight_mode);
        this._updateSystemCursor();
    }
    
    disable() {
        // console.log("disable()");
        Main.wm.removeKeybinding('toggle-spotlight-mode');
        this._spotlight_overlay.destroy();
        this._laser_cursor.destroy();
        this._system_cursor.destroy();
        this._toggle.destroy();
        this._indicator.destroy();
    }
}
