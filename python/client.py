SERVICE_NAME = 'org.gnome.shell.extensions.spotlight'
OBJECT_PATH = '/org/gnome/shell/extensions/spotlight'
INTERFACE_NAME = 'org.gnome.shell.extensions.spotlight'

import dbus

class DBusClient:
    def __init__(self):
        bus = dbus.SessionBus()
        receiver = bus.get_object(SERVICE_NAME, OBJECT_PATH)
        self.interface = dbus.Interface(receiver, INTERFACE_NAME)
    
    def send_switch_mode(self):
        self.interface.switch_mode()

client = DBusClient()
client.send_switch_mode()
