let sessionID = null;

// Your extractLeadInfo function (unchanged, it's the scraping logic)
function extractLeadInfo() {
    function getText(element, selector) {
        const el = element.querySelector(selector);
        return el ? el.textContent.trim() : '';
    }

    function getAttribute(element, selector, attribute) {
        const el = element.querySelector(selector);
        return el ? el.getAttribute(attribute) || '' : '';
    }

    // Extract basic lead information
    const leadInfo = {
        name: getAttribute(document, 'textarea[id="DEFAULT_ID_NAME"]', 'title'),
        status: getText(document, 'button.text-status'),
        phone: getAttribute(document, 'input[id="DEFAULT_ID_PHONE_duplicateWrapper_input"]', 'title'),
        email: Array.from(document.querySelectorAll('input')).find(el =>
            el.getAttribute('title') && el.getAttribute('title').includes('@')
        )?.getAttribute('title') || '',
        city: getAttribute(document, 'textarea[id="1_TEXT"]', 'title'),
        assigned_to: document.querySelector('app-lead-assignee').textContent.split('\n')[0].trim(),
        lead_source: getAttribute(document, 'textarea[id="3_TEXT"]', 'title'),
        lead_gen_date: getAttribute(document, 'textarea[id="2_TEXT"]', 'title'),
    };

    // Extract call history
    const callHistory = Array.from(document.querySelectorAll('li.ogc-action')).map(call => ({
        type: 'Outgoing Call',
        status: getText(call, 'span[test-tcid="actionStatus"]'),
        notes: getText(call, 'span.body'),
        duration: getText(call, 'span[test-tcid="callDuration"]'),
        time: getText(call, 'span.short-date'),
        agent: getText(call, 'span.teamMemberInitials')
    }));

    // Extract status changes
    const statusChanges = Array.from(document.querySelectorAll('app-status-change-action')).map(change => ({
        type: 'Status Change',
        from: getText(change, 'span[test-tcid="fieldChangeFrom"]'),
        to: getText(change, 'span[test-tcid="fieldChangeTo"]'),
        time: getText(change, 'span.short-date'),
        agent: getText(change, 'span.teamMemberInitials')
    }));

    // Extract assignment changes
    const assignments = Array.from(document.querySelectorAll('app-lead-assignment-action')).map(assign => ({
        type: 'Assignment Change',
        from: getText(assign, 'span[test-tcid="fieldChangeFrom"]'),
        to: getText(assign, 'span[test-tcid="fieldChangeTo"]'),
        time: getText(assign, 'span[test-tcid="actionChangeCreationTime"]'),
        agent: getText(assign, 'span.teamMemberInitials')
    }));

    // Extract lead source info
    const leadSources = Array.from(document.querySelectorAll('app-fb-action')).map(source => ({
        type: 'Facebook Lead',
        form_name: getText(source, 'b[test-tcid="formName"]'),
        page_name: getText(source, 'b[test-tcid="pageName"]'),
        time: getText(source, 'span.short-date')
    }));

    return {
        lead_info: leadInfo,
        call_history: callHistory,
        status_changes: statusChanges,
        assignments: assignments,
        lead_sources: leadSources
    };
}


async function autoExtractAndPredict() {
    // Show loading state
    document.getElementById('statusBar').style.display = 'block';
    document.getElementById('statusBar').textContent = 'Fetching data from server...'; // Update status text

    let extractedResult = null; // Will store the scraped data

    try {
        // Get sessionID from the dedicated session service on port 8011
        const sessionResp = await fetch("http://127.0.0.1:8011/session_id/");
        if (!sessionResp.ok) {
            throw new Error(`Failed to fetch session ID: ${sessionResp.status}`);
        }
        const sessionJson = await sessionResp.json();
        sessionID = sessionJson.session_id;
        console.log("Session ID obtained:", sessionID);
        document.getElementById('statusBar').textContent = 'Session ID obtained. Extracting data...';

    } catch (err) {
        console.error("Error obtaining session ID:", err);
        document.getElementById('statusBar').textContent = `Error: ${err.message}`;
        // Hide status bar on critical error
        // document.getElementById('statusBar').style.display = 'none'; // Maybe hide if critical
        return; // Stop execution if session ID cannot be obtained
    }

    try {
        // GET THE ACTIVE TAB
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) {
            throw new Error("No active tab found.");
        }

        // --- RE-INTRODUCE SCRAPING LOGIC HERE ---
        document.getElementById('statusBar').textContent = 'Executing scraping logic...';
        const [{ result }] = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: extractLeadInfo // This calls your scraping function in the active tab
        });
        extractedResult = result; // Store the scraped data

        // Check if extractedResult is valid
        if (!extractedResult || typeof extractedResult !== 'object' || !extractedResult.lead_info) {
             console.warn("Extracted data might be incomplete or malformed:", extractedResult);
             // Optionally, provide a placeholder or an error message to the user
             document.getElementById('statusBar').textContent = 'Warning: Incomplete data extracted. Check CRM page structure.';
             // You might still proceed with partial data or stop here based on requirements.
        } else {
             document.getElementById('statusBar').textContent = 'Data extracted successfully. Sending to backend...';
        }

        // Update the UI with basic lead information
        updateLeadInfo(extractedResult); // Use the actual extracted data

        // Send data to backend for prediction
        const describeUrl = `http://127.0.0.1:8000/describe/?session_id=${sessionID}`;
        const payload = JSON.stringify(extractedResult); // Use the actual extracted data

        console.log("Sending POST to:", describeUrl);
        console.log("Payload:", payload);

        const initializeResponse = await fetch(describeUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: payload
        });

        if (!initializeResponse.ok) {
            const errorText = await initializeResponse.text();
            throw new Error(`Prediction API error: ${initializeResponse.status}, response: ${errorText}`);
        }

        const responseJson = await initializeResponse.json();
        console.log("Response JSON:", responseJson);

        // Hide status bar after successful operation
        document.getElementById('statusBar').textContent = 'Operation completed successfully.';
        setTimeout(() => { // Hide after a short delay
            document.getElementById('statusBar').style.display = 'none';
        }, 2000);


    } catch (error) {
        console.error("Error during data extraction or sending to backend:", error);
        document.getElementById('statusBar').textContent = `Error: ${error.message}`;
        // Keep status bar visible on error
    }
}

// Automatically run once popup content is loaded
document.addEventListener('DOMContentLoaded', autoExtractAndPredict);

// Update function made more robust
function updateLeadInfo(leadData) {
    // Ensure leadData and lead_info exist to prevent errors
    const leadInfo = leadData && leadData.lead_info ? leadData.lead_info : {};

    document.getElementById('lead-name').innerHTML =
        `<strong>Name:</strong> ${leadInfo.name || 'Not available'}`;
    document.getElementById('lead-status').innerHTML =
        `<strong>Status:</strong> ${leadInfo.status || '-'}`;
    document.getElementById('lead-phone').innerHTML =
        `<strong>Phone:</strong> ${leadInfo.phone || '-'}`;
    document.getElementById('lead-budget').innerHTML =
        `<strong>Email:</strong> ${leadInfo.email || '-'}`; // Using email for budget as per your mapping
}