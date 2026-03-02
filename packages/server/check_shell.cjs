const mongoose = require("mongoose");
(async () => {
  await mongoose.connect("mongodb://localhost:27017/webform");
  const shell = await mongoose.connection.db.collection("shells").findOne({ projectId: "69a3cfc2a7cbd0ddd9c32d7c" });
  if (!shell) { console.log("No shell found"); await mongoose.disconnect(); return; }
  console.log("=== Shell:", shell.name, "===");
  console.log("Version:", shell.version);
  console.log();
  console.log("=== Shell eventHandlers ===");
  for (const h of (shell.eventHandlers || [])) {
    console.log("controlId:", h.controlId, "| event:", h.eventName, "| type:", h.handlerType);
    console.log("code:", h.handlerCode);
    console.log("---");
  }
  console.log();
  console.log("=== Shell controls ===");
  for (const c of shell.controls) {
    console.log("Control:", c.name, "(", c.id, ") type:", c.type);
    if (c.properties.items) {
      console.log("  items:", JSON.stringify(c.properties.items, null, 2));
    }
  }
  await mongoose.disconnect();
})();
