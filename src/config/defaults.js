module.exports = {
  user: {
    name: "Your Name",
    company: "Alpaca Factory, LLC",
    address: "999 Boulevard Ct.\nCitytown, NJ 54637"
  },
  projects: {},
  clients: {},
  sync: {
    autoSync: false,
    services: []
  },
  invoice: {
    dateFormat: "MM/dd/yyyy",
    timeFormat: "p"
  },
  display: {
    dateFormat: "PPPP",
    timeFormat: "p",
    textColors: true,
    wordWrapWidth: 65,
    showPunchIDs: false,
    showCommentIndices: false,
    showDayGraphics: false,
    commentRelativeTimestamps: {
      enabled: true,
      fromPreviousComment: true
    }
  },
  storageType: "ledger"
};