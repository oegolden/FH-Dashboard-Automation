const express = require("express");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
app.use(express.json());

const FIREHYDRANT_API_KEY =  process.env.FIREHYDRANT_API_KEY;
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
    const { incident_id, company_name,incident_title } = req.body;
    if (!incident_id || !company_name) {
      return res.status(400).json({ error: "incident_id and company_name are required." });
    }
    const cleaned_name = company_name.replace(/\s/g, ''); 
    console.log(`Attaching status page '${cleaned_name}' to incident ${incident_id}`);
    // 1️⃣ Get all FireHydrant status pages
    let data = await fhRequest("/nunc_connections");
    const pages = data.data;
    console.log("Fetched status pages:", pages);
    // 2️⃣ Find the one matching the company_name (by name)
    const targetPage = pages.find(
      p => p.company_name.toLowerCase() === cleaned_name.toLowerCase()
    );

    if (!targetPage) {
      return res.status(404).json({ error: `No status page found with name '${cleaned_name}'.` });
    }


    // 4️⃣ Add the status page to the incident
    const attachBody = {
      integration_slug: "nunc",
      integration_id: targetPage.id,
      title: `${incident_title}`,
    };
    console.log("Attaching status page with body:", attachBody);
    const result = await fhRequest(`/incidents/${incident_id}/status_pages`, "POST", attachBody);

    return res.status(201).json({
      message: `Status page '${targetPage.name}' linked to incident ${incident_id}`,
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
