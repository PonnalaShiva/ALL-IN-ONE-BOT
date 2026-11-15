const { GlobalFonts } = require("@napi-rs/canvas");
const fs = require("fs");

async function fontRegister(fontPath, fontName) {
  if (!fs.existsSync(fontPath)) {
    throw new Error(`Font path does not exist: ${fontPath}`);
  }

  try {
    const isRegistered = GlobalFonts.registerFromPath(fontPath, fontName);

    if (!isRegistered) {
      throw new Error(`Failed to register font: ${fontName}`);
    }

    return isRegistered;
  } catch (error) {
    throw new Error(`Error registering font from path "${fontPath}": ${error.message}`);
  }
}

module.exports = { fontRegister };