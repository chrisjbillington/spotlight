import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Meta from 'gi://Meta';
import * as QuickSettings from 'resource:///org/gnome/shell/ui/quickSettings.js';
import Shell from 'gi://Shell';

import {SystemCursor} from './systemCursor.js';
import {LaserPointer} from './laserPointer.js';
import {Spotlight} from './spotlight.js';
import {DbusService} from './dbusService.js';

const ICON_NAME = 'find-location-symbolic';


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
            title: 'Spotlight',
            iconName: ICON_NAME,
            toggleMode: true
        });
        this._indicator = new SpotlightIndicator();
        this._indicator.quickSettingsItems.push(this._toggle);
        this._toggle.connectObject('clicked', this._on_toggle.bind(this), this);

        // Add indicator to Quick Settings menu
        Main.panel.statusArea.quickSettings.addExternalIndicator(this._indicator);
        
        this._system_cursor = new SystemCursor();
        this._laser_pointer = new LaserPointer();
        this._spotlight = new Spotlight();
        this._dbus_service = new DbusService();
        this._dbus_service.events.connectObject(
            'switch-mode',
            this._switch_mode.bind(this),
            this
        );
        this._spotlight_mode = false;

        // Add keybinding for switching mode:
        this._settings = this.getSettings('org.gnome.shell.extensions.spotlight');
        Main.wm.addKeybinding('toggle-spotlight-mode',
            this._settings, 
            Meta.KeyBindingFlags.NONE,
            Shell.ActionMode.NORMAL,
            this._switch_mode.bind(this)
        );
    }

    _on_toggle(toggle) {
        // console.log("_on_toggle()");
        const enabled = toggle.checked;
        this._indicator.set_visible(enabled);
        // always start in laser pointer mode (and harmless to reset to it on disable):
        this._spotlight_mode = false;
        this._laser_pointer.set_enabled(enabled);
        this._spotlight.set_enabled(false);
        this._system_cursor.set_visible(!enabled);
    }

    _switch_mode() {
        // console.log("_switch_mode()");
        const enabled = this._toggle.checked;
        this._spotlight_mode = !this._spotlight_mode;
        this._laser_pointer.set_enabled(enabled && !this._spotlight_mode);
        this._spotlight.set_enabled(enabled && this._spotlight_mode);
    }
    
    disable() {
        // console.log("disable()");
        Main.wm.removeKeybinding('toggle-spotlight-mode');
        this._spotlight.destroy();
        this._laser_pointer.destroy();
        this._system_cursor.destroy();
        this._toggle.destroy();
        this._indicator.destroy();
        this._dbus_service.events.disconnectObject(this);
        this._dbus_service.destroy();
    }
}
