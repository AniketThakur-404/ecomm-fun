const buildServiceabilityUrl = ({
  pickupPostcode,
  deliveryPostcode,
  weight = "0.5",
  cod = "1",
}) =>
  `https://apiv2.shiprocket.in/v1/external/courier/serviceability/?pickup_postcode=${encodeURIComponent(
    pickupPostcode,
  )}&delivery_postcode=${encodeURIComponent(deliveryPostcode)}&weight=${encodeURIComponent(
    weight,
  )}&cod=${encodeURIComponent(cod)}`;

const buildTrackingUrl = ({ awb, orderId }) => {
  const idPath = awb
    ? `awb/${encodeURIComponent(awb)}`
    : `order/${encodeURIComponent(orderId)}`;
  return `https://apiv2.shiprocket.in/v1/external/courier/track/${idPath}`;
};

const parseShiprocketPayload = async (response) => {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
};

exports.proxyShiprocket = async (req, res) => {
  const token = process.env.SHIPROCKET_TOKEN || process.env.VITE_SHIPROCKET_TOKEN;
  if (!token) {
    return res.status(500).json({ error: "Server not configured for Shiprocket." });
  }

  const awb = String(req.query?.awb || "").trim();
  const orderId = String(req.query?.order_id || "").trim();
  const pickupPostcode = String(req.query?.pickup_postcode || "").trim();
  const deliveryPostcode = String(req.query?.delivery_postcode || "").trim();
  const weight = String(req.query?.weight || "0.5").trim();
  const cod = String(req.query?.cod || "1").trim();

  let targetUrl = null;
  if (awb || orderId) {
    targetUrl = buildTrackingUrl({ awb, orderId });
  } else if (pickupPostcode && deliveryPostcode) {
    targetUrl = buildServiceabilityUrl({
      pickupPostcode,
      deliveryPostcode,
      weight,
      cod,
    });
  } else {
    return res
      .status(400)
      .json({ error: "Missing tracking or serviceability parameters." });
  }

  try {
    const response = await fetch(targetUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    const payload = await parseShiprocketPayload(response);

    if (!response.ok) {
      return res.status(502).json({
        error: "Shiprocket request failed.",
        details: payload?.message || payload?.errors || payload?.raw || null,
      });
    }

    return res.status(200).json(payload);
  } catch (error) {
    console.error("Shiprocket proxy error:", error);
    return res.status(500).json({ error: "Unable to reach Shiprocket." });
  }
};
