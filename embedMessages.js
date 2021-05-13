module.exports = async function ({ config, bot, formats }) {
  const moment = require("moment");
  const pluginVersion = "1.0.0";
  const KEY = "em";
  const truthyValues = ["on", "1", "true"];
  const falsyValues = ["off", "0", "false", "null"];
  const pfpMap = new Map();
  let pfpMapResetTimeout;

  function log(message) {
    console.log(`[EmbedMessages] ${message}`);
  }

  // Accepts 100,100,100 and 100 100 100
  const isRgb = /^(\d{1,3})\D+(\d{1,3})\D+(\d{1,3})$/;

  /**
   * Parses a color from the input string. The following formats are accepted:
   * - #HEXVALUE
   * - rrr, ggg, bbb
   * - rrr ggg bbb
   * @return Parsed color as integer or `null` if no color could be parsed
   */
  function parseColor(input) {
    // Convert HEX to RGB
    if (input.startsWith("#")) {
      let r = 0,
        g = 0,
        b = 0;

      // 3 digits
      if (input.length == 4) {
        r = "0x" + input[1] + input[1];
        g = "0x" + input[2] + input[2];
        b = "0x" + input[3] + input[3];

        // 6 digits
      } else if (input.length == 7) {
        r = "0x" + input[1] + input[2];
        g = "0x" + input[3] + input[4];
        b = "0x" + input[5] + input[6];
      }

      input = `${+r}, ${+g}, ${+b}`;
    }

    // Convert RGB to INT or return null if invalid
    const rgbMatch = input.match(isRgb);
    if (rgbMatch) {
      const r = parseInt(rgbMatch[1], 10);
      const g = parseInt(rgbMatch[2], 10);
      const b = parseInt(rgbMatch[3], 10);

      if (r > 255 || g > 255 || b > 255) {
        return null;
      }

      // Convert to int and return
      return (r << 16) + (g << 8) + b;
    }

    return null;
  }

  /**
   * Parses a boolean from the input string.
   * String must be either truthy or falsy to return boolean
   * @return Parsed boolean or `null` if string is neither truthy nor falsy
   */
  function parseCustomBoolean(input) {
    if (typeof input === "boolean") {
      return input;
    }

    if (truthyValues.includes(input)) return true;
    if (falsyValues.includes(input)) return false;

    return null;
  }

  const SETTING_NAMES = Object.freeze({
    // Staff -> User
    STAFF_REPLY_DM_ENABLED: "staffReplyDmEnabled",
    STAFF_REPLY_DM_COLOR: "staffReplyDmColor",
    STAFF_REPLY_THREAD_ENABLED: "staffReplyThreadEnabled",
    STAFF_REPLY_THREAD_COLOR: "staffReplyThreadColor",
    STAFF_REPLY_DM_TIMESTAMP_ENABLE: "staffReplyDmTimestampEnabled",

    // User -> Staff
    USER_REPLY_THREAD_ENABLED: "userReplyThreadEnabled",
    USER_REPLY_THREAD_COLOR: "userReplyThreadColor",

    // System -> Any
    SYSTEM_USER_DM_ENABLED: "systemReplyDmEnabled",
    SYSTEM_USER_DM_COLOR: "systemReplyDmColor",
    SYSTEM_USER_THREAD_ENABLED: "systemReplyThreadEnabled",
    SYSTEM_USER_THREAD_COLOR: "systemReplyThreadColor",
    SYSTEM_STAFF_ENABLED: "systemStaffEnabled",
    SYSTEM_STAFF_COLOR: "systemStaffColor",
  });

  // Init with defaults
  const settings = new Map([
    // Staff -> User
    [SETTING_NAMES.STAFF_REPLY_DM_ENABLED, true],
    [SETTING_NAMES.STAFF_REPLY_DM_COLOR, parseColor("#2ECC71")],
    [SETTING_NAMES.STAFF_REPLY_THREAD_ENABLED, true],
    [SETTING_NAMES.STAFF_REPLY_THREAD_COLOR, parseColor("#2ECC71")],
    [SETTING_NAMES.STAFF_REPLY_DM_TIMESTAMP_ENABLE, true],

    // User -> Staff
    [SETTING_NAMES.USER_REPLY_THREAD_ENABLED, true],
    [SETTING_NAMES.USER_REPLY_THREAD_COLOR, parseColor("#9C32A8")],

    // System -> Any
    [SETTING_NAMES.SYSTEM_USER_DM_ENABLED, true],
    [SETTING_NAMES.SYSTEM_USER_DM_COLOR, parseColor("#5865F2")],
    [SETTING_NAMES.SYSTEM_USER_THREAD_ENABLED, true],
    [SETTING_NAMES.SYSTEM_USER_THREAD_COLOR, parseColor("#5865F2")],
    [SETTING_NAMES.SYSTEM_STAFF_ENABLED, true],
    [SETTING_NAMES.SYSTEM_STAFF_COLOR, parseColor("#1AA4BC")],
  ]);

  // Load config settings
  if (KEY in config) {
    for (const [name, override] of Object.entries(config.em)) {
      if (!settings.has(name)) {
        log(`Setting ${name} is not a valid setting`);
      }

      if (name.toLowerCase().includes("enabled")) {
        const parsedBool = parseCustomBoolean(override);
        if (parsedBool === null) {
          log(`Value ${override} is not a valid truthy or falsy value`);
        } else {
          settings.set(name, parsedBool);
        }
      } else if (name.toLowerCase().includes("color")) {
        const parsedColor = parseColor(override);
        if (!parsedColor) {
          log(`Value ${override} is not a valid RGB or HEX color`);
        } else {
          settings.set(name, parsedColor);
        }
      }
    }
  }

  /**
   * Returns pfp url for userId
   * If the userId is in our internal cache, return it
   * If it is not, search through bot's cached users and store it
   *
   * This should make pfp retrieval quicker on large servers where
   * using find on the whole cache could take quite long
   * @param {*} userId
   * @returns
   */
  function getPfp(userId) {
    let pfp = null;
    if (pfpMap.has(userId)) {
      pfp = pfpMap.get(userId);
    } else {
      pfp = bot.users.find((x) => x.id === userId).avatarURL;
      pfpMap.set(userId, pfp);
    }

    return pfp;
  }

  const replyToUserFormatter = function (threadMessage) {
    const userId = threadMessage.user_id;
    const roleName = threadMessage.role_name || config.fallbackRoleName;
    const embed = { description: threadMessage.body, color: settings.get(SETTING_NAMES.STAFF_REPLY_DM_COLOR) };

    if (!threadMessage.is_anonymous) {
      embed.author = {
        name: `${threadMessage.user_name} (${roleName})`,
        icon_url: getPfp(userId),
      };
    } else {
      embed.author = {
        name: roleName,
        icon_url: bot.user.avatarURL,
      };
    }

    if (threadMessage.attachments.length === 1) {
      if (
        threadMessage.attachments[0].endsWith(".png") ||
        threadMessage.attachments[0].endsWith(".jpg") ||
        threadMessage.attachments[0].endsWith(".gif")
      ) {
        embed.image = {
          url: threadMessage.attachments[0],
        };
      } else {
        embed.description += `\n${link}`;
      }
    } else {
      for (const link of threadMessage.attachments) {
        embed.description += `\n${link}`;
      }
    }

    if (config.threadTimestamps && settings.get(SETTING_NAMES.STAFF_REPLY_DM_TIMESTAMP_ENABLE)) {
      embed.timestamp = moment().utc().toISOString();
    }

    return { embed };
  };

  const replyInThreadFormatter = function (threadMessage) {
    const userId = threadMessage.user_id;
    const roleName = threadMessage.role_name || config.fallbackRoleName;
    const embed = {
      description: threadMessage.body,
      color: settings.get(SETTING_NAMES.STAFF_REPLY_THREAD_COLOR),
      footer: { text: `#${threadMessage.message_number}` },
    };

    if (!threadMessage.is_anonymous) {
      embed.author = {
        name: `${threadMessage.user_name} (${roleName})`,
        icon_url: getPfp(userId),
      };
    } else {
      embed.author = {
        name: `${roleName} (${threadMessage.user_name}) `,
        icon_url: bot.user.avatarURL,
      };
    }

    if (threadMessage.attachments.length === 1) {
      if (
        threadMessage.attachments[0].endsWith(".png") ||
        threadMessage.attachments[0].endsWith(".jpg") ||
        threadMessage.attachments[0].endsWith(".gif")
      ) {
        embed.image = {
          url: threadMessage.attachments[0],
        };
      } else {
        embed.description += `\n${link}`;
      }
    } else {
      for (const link of threadMessage.attachments) {
        embed.description += `\n${link}`;
      }
    }

    if (config.threadTimestamps) {
      embed.timestamp = moment().utc().toISOString();
    }

    return { embed };
  };

  const userReplyFormatter = function (threadMessage) {
    const userId = threadMessage.user_id;
    const embed = { description: threadMessage.body, color: settings.get(SETTING_NAMES.USER_REPLY_THREAD_COLOR) };

    embed.author = {
      name: `${threadMessage.user_name}`,
      icon_url: getPfp(userId),
    };

    if (threadMessage.attachments.length === 1) {
      if (
        threadMessage.attachments[0].endsWith(".png") ||
        threadMessage.attachments[0].endsWith(".jpg") ||
        threadMessage.attachments[0].endsWith(".gif")
      ) {
        embed.image = {
          url: threadMessage.attachments[0],
        };
      } else {
        embed.description += `\n${link}`;
      }
    } else {
      for (const link of threadMessage.attachments) {
        embed.description += `\n${link}`;
      }
    }

    if (config.threadTimestamps) {
      embed.timestamp = moment().utc().toISOString();
    }

    return { embed };
  };

  const systemToUserDmFormatter = function (threadMessage) {
    const embed = { description: threadMessage.body, color: settings.get(SETTING_NAMES.SYSTEM_USER_DM_COLOR) };

    embed.author = {
      name: "System",
      icon_url: bot.user.avatarURL,
    };

    if (threadMessage.attachments.length === 1) {
      if (
        threadMessage.attachments[0].endsWith(".png") ||
        threadMessage.attachments[0].endsWith(".jpg") ||
        threadMessage.attachments[0].endsWith(".gif")
      ) {
        embed.image = {
          url: threadMessage.attachments[0],
        };
      } else {
        embed.description += `\n${link}`;
      }
    } else {
      for (const link of threadMessage.attachments) {
        embed.description += `\n${link}`;
      }
    }

    if (config.threadTimestamps && settings.get(SETTING_NAMES.STAFF_REPLY_DM_TIMESTAMP_ENABLE)) {
      embed.timestamp = moment().utc().toISOString();
    }

    return { embed };
  };

  const systemToUserThreadFormatter = function (threadMessage) {
    const embed = { description: threadMessage.body, color: settings.get(SETTING_NAMES.SYSTEM_USER_THREAD_COLOR) };

    embed.author = {
      name: "System",
      icon_url: bot.user.avatarURL,
    };

    if (threadMessage.attachments.length === 1) {
      if (
        threadMessage.attachments[0].endsWith(".png") ||
        threadMessage.attachments[0].endsWith(".jpg") ||
        threadMessage.attachments[0].endsWith(".gif")
      ) {
        embed.image = {
          url: threadMessage.attachments[0],
        };
      } else {
        embed.description += `\n${link}`;
      }
    } else {
      for (const link of threadMessage.attachments) {
        embed.description += `\n${link}`;
      }
    }
    
    if (config.threadTimestamps) {
      embed.timestamp = moment().utc().toISOString();
    }

    return { embed };
  };

  const systemToStaffFormatter = function (threadMessage) {
    const embed = { description: threadMessage.body, color: settings.get(SETTING_NAMES.SYSTEM_STAFF_COLOR) };

    embed.author = {
      name: "System",
      icon_url: bot.user.avatarURL,
    };

    if (threadMessage.attachments.length === 1) {
      if (
        threadMessage.attachments[0].endsWith(".png") ||
        threadMessage.attachments[0].endsWith(".jpg") ||
        threadMessage.attachments[0].endsWith(".gif")
      ) {
        embed.image = {
          url: threadMessage.attachments[0],
        };
      } else {
        embed.description += `\n${link}`;
      }
    } else {
      for (const link of threadMessage.attachments) {
        embed.description += `\n${link}`;
      }
    }

    if (config.threadTimestamps) {
      embed.timestamp = moment().utc().toISOString();
    }

    return { embed };
  };

  // Reset the pfpMap every hour or so, we dont want outdated pfp's to stay forever
  function resetPfpMap() {
    pfpMap.clear();
    pfpMapResetTimeout = setTimeout(resetPfpMap, 1000 * 60 * 60);
  }
  resetPfpMap();

  //#region registering
  // Register all formatters
  if (settings.get(SETTING_NAMES.STAFF_REPLY_DM_ENABLED)) {
    formats.setStaffReplyDMFormatter(replyToUserFormatter);
  }
  if (settings.get(SETTING_NAMES.STAFF_REPLY_THREAD_ENABLED)) {
    formats.setStaffReplyThreadMessageFormatter(replyInThreadFormatter);
  }
  if (settings.get(SETTING_NAMES.USER_REPLY_THREAD_ENABLED)) {
    formats.setUserReplyThreadMessageFormatter(userReplyFormatter);
  }
  if (settings.get(SETTING_NAMES.SYSTEM_USER_DM_ENABLED)) {
    formats.setSystemToUserDMFormatter(systemToUserDmFormatter);
  }
  if (settings.get(SETTING_NAMES.SYSTEM_USER_THREAD_ENABLED)) {
    formats.setSystemToUserThreadMessageFormatter(systemToUserThreadFormatter);
  }
  if (settings.get(SETTING_NAMES.SYSTEM_STAFF_ENABLED)) {
    formats.setSystemThreadMessageFormatter(systemToStaffFormatter);
  }
  //#endregion
  log(`Version ${pluginVersion} loaded`);
};
