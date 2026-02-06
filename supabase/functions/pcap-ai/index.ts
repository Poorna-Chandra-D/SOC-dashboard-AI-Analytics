import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { analysis_type, input, prompt } = await req.json();
    const apiKey = Deno.env.get('OPENAI_API_KEY');
    const model = Deno.env.get('OPENAI_MODEL') || 'gpt-4o-mini';

    console.log('Received request:', { analysis_type, hasInput: !!input, hasPrompt: !!prompt });
    console.log('API Key present:', !!apiKey, 'Model:', model);

    if (!apiKey) {
      console.error('OPENAI_API_KEY is not set in Supabase secrets');
      return new Response(JSON.stringify({ error: 'OPENAI_API_KEY not configured in Supabase secrets' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const requestBody = {
      model,
      messages: [
        {
          role: 'system',
          content:
            'You are a SOC analyst. Provide concise bullet points, risks, and recommendations.',
        },
        {
          role: 'user',
          content: `${prompt || 'Analyze PCAP summary'}\n\n${JSON.stringify(input)}`,
        },
      ],
      max_tokens: 500,
      temperature: 0.7,
    };

    console.log('Calling OpenAI API with model:', model);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    console.log('OpenAI response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', errorText);
      return new Response(
        JSON.stringify({ 
          error: 'OpenAI API request failed', 
          status: response.status,
          details: errorText 
        }), 
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const data = await response.json();
    const analysis = data.choices?.[0]?.message?.content || 'No analysis generated';

    console.log('Analysis generated successfully, length:', analysis.length);

    return new Response(
      JSON.stringify({
        analysis,
        model,
        analysis_type: analysis_type || 'pcap',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Edge Function error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
