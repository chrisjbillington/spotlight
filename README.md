# Spotlight

GNOME shell extension providing laser pointer and "spotlight" presentation effects.

![screenshot-quick-settings.png](https://raw.githubusercontent.com/chrisjbillington/spotlight/master/screenshot-quick-settings.png)

![screenshot-spotlight.png](https://raw.githubusercontent.com/chrisjbillington/spotlight/master/screenshot-spotlight.png)

Works with Logitech Spotlight presenters, or with a regular mouse.

Has a quick settings toggle to turn on and off, and a status icon to show if it's
enabled.

When enabled, press Ctrl+Alt+S to switch between laser pointer mode and spotlight mode.

In either mode, the laser pointer/spotlight effect is shown whilst the cursor is moving,
and disappears after 1s of cursor inactivity.

Works well in multi-monitor setups, with the spotlight effect sized relative to
individual monitors even if they are different sizes.

## Install

I haven't applied to have this extension on `extensions.gnome.org` yet. In the meantime
you can install from git like so:
```bash
mkdir -p ~/.local/share/gnome-shell/extensions
cd ~/.local/share/gnome-shell/extensions
git clone https://github.com/chrisjbillington/spotlight spotlight\@chrisjbillington.github.com/
glib-compile-schemas spotlight\@chrisjbillington.github.com/schemas/
```
Then enable from the GNOME extensions app. You may need to log out and in again before
GNOME extensions recognises it.

If you don't have the gnome extensions app, you'll need to install it, e.g. for
Debian-based distros:

```bash
sudo apt install gnome-shell-extensions
```

Tested on GNOME shell 48–49.

## Planned features
* allow custom keybinding to switch between laser pointer and spotlight modes
* allow custom spotlight size as fraction of the monitor size
* allow custom spotlight colour, or at least "dark mode" vs "light mode" (that will make
  the overlay light so that it works on dark-coloured presnetations
* The extension listens on a dbus service and can switch modes this way - the plan was
  to have a Python-based `evdev/uinput` service running that would intercept double
  clicks and use that to switch between laser pointer and spotlight modes. I'm unsure if
  this is worth the extra complexity of attempting to ship a separate service that will
  need to run either as root or a user that is a member of the appropriate groups to
  intercept input events. For now the dbus service is there and can be triggered with
  the script in `python/client.py` if you want to hook this up to some other automation.
