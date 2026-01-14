// This function is automatically triggered when a Netlify form is submitted
// It triggers a GitHub Action to research and add the restaurant

export default async (req, context) => {
  try {
    const body = await req.json();

    // Extract form data from Netlify's submission format
    const formData = body.payload?.data || body.data || {};

    const requestType = formData['request-type'] || 'other';
    const requestValue = formData['request-value'] || '';
    const requestDetails = formData['request-details'] || '';

    if (!requestValue) {
      console.log('No request value, skipping GitHub trigger');
      return new Response('No request value provided', { status: 200 });
    }

    console.log(`Processing request: ${requestType} - ${requestValue}`);

    // Trigger GitHub Action via repository_dispatch
    const githubToken = process.env.GITHUB_TOKEN;
    const githubRepo = process.env.GITHUB_REPO; // format: "owner/repo"

    if (!githubToken || !githubRepo) {
      console.error('Missing GITHUB_TOKEN or GITHUB_REPO environment variables');
      return new Response('Configuration error', { status: 500 });
    }

    const response = await fetch(
      `https://api.github.com/repos/${githubRepo}/dispatches`,
      {
        method: 'POST',
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'Authorization': `token ${githubToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event_type: 'netlify-form-submission',
          client_payload: {
            request_type: requestType,
            request_value: requestValue,
            request_details: requestDetails,
          },
        }),
      }
    );

    if (response.ok || response.status === 204) {
      console.log('Successfully triggered GitHub Action');
      return new Response('GitHub Action triggered', { status: 200 });
    } else {
      const errorText = await response.text();
      console.error('GitHub API error:', response.status, errorText);
      return new Response(`GitHub API error: ${response.status}`, { status: 500 });
    }
  } catch (error) {
    console.error('Function error:', error);
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
};
