import * as Main from 'resource:///org/gnome/shell/ui/main.js'
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js'
import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Meta from 'gi://Meta';
import * as QuickSettings from 'resource:///org/gnome/shell/ui/quickSettings.js';
import Shell from 'gi://Shell';

import {SystemCursor} from './systemCursor.js';
import {LaserPointer} from './laserPointer.js';
import {Spotlight} from './spotlight.js';
import {DbusServer} from './dbusServer.js';

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
        this._laser_cursor = new LaserPointer();
        this._spotlight_overlay = new Spotlight();
        this._dbus_server = new DbusServer();
        this._dbus_server.events.connectObject(
            'switch-mode',
            this._switch_mode.bind(this),
            this
        );
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

    _switch_mode() {
        console.log("_switch_mode()");
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
        this._dbus_server.events.disconnectObject(this);
        this._dbus_server.destroy();
    }
}
