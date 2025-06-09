let sessionID = null;
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
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Show loading state
    
    document.getElementById('statusBar').style.display = 'block';

    try{
         //get sessionID
       const sessionResp = await fetch("http://127.0.0.1:8011/session_id/");
       const sessionJson = await sessionResp.json();
       sessionID = sessionJson.session_id;

    }catch{
        console.error("error");
    }

    try {
        // Extract lead information
        const [{ result }] = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: extractLeadInfo
        });

        // Update the UI with basic lead information
        updateLeadInfo(result);

       

        //merging sesseion and result
        //const merge_data={"id":sessionID,"scrape_data":result}

        // Send data to backend for prediction
    const describeUrl = `http://127.0.0.1:8000/describe/?session_id=${sessionID}`;
    const payload = JSON.stringify(result);

    console.log("Sending POST to:", describeUrl);
    console.log("Payload:", payload);

    const InitializeResponse = await fetch(describeUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: payload
    });

    console.log("Response:", InitializeResponse);
    const responseJson = await InitializeResponse.json();
    console.log("Response JSON:", responseJson);
        
    } catch (error) {
        console.error("Error:", error);
    
    }
}

// Automatically run once popup content is loaded
document.addEventListener('DOMContentLoaded', autoExtractAndPredict);

function updateLeadInfo(leadData) {
    document.getElementById('lead-name').innerHTML = `<strong>Name:</strong> ${leadData.lead_info.name}`|| 'Not available';
    document.getElementById('lead-status').innerHTML = `<strong>Status:</strong> ${leadData.lead_info.status}`|| '-';
    document.getElementById('lead-phone').innerHTML = `<strong>Phone:</strong> ${leadData.lead_info.phone}`|| '-';
    document.getElementById('lead-budget').innerHTML = `<strong>City:</strong> ${leadData.lead_info.email}`|| '-';

}
