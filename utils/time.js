const TZ = "Asia/Colombo";

// "2026-09-22T20:10:17+05:30" (Sri Lanka time, same format Dwesk uses)
exports.colomboIso = (d = new Date()) =>
  new Date(d)
    .toLocaleString("sv-SE", { timeZone: TZ }) // "2026-09-22 20:10:17"
    .replace(" ", "T") + "+05:30";

// "2026-09-22"
exports.colomboDate = (d = new Date()) =>
  new Date(d).toLocaleDateString("en-CA", { timeZone: TZ });

exports.TZ = TZ;