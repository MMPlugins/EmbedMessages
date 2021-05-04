# Config options
This plugin was written with customizability in mind, thus there are a lot of config options.
Below you can find the default options:
```ini
    em.staffReplyDmEnabled = on
    em.staffReplyDmColor = "#2ECC71"

    em.staffReplyThreadEnabled = on
    em.staffReplyThreadColor = "#2ECC71"
    em.staffReplyDmTimestampEnabled = on

    em.userReplyThreadEnabled = on
    em.userReplyThreadColor = "#9C32A8"

    em.systemReplyDmEnabled = on
    em.systemReplyDmColor = "#7289DA"

    em.systemReplyThreadEnabled = on
    em.systemReplyThreadColor = "#7289DA"

    em.systemStaffEnabled = on
    em.systemStaffColor = "#1AA4BC"
```
If you want to change an option, simply copy and paste the corresponding line into your config and change the value.

## Valid values
### Toggles
Any setting that ends in `Enabled` is a toggle.  
Like regular on/off settings, these take any truthy or falsy values.  
Truthy: `on`, `1`, `true`  
Falsy: `off`, `0`, `false`, `null`

### Colors
Any option that ends in `Color` takes a color value.  
Valid color formats are:
- HEX (e.g. "#7289DA") | These must start with a `#` and be in quotes
- RGB (e.g. 114, 137, 218) | Any three numbers delimited with any non-number
