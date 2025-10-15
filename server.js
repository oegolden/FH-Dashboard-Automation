import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

const FIREHYDRANT_API_KEY = process.env.FH_API_KEY;
const FIREHYDRANT_API_BASE = "https://api.firehydrant.io/v1";

// --- Helper: call FireHydrant API ---
async function fhRequest(endpoint, method = "GET", body = null) {
  const res = await fetch(`${FIREHYDRANT_API_BASE}${endpoint}`, {
    method,
    headers: {
      "Authorization": `Bearer ${FIREHYDRANT_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`FireHydrant API error ${res.status}: ${text}`);
  }

  return res.json();
}

// --- Main route ---
app.post("/attach-status-page", async (req, res) => {
  try {
    const { incident_id, field_value } = req.body;
    if (!incident_id || !field_value) {
      return res.status(400).json({ error: "incident_id and field_value are required." });
    }

    // 1️⃣ Get all FireHydrant status pages
    const pages = await fhRequest("/status_pages");

    // 2️⃣ Find the one matching the field_value (by name)
    const targetPage = pages.find(
      p => p.name.toLowerCase() === field_value.toLowerCase()
    );

    if (!targetPage) {
      return res.status(404).json({ error: `No status page found with name '${field_value}'.` });
    }

    

    // 4️⃣ Add the status page to the incident
    const attachBody = {
      integration_slug: "nunnc",
      integration_id: fhIntegration.id,
      title: `${targetPage.name} – Linked from Incident`,
    };

    const result = await fhRequest(`/incidents/${incident_id}/status_pages`, "POST", attachBody);

    return res.status(201).json({
      message: `Status page '${targetPage.name}' linked to incident ${incident_id} sett ${}`,
      result
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// --- Start server ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
