const express = require("express");

const shiprocketController = require("../controllers/shiprocket.controller");

const router = express.Router();

router.get("/", shiprocketController.proxyShiprocket);
router.get("/track", shiprocketController.proxyShiprocket);
router.get("/serviceability", shiprocketController.proxyShiprocket);

module.exports = router;
