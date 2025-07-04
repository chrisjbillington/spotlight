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
       
       // // Add to the UI group (chrome layer) first
       //  Main.layoutManager.addChrome(this.widget, {
       //      affectsStruts: true,
       //      trackFullscreen: true,
       //  });

        // Add laser to the stage
        Main.uiGroup.add_child(this._laser);
        
        // Track mouse position
        this._motionId = null;

        this._cursor_tracker = global.backend.get_cursor_tracker();

    }

    _setCursorVisible(visible) {
        this._cursor_tracker.disconnectObject(this);
        if (visible) {
            // this._cursor_tracker.inhibit_cursor_visibility(); // doesn't exist?
            // global.display.set_cursor(Meta.Cursor.DEFAULT);
            this._cursor_tracker.set_pointer_visible(true)

        } else {
            // this._cursor_tracker.uninhibit_cursor_visibility(); // doesn't exist? Maybe only in X?
            // global.display.set_cursor(Meta.Cursor.None); // temporary
            this._cursor_tracker.set_pointer_visible(false); // temporary
            // this._cursor_tracker.connect( // Prevents clicks!
            //     'visibility-changed', () => {
            //         global.display.set_cursor(Meta.Cursor.NONE);
            //         if (this._cursor_tracker.get_pointer_visible()) {
            //             this._cursor_tracker.set_pointer_visible(false);
            //         }
            //     },
            // );
        }
    }

    _onToggled(toggle) {
        console.log("_onToggled()");
        const enabled = toggle.checked;
        this._indicator.setVisible(enabled);
        this._laser.visible = enabled;
        this._setCursorVisible(!enabled)

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
        this._laser.set_position(x - 8, y - 8);
        return GLib.SOURCE_CONTINUE;
    }

    disable() {
        console.log("disable()");
        
        if (this._motionId) {
            // Disconnect any previous mouse tracking:
            global.stage.disconnect(this._motionId);
            this._motionId = null;
        }
        // Restore cursor if it was hidden:
        this._setCursorVisible(true);

        // Destroy widgets:
        this._toggle.destroy();
        this._indicator.destroy();
        this._laser.destroy();
    }
}
