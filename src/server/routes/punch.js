const route = require("express").Router();
const format = require("date-fns/format");
const parseDateTime = require("../../utils/parse-datetime");

// ----- Punching In & Out ----- //

// Show punch setup page
route.get("/in", async function(req, res) {
  const { projects } = req.props.config;

  res.render("sections/punch/track/in", { projects });
});

// Create the punch
route.post("/in", async function(req, res) {
  const { Punch, Storage } = req.props;
  const { project } = req.body;

  const punch = new Punch({
    project,
    in: new Date()
  });

  await punch.save();
  await Storage.commit();

  return res.redirect("/");
});

// Show punch out page
route.get("/out/:id", async function(req, res) {
  const { config } = req.props;

  return res.render("sections/punch/track/out", {
    outTime: format(new Date(), `yyyy-MM-dd '@' ${config.display.timeFormat}`)
  });
});

// Punch out
route.post("/out/:id", async function(req, res) {
  // TODO: End punch and redirect to punch details
  const { body } = req;
  const { Punch, Storage } = req.props;
  const { id } = req.params;

  const comment = body.comment.trim() != "" ? body.comment : null;
  const timestamp =
    body.useCustomTimestamp === "on"
      ? parseDateTime(body.timestamp)
      : new Date();

  const punch = await Punch.find(p => p.id === id);

  if (punch) {
    await punch.punchOut(comment, {
      time: timestamp,
      autosave: true
    });
    await Storage.commit();

    return res.redirect("/");
  }

  // TODO: Show 404
});

// ----- Details ----- //

route.get("/:id", async function(req, res) {
  const { id } = req.params;
  const { config, Punch } = req.props;

  const punch = await Punch.find(p => p.id === id);
  const project = config.projects[punch.project];

  const isActive = punch.out == null;
  const isPaid = punch.rate > 0;
  const earnings = punch.pay();

  res.render("sections/punch/show", {
    punch,
    project,
    isActive,
    isPaid,
    earnings
  });
});

// ----- Delete ----- //

route.get("/:id/delete", async function(req, res) {
  const { id } = req.params;
  const { config, Punch } = req.props;

  const punch = await Punch.find(p => p.id === id);

  if (punch) {
    const project = config.projects[punch.project];

    return res.render("sections/punch/delete", { punch, project });
  }

  // TODO: Render 404
});

route.post("/:id/delete", async function(req, res) {
  const { id } = req.params;
  const { Storage, Punch } = req.props;

  const punch = await Punch.find(p => p.id === id);

  if (punch) {
    await punch.delete();
    await Storage.commit();

    return res.redirect("/");
  }

  // TODO: Render 404
});

// ----- Comments ----- //

// Show text editor to enter comment
route.get("/:punchId/comment/new", async function(req, res) {
  res.render("sections/punch/comment/new", {});
});

// Add the comment
route.post("/:punchId/comment/new", async function(req, res) {
  const { body, params, props } = req;
  const { punchId } = params;
  const { comment } = body;
  const { Storage, Punch } = props;

  const punch = await Punch.find(p => p.id === punchId);

  if (punch) {
    console.log({ punchId, body });

    punch.addComment(comment);

    await punch.save();
    await Storage.commit();

    return res.redirect(`/punch/${punchId}`);
  }

  // TODO: Render 404
});

// Show editor to update comment
route.get("/:punchId/comment/:commentId/edit", async function(req, res) {
  const { punchId, commentId } = req.params;
  const { Punch } = req.props;

  const punch = await Punch.find(p => p.id === punchId);

  if (punch) {
    const comment = punch.comments.find(c => c.id === commentId);

    if (comment) {
      return res.render("sections/punch/comment/edit", {
        punchId,
        commentId,
        comment: comment.comment
      });
    }
  }

  // TODO: Render 404
});

// Update the comment
route.post("/:punchId/comment/:commentId/edit", async function(req, res) {
  const { punchId, commentId } = req.params;
  const { Punch, Storage } = req.props;
  const { body } = req;

  const punch = await Punch.find(p => p.id === punchId);

  if (punch) {
    const comment = punch.comments.find(c => c.id === commentId);

    if (comment) {
      comment.comment = body.comment;

      if (body.keepTimestamp != "on") {
        comment.timestamp = new Date();
      }
    }

    await punch.save();
    await Storage.commit();
  }

  return res.redirect(`/punch/${punchId}`);
});

// Show delete confirmation page
route.get("/:punchId/comment/:commentId/delete", async function(req, res) {
  res.render("sections/punch/comment/delete", {});
});

// Actually delete the comment
route.post("/:punchId/comment/:commentId/delete", async function(req, res) {
  const { punchId, commentId } = req.params;
  const { Storage, Punch } = req.props;

  const punch = await Punch.find(p => p.id === punchId);

  if (punch) {
    punch.deleteComment(commentId);

    await punch.save();
    await Storage.commit();

    return res.redirect(`/punch/${punchId}`);
  }

  // TODO: Render 404
});

module.exports = route;
