import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { name, email, question, userId } = await req.json();

    if (!name || !email || !question) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Email configuration missing" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "BillBrain Support <onboarding@resend.dev>",
        to: ["rakshitpatel279@gmail.com"],
        reply_to: email,
        subject: `[BillBrain Support] New ticket from ${name}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #1A3A6B; color: white; padding: 20px; border-radius: 12px 12px 0 0;">
              <h2 style="margin: 0;">🧾 BillBrain Support Ticket</h2>
            </div>
            <div style="background: #FAF8F4; padding: 24px; border: 1px solid #EDE8E0; border-radius: 0 0 12px 12px;">
              <p style="margin: 0 0 16px 0;"><strong>From:</strong> ${name}</p>
              <p style="margin: 0 0 16px 0;"><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
              ${userId ? `<p style="margin: 0 0 16px 0;"><strong>User ID:</strong> ${userId}</p>` : ""}
              <hr style="border: none; border-top: 1px solid #EDE8E0; margin: 16px 0;" />
              <p style="margin: 0 0 8px 0;"><strong>Question:</strong></p>
              <p style="margin: 0; background: white; padding: 16px; border-radius: 8px; border: 1px solid #EDE8E0;">${question.replace(/\n/g, "<br>")}</p>
            </div>
            <p style="color: #8A7E72; font-size: 12px; margin-top: 16px; text-align: center;">
              Hit Reply to respond directly to ${name} at ${email}
            </p>
          </div>
        `,
      }),
    });

    const result = await res.json();

    if (!res.ok) {
      console.error("Resend error:", result);
      return new Response(
        JSON.stringify({ error: "Failed to send email", details: result }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: "Email sent successfully" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to send email", details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});