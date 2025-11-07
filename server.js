const express = require("express");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
app.use(express.json());

const FIREHYDRANT_API_KEY = process.env.FIREHYDRANT_API_KEY;
const FIREHYDRANT_API_BASE = "https://api.firehydrant.io/v1";
const ZENDESK_API_KEY = process.env.ZENDESK_API_KEY;
const ZENDESK_EMAIL = "jwehrle@auditboard.com";
const ZENDESK_SUBDOMAIN = "soxhub1753473789";
 
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
    const { incident_id, company_name, incident_title } = req.body;
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


// --- Push Update to Zendesk Ticket ---
app.post("/update-zendesk-ticket", async (req, res) => {
  try {
    const { ticket_ids, comment_body, author_id } = req.body;
    
    if (!ticket_ids || !comment_body) {
      return res.status(400).json({ error: "ticket_ids and comment_body are required." });
    }

    // Parse ticket IDs from comma-separated string "49,48,47"
    const ticketIdArray = ticket_ids.split(',').map(id => id.trim()).filter(id => id);

    if (ticketIdArray.length === 0) {
      return res.status(400).json({ error: "No valid ticket IDs provided." });
    }

    console.log(`Updating ${ticketIdArray.length} Zendesk ticket(s): ${ticketIdArray.join(', ')}`);

    // Prepare the authentication credentials
    const auth = Buffer.from(`${ZENDESK_EMAIL}/token:${ZENDESK_API_KEY}`).toString('base64');

    // Prepare the ticket update body
    const updateBody = {
      ticket: {
        comment: {
          body: comment_body,
          public: true,
          ...(author_id && { author_id })
        }
      }
    };

    // Update all tickets
    const results = [];
    const errors = [];

    console.log('Update body:', JSON.stringify(updateBody, null, 2));

    for (const ticketId of ticketIdArray) {
      try {
        console.log(`Attempting to update ticket ${ticketId}...`);
        const response = await fetch(
          `https://${ZENDESK_SUBDOMAIN}.zendesk.com/api/v2/tickets/${ticketId}.json`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Basic ${auth}`
            },
            body: JSON.stringify(updateBody)
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Ticket ${ticketId} failed:`, response.status, errorText);
          errors.push({ ticket_id: ticketId, error: `${response.status}: ${errorText}` });
        } else {
          const result = await response.json();
          console.log(`Ticket ${ticketId} updated successfully`);
          results.push({ ticket_id: ticketId, success: true, data: result });
        }
      } catch (err) {
        console.error(`Ticket ${ticketId} exception:`, err);
        errors.push({ ticket_id: ticketId, error: err.message });
      }
    }

    // Return summary of results
    const responseData = {
      total: ticketIdArray.length,
      successful: results.length,
      failed: errors.length,
      results,
      ...(errors.length > 0 && { errors })
    };

    const statusCode = errors.length === ticketIdArray.length ? 500 : 200;

    return res.status(statusCode).json({
      message: `Updated ${results.length} of ${ticketIdArray.length} ticket(s)`,
      ...responseData
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// --- Start server ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));