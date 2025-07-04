import * as Main from 'resource:///org/gnome/shell/ui/main.js'
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js'
import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Meta from 'gi://Meta';
import * as QuickSettings from 'resource:///org/gnome/shell/ui/quickSettings.js';
import Gio from 'gi://Gio';


const ICON_NAME = 'applications-graphics-symbolic';


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
        
        // Track mouse position
        // this._mouseUpdateId = null;
    }

    _onToggled(toggle) {
        console.log("_onToggled()");
        this._indicator.setVisible(toggle.checked);
        this._laser.visible = toggle.checked;
        
        // if (this._laser_enabled) {
        //     // Show red dot and hide cursor
        //     this._laser.visible = true;
        //     this._startMouseTracking();
        //     global.display.set_cursor(Meta.Cursor.BLANK);
        // } else {
        //     // Hide red dot and show cursor
        //     this._laser.visible = false;
        //     this._stopMouseTracking();
        //     global.display.set_cursor(Meta.Cursor.DEFAULT);
        // }
        
        // // Update indicator
        // this._indicator.updateIndicator(this._laser_enabled);
    }
    
    // _startMouseTracking() {
    //     if (this._mouseUpdateId) {
    //         return;
    //     }
        
    //     this._mouseUpdateId = global.stage.connect('motion-event', () => {
    //         let [x, y] = global.get_pointer();
    //         this._laser.set_position(x - 8, y - 8);
    //         return Clutter.EVENT_PROPAGATE;
    //     });
        
    //     // Set initial position
    //     let [x, y] = global.get_pointer();
    //     this._laser.set_position(x - 8, y - 8);
    // }
    
    // _stopMouseTracking() {
    //     if (this._mouseUpdateId) {
    //         global.stage.disconnect(this._mouseUpdateId);
    //         this._mouseUpdateId = null;
    //     }
    // }

    disable() {
        console.log("disable()");
        
        this._toggle.destroy();
        this._indicator.destroy();

        // Restore cursor if it was hidden
        // if (this._laser_enabled) {
        //     global.display.set_cursor(Meta.Cursor.DEFAULT);
        // }
        
        // Stop mouse tracking
        // this._stopMouseTracking();
    }
}
