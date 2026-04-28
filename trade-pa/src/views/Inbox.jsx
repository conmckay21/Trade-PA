// ─── Inbox & Email-action dispatch ──────────────────────────────────────
// Extracted verbatim from App.jsx during P7 sub-batch B (28 Apr 2026).
//
// Bundles InboxView with the 3 async email-action helpers it shares with
// AIAssistant: executeEmailAction (the workhorse — 536 lines, dispatches
// every kind of inbox action), updateEmailAIContext, logEmailFeedback.
// All three are exported so App.jsx can re-import them for AIAssistant
// (still in App.jsx until P10).
import React, { useState, useEffect } from "react";
import { db } from "../lib/db.js";
import { C } from "../theme/colors.js";
import { S } from "../theme/styles.js";
import { fmtCurrency } from "../lib/format.js";
import { localMonth } from "../lib/time.js";
import { authHeaders } from "../lib/auth.js";
import { buildEmailHTML } from "../lib/invoice-html.js";
import { generatePortalToken, newEnquiryId, nextInvoiceId } from "../lib/ids.js";
import { useWhisper } from "../hooks/useWhisper.js";

export async function executeEmailAction(action, env) {
  const { user, brand, connection, customers, invoices,
          setCustomers, setJobs, setInvoices, setMaterials, setEnquiries,
          sendPush } = env;
  const db = window._supabase;
  const d = action.action_data || {};
  switch (action.action_type) {
    case "create_job": {
      // Add job to schedule — use TBC if no date mentioned
      const hasDate = !!(d.date_text && d.date_text.trim());
      setJobs(prev => [...(prev || []), {
        id: Date.now(),
        customer: d.customer || d.sender_name || "Unknown",
        address: d.address || "",
        type: d.type || "Job",
        date: hasDate ? d.date_text : "TBC",
        dateObj: new Date().toISOString(),
        status: "pending",
        value: 0,
        notes: d.notes || `From email: ${action.email_subject}`,
      }]);

      // Check if customer already exists
      const replyTo = d.reply_to || action.email_from?.match(/<(.+)>/)?.[1] || action.email_from || "";
      const senderName = d.sender_name || d.customer || "there";
      const existingCustomer = (customers || []).find(c =>
        c.name?.toLowerCase().includes((d.customer || "").toLowerCase()) ||
        c.email?.toLowerCase() === replyTo.toLowerCase()
      );

      if (replyTo && connection) {
        if (!existingCustomer) {
          // New customer — add partial record and ask for details + availability
          setCustomers(prev => [...(prev || []), {
            id: Date.now(),
            name: d.customer || d.sender_name || "Unknown",
            email: replyTo,
            phone: "",
            address: "",
            notes: `Added from email booking request`,
          }]);

          const jobDesc = d.type || "the work";
          const dateText = hasDate ? ` on ${d.date_text}` : "";
          const replyBody = `<p>Hi ${senderName},</p>
<p>Thank you for getting in touch. I've added your ${jobDesc} request${dateText} to my diary and will be in touch to confirm the appointment.</p>
<p>To get you set up ahead of the scheduled appointment, could you please provide the following details:</p>
<ul>
<li><strong>Full name</strong></li>
<li><strong>Phone number</strong></li>
<li><strong>Address where the work is needed</strong></li>
${!hasDate ? "<li><strong>A few preferred dates and times that work for you</strong></li>" : ""}
</ul>
<p>Once I have these I'll send you a full confirmation.</p>
<p>Many thanks,<br>${brand?.tradingName || ""}${brand?.phone ? `<br>${brand.phone}` : ""}${brand?.email ? `<br>${brand.email}` : ""}</p>`;

          const endpoint = connection.provider === "outlook" ? "/api/outlook/send" : "/api/gmail/send";
          await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: user.id, to: replyTo, subject: `Re: ${action.email_subject}`, body: replyBody }),
          }).catch(err => console.error("Reply failed:", err.message));

        } else {
          // Existing customer — send a booking confirmation
          const jobDesc = d.type || "the work";
          const dateText = hasDate ? ` on ${d.date_text}` : "";
          const availabilityLine = !hasDate
            ? `<p>Could you please suggest a few dates and times that work for you so we can get something confirmed?</p>`
            : `<p>We'll be in touch shortly to confirm the full details.</p>`;

          const replyBody = `<p>Hi ${senderName},</p>
<p>Thank you for getting in touch. I've added your ${jobDesc} request${dateText} to the diary.</p>
${availabilityLine}
<p>Many thanks,<br>${brand?.tradingName || ""}${brand?.phone ? `<br>${brand.phone}` : ""}${brand?.email ? `<br>${brand.email}` : ""}</p>`;

          const endpoint = connection.provider === "outlook" ? "/api/outlook/send" : "/api/gmail/send";
          await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: user.id, to: replyTo, subject: `Re: ${action.email_subject}`, body: replyBody }),
          }).catch(err => console.error("Confirmation reply failed:", err.message));
        }
      }
      break;
    }
    case "create_enquiry": {
      const replyTo = d.reply_to || action.email_from?.match(/<(.+)>/)?.[1] || action.email_from || "";
      const senderName = d.sender_name || d.customer || d.name || "there";
      const enquiryName = d.name || d.customer || d.sender_name || senderName || "Unknown";

      // Create enquiry with full contact details. The ID is generated up
      // front so the setEnquiries wrapper's per-row upsert writes to a stable
      // row, and any follow-up (e.g. the push notification handler navigating
      // to this specific enquiry) can reference it by ID.
      const newEnquiry = {
        id: newEnquiryId(),
        name: enquiryName,
        source: "Email",
        msg: d.message || action.email_snippet,
        time: "Just now",
        urgent: d.urgent || false,
        status: "new",
        email: replyTo,
        phone: d.phone || "",
        address: d.address || "",
      };
      setEnquiries(prev => [newEnquiry, ...(prev || [])]);
      // Push notification for new enquiry — optional-chained so voice path
      // (which doesn't pass sendPush) doesn't throw.
      sendPush?.({
        title: "📩 New Enquiry",
        body: `${enquiryName}${d.message ? " — " + d.message.slice(0, 80) : ""}`,
        url: "/",
        type: "enquiry",
        tag: "new-enquiry",
        requireInteraction: true,
      });

      // Note: no separate Supabase insert here — the setEnquiries wrapper
      // now persists via per-row upsert (since the 2026-04-24 refactor).
      // The previous direct insert at this spot was creating duplicates
      // because the old wipe-and-reinsert wrapper was also writing the row.

      // Create or update customer record
      const existingCustomer = (customers || []).find(c =>
        c.email?.toLowerCase() === replyTo.toLowerCase() ||
        c.name?.toLowerCase() === enquiryName.toLowerCase()
      );

      if (replyTo && !existingCustomer) {
        setCustomers(prev => [...(prev || []), {
          id: Date.now(),
          name: enquiryName,
          email: replyTo,
          phone: d.phone || "",
          address: d.address || "",
          notes: "Added from email enquiry",
        }]);
      }

      // Send reply asking for details (only if we have a reply address and email connection)
      if (replyTo && connection) {
        const replyBody = `<p>Hi ${senderName},</p>
<p>Thank you for getting in touch. I've added your ${d.type || d.message?.slice(0, 50) || "enquiry"} to the diary.</p>
<p>Could you please suggest a few dates and times that work for you so we can get something confirmed?</p>
${!existingCustomer ? `<p>It would also be helpful to have:</p>
<ul>
<li><strong>Your phone number</strong></li>
<li><strong>The address where the work is needed</strong></li>
</ul>` : ""}
<p>Many thanks,<br>${brand?.tradingName || ""}${brand?.phone ? `<br>${brand.phone}` : ""}${brand?.email ? `<br>${brand.email}` : ""}</p>`;

        const endpoint = connection.provider === "outlook" ? "/api/outlook/send" : "/api/gmail/send";
        await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.id, to: replyTo, subject: `Re: ${action.email_subject}`, body: replyBody }),
        }).catch(err => console.error("Enquiry reply failed:", err.message));
      }
      break;
    }
    case "save_customer": { const ex = (customers || []).find(c => c.name?.toLowerCase() === (d.name || d.customer || "").toLowerCase()); if (!ex) setCustomers(prev => [...(prev || []), { id: Date.now(), name: d.name || d.customer || "Unknown", email: d.email || d.reply_to || "", phone: d.phone || "", address: "", notes: "" }]); break; }
    case "add_materials": {
      // If we have attachment info, parse the PDF to extract line items
      if (d.message_id && d.attachment_id) {
        try {
          const isOutlook = connection?.provider === "outlook";
          const endpoint = isOutlook ? "/api/outlook/parse-supplier" : "/api/gmail/parse-supplier";
          const parseRes = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: user.id, messageId: d.message_id, attachmentId: d.attachment_id }),
          });
          const parseData = await parseRes.json();
          if (parseData.items?.length > 0) {
            const receiptId = `email_${action.id}_${Date.now()}`;
            const supplierName = d.supplier || action.email_from?.match(/^(.+?)\s*</)?.[1]?.replace(/"/g, "") || "Supplier";
            const newMaterials = parseData.items.map((item, i) => ({
              id: Date.now() + i,
              item: item.item || item.description || "Unknown item",
              qty: item.qty || 1,
              unitPrice: item.unitPrice || item.unit_price || 0,
              supplier: supplierName,
              job: "",
              status: "ordered", // Invoice received = already ordered/purchased
              receiptId,
              receiptSource: "email",
              receiptFilename: d.attachment_filename || "",
            }));
            setMaterials(prev => [...newMaterials, ...(prev || [])]);
            break;
          }
        } catch (err) {
          console.error("PDF parse failed:", err.message);
        }
      }
      // Fallback — add single placeholder entry
      setMaterials(prev => [...(prev || []), {
        id: Date.now(),
        item: `Items from ${d.supplier || d.attachment_filename || "supplier invoice"}`,
        qty: 1, unitPrice: 0,
        supplier: d.supplier || "",
        job: "", status: "to_order",
        receiptSource: "email",
        receiptFilename: d.attachment_filename || "",
      }]);
      break;
    }

    case "add_cis_statement": {
      // Try to parse CIS statement from PDF attachment
      if (d.message_id && d.attachment_id) {
        try {
          const isOutlook = connection?.provider === "outlook";
          const { data: connData } = await window._supabase.from("email_connections").select("access_token").eq("user_id", user.id).single();
          const token = connData?.access_token;

          const attRes = await fetch(
            isOutlook
              ? `https://graph.microsoft.com/v1.0/me/messages/${d.message_id}/attachments/${d.attachment_id}`
              : `https://gmail.googleapis.com/gmail/v1/users/me/messages/${d.message_id}/attachments/${d.attachment_id}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          const attData = await attRes.json();
          const rawBase64 = isOutlook ? attData.contentBytes : attData.data;

          if (rawBase64) {
            const base64Clean = rawBase64.replace(/-/g, "+").replace(/_/g, "/");
            const pdfDataUrl = `data:application/pdf;base64,${base64Clean}`;

            // Use Claude to extract CIS data from the PDF
            const parseRes = await fetch("/api/claude", {
              method: "POST",
              headers: await authHeaders(),
              body: JSON.stringify({
                model: "claude-sonnet-4-6",
                max_tokens: 400,
                messages: [{
                  role: "user",
                  content: [
                    { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64Clean } },
                    { type: "text", text: "Extract CIS monthly statement details. Return ONLY JSON: {\"contractor_name\":\"company name\",\"tax_month\":\"YYYY-MM\",\"gross_amount\":number,\"deduction_amount\":number,\"net_amount\":number}" }
                  ],
                }],
              }),
            });
            const parseData = await parseRes.json();
            const raw = parseData.content?.[0]?.text?.trim() || "{}";
            const match = raw.match(/\{[\s\S]*\}/);
            const cis = match ? JSON.parse(match[0]) : {};

            await window._supabase.from("cis_statements").insert({
              user_id: user.id,
              contractor_name: cis.contractor_name || d.contractor_name || "Unknown Contractor",
              tax_month: ((cis.tax_month || d.tax_month || localMonth())) + "-01",
              gross_amount: cis.gross_amount || parseFloat(d.gross_amount) || 0,
              deduction_amount: cis.deduction_amount || parseFloat(d.deduction_amount) || 0,
              net_amount: cis.net_amount || ((cis.gross_amount || 0) - (cis.deduction_amount || 0)) || 0,
              notes: `From email: ${action.email_subject}`,
              attachment_data: pdfDataUrl,
            });
            break;
          }
        } catch (err) {
          console.error("CIS PDF parse failed:", err.message);
        }
      }
      // Fallback — save what Claude extracted from the email body
      if (d.contractor_name || d.gross_amount) {
        await window._supabase.from("cis_statements").insert({
          user_id: user.id,
          contractor_name: d.contractor_name || "Unknown Contractor",
          tax_month: (d.tax_month || localMonth()) + "-01",
          gross_amount: parseFloat(d.gross_amount) || 0,
          deduction_amount: parseFloat(d.deduction_amount) || 0,
          net_amount: (parseFloat(d.gross_amount) || 0) - (parseFloat(d.deduction_amount) || 0),
          notes: `From email: ${action.email_subject}`,
        });
      }
      break;
    }
    case "update_job": {
      const jobId = d.job_id;
      const customerNameForJob = (d.customer || "").toLowerCase();
      const jobValue = d.job_value ? parseFloat(d.job_value) : null;

      if (jobId) {
        await db.from("job_cards")
          .update({ status: "completed", completion_date: new Date().toISOString() })
          .eq("id", jobId)
          .eq("user_id", user.id);
      } else {
        const { data: matchingJobs } = await db.from("job_cards")
          .select("id, title, type, status, value")
          .eq("user_id", user.id)
          .ilike("customer", `%${customerNameForJob}%`)
          .neq("status", "completed")
          .order("created_at", { ascending: false });

        if (matchingJobs?.length > 0) {
          let bestMatch = matchingJobs[0];
          if (jobValue && matchingJobs.length > 1) {
            const valueMatch = matchingJobs.find(j =>
              j.value && Math.abs(parseFloat(j.value) - jobValue) / jobValue < 0.1
            );
            if (valueMatch) bestMatch = valueMatch;
          }
          await db.from("job_cards")
            .update({ status: "completed", completion_date: new Date().toISOString() })
            .eq("id", bestMatch.id)
            .eq("user_id", user.id);
        }
      }
      // Send completion confirmation email
      const replyTo = d.reply_to || action.email_from?.match(/<(.+)>/)?.[1] || action.email_from || "";
      const custRecord = (customers || []).find(c => c.name?.toLowerCase().includes(customerNameForJob));
      const completeEmail = custRecord?.email || replyTo;
      const completeName = d.customer || custRecord?.name || "there";
      if (completeEmail && connection) {
        const jobDesc = d.type || "the work";
        const completeBody = `<p>Hi ${completeName},</p>
<p>Just to confirm that ${jobDesc} has been completed and marked off on our system.</p>
<p>If there's anything you're not happy with or if you have any questions, please don't hesitate to get in touch.</p>
<p>Many thanks,<br>${brand?.tradingName || ""}${brand?.phone ? `<br>${brand.phone}` : ""}${brand?.email ? `<br>${brand.email}` : ""}</p>`;
        const endpoint = connection.provider === "outlook" ? "/api/outlook/send" : "/api/gmail/send";
        await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.id, to: completeEmail, subject: `Job completed — ${brand?.tradingName || ""}`, body: completeBody }),
        }).catch(err => console.error("Completion email failed:", err.message));
      }
      break;
    }
    case "reschedule_job": {
      const customerName = d.customer || "";
      const newDate = d.new_date || d.date_text || "";
      const { data: matchJobs } = await db.from("job_cards")
        .select("id, title, type, customer")
        .eq("user_id", user.id)
        .ilike("customer", `%${customerName}%`)
        .neq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(1);
      if (matchJobs?.length) {
        const updates = { notes: `Rescheduled via email: ${action.email_subject}` };
        if (newDate) {
          updates.date = newDate;
          try { updates.dateObj = new Date(newDate).toISOString(); } catch {}
        }
        await db.from("job_cards").update(updates).eq("id", matchJobs[0].id).eq("user_id", user.id);
        setJobs(prev => (prev || []).map(j => j.id === matchJobs[0].id ? { ...j, ...updates } : j));
      }
      // Reply confirming reschedule
      const replyTo = d.reply_to || action.email_from?.match(/<(.+)>/)?.[1] || action.email_from || "";
      if (replyTo && connection) {
        const senderName = d.sender_name || customerName || "there";
        const dateConfirm = newDate ? ` I've updated the diary to ${newDate}.` : "";
        const replyBody = `<p>Hi ${senderName},</p>
<p>No problem at all.${dateConfirm}${!newDate ? " Could you let me know what date and time would work better for you?" : ""}</p>
<p>Many thanks,<br>${brand?.tradingName || ""}${brand?.phone ? `<br>${brand.phone}` : ""}${brand?.email ? `<br>${brand.email}` : ""}</p>`;
        const endpoint = connection.provider === "outlook" ? "/api/outlook/send" : "/api/gmail/send";
        await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.id, to: replyTo, subject: `Re: ${action.email_subject}`, body: replyBody }),
        }).catch(err => console.error("Reschedule reply failed:", err.message));
      }
      break;
    }
    case "cancel_job": {
      const customerName = d.customer || "";
      const { data: matchJobs } = await db.from("job_cards")
        .select("id, title, type, customer")
        .eq("user_id", user.id)
        .ilike("customer", `%${customerName}%`)
        .neq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(1);
      if (matchJobs?.length) {
        await db.from("job_cards").update({ status: "cancelled", notes: `Cancelled via email: ${action.email_subject}` }).eq("id", matchJobs[0].id).eq("user_id", user.id);
        setJobs(prev => (prev || []).map(j => j.id === matchJobs[0].id ? { ...j, status: "cancelled" } : j));
      }
      // Reply confirming cancellation
      const replyTo = d.reply_to || action.email_from?.match(/<(.+)>/)?.[1] || action.email_from || "";
      if (replyTo && connection) {
        const senderName = d.sender_name || customerName || "there";
        const replyBody = `<p>Hi ${senderName},</p>
<p>No problem — I've removed that from the diary. If you'd like to rebook in the future, just get in touch and we'll get you sorted.</p>
<p>Many thanks,<br>${brand?.tradingName || ""}${brand?.phone ? `<br>${brand.phone}` : ""}${brand?.email ? `<br>${brand.email}` : ""}</p>`;
        const endpoint = connection.provider === "outlook" ? "/api/outlook/send" : "/api/gmail/send";
        await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.id, to: replyTo, subject: `Re: ${action.email_subject}`, body: replyBody }),
        }).catch(err => console.error("Cancellation reply failed:", err.message));
      }
      break;
    }
    case "mark_invoice_paid": {
      // Extract invoice number from action_data, email subject, or email snippet
      const invoiceNumFromData = d.invoice_number ? String(d.invoice_number) : null;
      const subjectMatch = action.email_subject?.match(/(?:invoice\s*#?\s*)(\d+)/i);
      const invoiceNumFromSubject = subjectMatch ? subjectMatch[1] : null;
      const snippetMatch = action.email_snippet?.match(/(?:invoice\s*#?\s*)(\d+)/i);
      const invoiceNumFromSnippet = snippetMatch ? snippetMatch[1] : null;
      const invoiceNum = invoiceNumFromData || invoiceNumFromSubject || invoiceNumFromSnippet;
      const customerNameLower = (d.customer || "").toLowerCase();

      const inv = (invoices || []).find(i => {
        if (i.isQuote || i.status === "paid") return false;
        // Match by invoice number (highest priority)
        if (invoiceNum && i.id?.includes(invoiceNum)) return true;
        // Match by customer name
        if (customerNameLower && i.customer?.toLowerCase().includes(customerNameLower)) return true;
        return false;
      });

      if (inv) {
        setInvoices(prev => (prev || []).map(i => i.id === inv.id ? { ...i, status: "paid", due: "Paid" } : i));
        // Send payment confirmation email
        const replyTo = d.reply_to || action.email_from?.match(/<(.+)>/)?.[1] || action.email_from || "";
        const custRecord = (customers || []).find(c => c.name?.toLowerCase().includes(customerNameLower));
        const confirmEmail = custRecord?.email || inv.email || replyTo;
        if (confirmEmail && connection) {
          const paidAmt = fmtCurrency(parseFloat(inv.grossAmount || inv.amount || 0));
          const confirmBody = buildEmailHTML(brand, {
            heading: "PAYMENT RECEIVED",
            body: `<p style="font-size:15px;">Dear ${inv.customer},</p>
              <p style="color:#555;">Thank you for your payment of <strong>${paidAmt}</strong> for invoice ${inv.id}. This invoice is now marked as paid.</p>
              <p style="color:#555;font-size:13px;">If you need a receipt or have any questions, please don't hesitate to get in touch.</p>`,
          });
          const endpoint = connection.provider === "outlook" ? "/api/outlook/send" : "/api/gmail/send";
          await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: user.id, to: confirmEmail, subject: `Payment received — Invoice ${inv.id}`, body: confirmBody }),
          }).catch(err => console.error("Payment confirmation failed:", err.message));
        }
      }
      break;
    }
    case "accept_quote": {
      // Find matching quote by customer name or address
      const customerName = d.customer || "";
      const address = d.address || d.notes || "";
      const matchingQuote = (invoices || []).find(i =>
        i.isQuote &&
        (i.customer?.toLowerCase().includes(customerName.toLowerCase()) ||
         (address && (i.jobRef?.toLowerCase().includes(address.toLowerCase()) ||
          i.address?.toLowerCase().includes(address.toLowerCase()))))
      );

      if (matchingQuote) {
        // Convert quote to invoice — mirrors QuotesView.convertToInvoice
        // (the canonical path) so the same chain of effects fires regardless
        // of whether the user converted manually or via email approval.
        // Previously this branch only mutated React state and removed the
        // original quote from the list, which (a) raced with the setInvoices
        // wrapper into a delete-then-upsert that often lost the new invoice,
        // and (b) destroyed quote acceptance history.
        const newId = nextInvoiceId(invoices);
        const newInvoice = {
          ...matchingQuote,
          isQuote: false,
          id: newId,
          status: "sent",
          due: `Due in ${brand?.paymentTerms || 30} days`,
          portalToken: generatePortalToken(),
        };
        // Preserve the quote, mark it accepted (don't filter it out).
        setInvoices(prev => {
          const withQuoteAccepted = (prev || []).map(i =>
            i.id === matchingQuote.id ? { ...i, status: "accepted" } : i
          );
          return [newInvoice, ...withQuoteAccepted];
        });
        // Create the linking job_card so subsequent time/material/expense
        // entries against this customer attach to the right work record.
        if (user?.id) {
          const scopeOfWork = (matchingQuote.lineItems && matchingQuote.lineItems.length > 0)
            ? matchingQuote.lineItems.map(l => l.description || l.desc || "").filter(Boolean).join("\n")
            : (matchingQuote.description || matchingQuote.desc || "");
          await window._supabase.from("job_cards").insert({
            user_id: user.id,
            title: `${matchingQuote.id} — ${matchingQuote.customer}`,
            customer: matchingQuote.customer,
            address: matchingQuote.address || "",
            type: matchingQuote.type || "",
            status: "accepted",
            value: matchingQuote.amount || 0,
            quote_id: matchingQuote.id,
            invoice_id: newId,
            scope_of_work: scopeOfWork,
            notes: `Quote accepted via email on ${new Date().toLocaleDateString("en-GB")}`,
          }).then(({ error }) => { if (error) console.error("[accept_quote matched] job_card insert failed:", error.message); });
        }
      } else {
        // No matching quote — create a job_card so the work is at least
        // tracked. Goes into job_cards (Jobs tab), NOT jobs (Schedule),
        // because we don't have a date/time. Drops the old hardcoded
        // "Boiler Installation" fallback that misclassified non-plumbers.
        if (user?.id) {
          await window._supabase.from("job_cards").insert({
            user_id: user.id,
            title: customerName || "New job from email",
            customer: customerName || "Unknown",
            address: d.address || "",
            type: d.type || "",
            status: "accepted",
            value: 0,
            notes: `Quote accepted via email — no matching quote found in system. ${d.notes || ""}`.trim(),
          }).then(({ error }) => { if (error) console.error("[accept_quote unmatched] job_card insert failed:", error.message); });
        }
      }

      // Send reply email asking for booking date
      const replyTo = d.reply_to || action.email_from?.match(/<(.+)>/)?.[1] || action.email_from || "";
      if (replyTo && connection) {
        const endpoint = connection.provider === "outlook" ? "/api/outlook/send" : "/api/gmail/send";
        const jobDesc = d.address || d.type || "the work";
        const replyBody = `<p>Hi ${customerName || "there"},</p><p>Thank you for confirming you'd like to go ahead with ${jobDesc}. I'll get that booked in for you.</p><p>What date and time would suit you best? Please let me know a few options and I'll confirm which works.</p><p>Many thanks,<br>${brand?.tradingName || ""}${brand?.phone ? `<br>${brand.phone}` : ""}</p>`;
        await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.id, to: replyTo, subject: `Re: ${action.email_subject}`, body: replyBody }),
        }).catch(err => console.error("Reply failed:", err.message));
      }
      break;
    }
  }
}

// Learn from approvals — teaches the email classifier about the user's real
// suppliers, contractors, customers, and job types. Read by email-cron.js and
// email-check.js via the ai_context table.
export async function updateEmailAIContext(action, user) {
  const d = action.action_data || {};
  try {
    // Load existing context
    const { data: existing } = await window._supabase.from("ai_context").select("*").eq("user_id", user.id).single();
    const ctx = existing || { suppliers: [], contractors: [], customers: [], job_types: [] };

    // Add what we learned
    if (action.action_type === "add_materials" && d.supplier) {
      if (!ctx.suppliers.find(s => s.name?.toLowerCase() === d.supplier.toLowerCase())) {
        ctx.suppliers = [...(ctx.suppliers || []), { name: d.supplier, type: "materials", from: action.email_from?.match(/<(.+)>/)?.[1] || action.email_from }];
      }
    }
    if (action.action_type === "add_cis_statement" && d.contractor_name) {
      if (!ctx.contractors.find(c => c.name?.toLowerCase() === d.contractor_name.toLowerCase())) {
        ctx.contractors = [...(ctx.contractors || []), { name: d.contractor_name, type: "cis", from: action.email_from?.match(/<(.+)>/)?.[1] || action.email_from }];
      }
    }
    if ((action.action_type === "create_job" || action.action_type === "create_enquiry" || action.action_type === "accept_quote") && d.customer) {
      if (!ctx.customers.find(c => c.name?.toLowerCase() === d.customer.toLowerCase())) {
        ctx.customers = [...(ctx.customers || []), { name: d.customer, from: action.email_from?.match(/<(.+)>/)?.[1] || action.email_from }];
      }
    }
    if (action.action_type === "create_job" && d.type) {
      if (!ctx.job_types.find(t => t.toLowerCase() === d.type.toLowerCase())) {
        ctx.job_types = [...(ctx.job_types || []), d.type];
      }
    }

    // Upsert context
    await window._supabase.from("ai_context").upsert({
      user_id: user.id,
      ...ctx,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
  } catch (e) { console.error("AI context update failed:", e.message); }
}

// Learn from dismissals — writes an ai_feedback row that the email classifier
// prompts will surface as PAST MISTAKES TO AVOID on the next scan. The `reason`
// must be one of the IDs listed in App.jsx DISMISS_REASONS so the label map in
// email-cron.js and email-check.js can render it cleanly.
export async function logEmailFeedback(user, action, reason) {
  try {
    await window._supabase.from("ai_feedback").insert({
      user_id: user.id,
      email_id: action.email_id,
      email_from: action.email_from,
      email_subject: action.email_subject,
      action_suggested: action.action_type,
      reason: reason || "not_relevant",
    });
  } catch (e) { console.error("AI feedback log failed:", e.message); }
}

export function InboxView({ user, brand, jobs, setJobs, invoices, setInvoices, enquiries, setEnquiries, materials, setMaterials, customers, setCustomers, setLastAction, setContextHint, sendPush }) {
  // Theme-aware: bg/text/border tokens use the same CSS variables as global C,
  // so the Inbox tab follows light/dark mode. Accent colours stay as hex literals.
  const IC = { amber: C.amber, amberLight: "#fef3c766", green: C.green, red: C.red, blue: C.blue, muted: C.muted, border: C.border, bg2: C.surface, bg3: C.surfaceHigh, text: C.text };

  const [connection, setConnection] = useState(null);
  const [pendingActions, setPendingActions] = useState([]);
  const [recentActions, setRecentActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState({});
  const [tab, setTab] = useState("pending");
  const [disconnecting, setDisconnecting] = useState(false);
  const [feedbackAction, setFeedbackAction] = useState(null); // action awaiting dismiss reason
  // Phase 5b: filter + search for the Pending actions list
  const [actionFilter, setActionFilter] = useState("all"); // all | customer | money | admin
  const [actionSearch, setActionSearch] = useState("");

  const DISMISS_REASONS = [
    { id: "wrong_type", label: "Wrong action type" },
    { id: "not_relevant", label: "Not relevant" },
    { id: "wrong_customer", label: "Wrong customer" },
    { id: "already_done", label: "Already handled" },
    { id: "spam", label: "Spam / ignore always" },
  ];
  const [urlError, setUrlError] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get("email_error");
    if (err) { window.history.replaceState({}, "", window.location.pathname); return decodeURIComponent(err); }
    return null;
  });
  const [urlConnected, setUrlConnected] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("email_connected") || null;
  });

  // Voice dictation for compose
  const { recording, transcribing, toggle } = useWhisper((text) => {
    if (text) setComposeData(p => ({ ...p, body: p.body ? p.body + " " + text : text }));
  });

  // Email reader state
  const [threads, setThreads] = useState([]);
  const [selectedThread, setSelectedThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [composing, setComposing] = useState(false);
  const [composeData, setComposeData] = useState({ to: "", subject: "", body: "" });
  const [sending, setSending] = useState(false);

  const [checking, setChecking] = useState(false);

  useEffect(() => { if (user) { checkConnection(); loadActions(); } }, [user]);

  // Phase 5b: publish rich context hint when there are pending actions — the
  // floating mic + "Hey Trade PA" will pick this up and hand the AI a picture
  // of what's actually waiting for review.
  useEffect(() => {
    if (!setContextHint) return;
    if (pendingActions.length === 0) {
      setContextHint("Inbox Actions: all caught up");
    } else {
      const top = pendingActions.slice(0, 5).map(a => `${a.action_type?.replace(/_/g, " ") || "action"} from ${fromName(a.email_from)}`);
      const extra = pendingActions.length > 5 ? ` (+${pendingActions.length - 5} more)` : "";
      setContextHint(`Inbox Actions: ${pendingActions.length} pending — ${top.join(", ")}${extra}`);
    }
    return () => { if (setContextHint) setContextHint(null); };
  }, [pendingActions, setContextHint]);

  // Urgency scoring — higher = more important. Used for sort order on the pending list.
  // Customer-facing actions beat money actions beat admin actions.
  const URGENCY = { create_job: 5, accept_quote: 5, create_enquiry: 4, reschedule_job: 4, cancel_job: 4, mark_invoice_paid: 3, save_customer: 2, update_job: 2, add_materials: 1, add_cis_statement: 1 };
  const urgencyOf = (a) => URGENCY[a.action_type] || 1;
  const CATEGORY = { create_job: "customer", accept_quote: "customer", create_enquiry: "customer", save_customer: "customer", reschedule_job: "customer", cancel_job: "customer",
                     mark_invoice_paid: "money",
                     add_materials: "admin", add_cis_statement: "admin", update_job: "admin" };
  const categoryOf = (a) => CATEGORY[a.action_type] || "admin";

  async function checkConnection() {
    try {
      const { data } = await window._supabase.from("email_connections").select("provider, email, last_checked").eq("user_id", user.id);
      if (data?.length) { setConnection(data[0]); loadInbox(data[0]); }
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function loadActions() {
    try {
      const [pendRes, doneRes] = await Promise.all([
        fetch(`/api/email/actions?userId=${user.id}&status=pending`),
        fetch(`/api/email/actions?userId=${user.id}&status=approved`),
      ]);
      const [pend, done] = await Promise.all([pendRes.json(), doneRes.json()]);
      setPendingActions(pend.actions || []);
      setRecentActions(done.actions || []);
    } catch (e) { console.error(e); }
  }

  const [checkResult, setCheckResult] = useState(null);

  async function runEmailCheck() {
    setChecking(true);
    setCheckResult(null);
    try {
      const res = await fetch("/api/email-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      await loadActions();
      const { data: connData } = await window._supabase.from("email_connections").select("provider, email, last_checked").eq("user_id", user.id);
      if (connData?.length) setConnection(connData[0]);
      setCheckResult({ emails: data.emailsChecked || 0, actions: data.actionsCreated || 0, debug: data.debug || [] });
      setTimeout(() => setCheckResult(null), 10000);
    } catch (e) {
      console.error("Check failed:", e.message);
      setCheckResult({ error: e.message });
      setTimeout(() => setCheckResult(null), 6000);
    }
    setChecking(false);
  }

  async function loadInbox(conn) {
    const c = conn || connection;
    if (!c) return;
    setInboxLoading(true);
    try {
      const res = await fetch(`/api/${c.provider === "outlook" ? "outlook" : "gmail"}/inbox?userId=${user.id}`);
      const data = await res.json();
      setThreads(data.threads || []);
    } catch (e) { console.error(e); }
    setInboxLoading(false);
  }

  async function openThread(thread) {
    setSelectedThread(thread);
    setThreadLoading(true);
    setMessages([]);
    try {
      const isOutlook = connection?.provider === "outlook";
      const param = isOutlook ? `messageId=${thread.messageId || thread.id}` : `threadId=${thread.id}`;
      const res = await fetch(`/api/${isOutlook ? "outlook" : "gmail"}/thread?userId=${user.id}&${param}`);
      const data = await res.json();
      setMessages(data.messages || []);
      setThreads(prev => prev.map(t => t.id === thread.id ? { ...t, unread: false } : t));
    } catch (e) { console.error(e); }
    setThreadLoading(false);
  }

  async function sendEmail() {
    if (!composeData.to || !composeData.subject) return alert("To and Subject required");
    setSending(true);
    try {
      const isOutlook = connection?.provider === "outlook";
      await fetch(`/api/${isOutlook ? "outlook" : "gmail"}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, ...composeData, body: `<p>${composeData.body.replace(/\n/g, "<br>")}</p>` }),
      });
      setComposing(false);
      setComposeData({ to: "", subject: "", body: "" });
      loadInbox();
    } catch (e) { console.error(e); }
    setSending(false);
  }

  async function disconnect() {
    if (!confirm("Disconnect this email account? You can reconnect at any time.")) return;
    setDisconnecting(true);
    try {
      await window._supabase.from("email_connections").delete().eq("user_id", user.id);
      setConnection(null);
      setThreads([]);
      setSelectedThread(null);
      setMessages([]);
    } catch (e) { console.error(e); }
    setDisconnecting(false);
  }

  async function approve(action) {
    setProcessing(p => ({ ...p, [action.id]: true }));
    try {
      // sendPush is now threaded through as a prop, so the `📩 New Enquiry`
      // push on create_enquiry approvals actually fires. The old in-component
      // executeAction referenced `sendPush` directly without it being in scope,
      // so that push was silently ReferenceError'ing and being swallowed by the
      // try/catch — users weren't getting any enquiry notifications from the
      // Inbox tab. This closes that gap.
      await executeEmailAction(action, {
        user, brand, connection, customers, invoices,
        setCustomers, setJobs, setInvoices, setMaterials, setEnquiries,
        sendPush,
      });
      await fetch("/api/email/actions/approve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actionId: action.id }) });
      setPendingActions(prev => prev.filter(a => a.id !== action.id));
      setRecentActions(prev => [{ ...action, status: "approved" }, ...prev]);
      // Update AI context with what was learned from this approval
      await updateEmailAIContext(action, user);
      // Notify other surfaces (AI home card, etc.) that pending list changed
      window.dispatchEvent(new CustomEvent("trade-pa-inbox-refreshed"));
    } catch (e) { console.error(e); }
    setProcessing(p => ({ ...p, [action.id]: false }));
  }

  // Show reason picker before dismissing
  function startReject(action) {
    setFeedbackAction(action);
  }

  async function confirmReject(action, reason) {
    setFeedbackAction(null);
    setProcessing(p => ({ ...p, [action.id]: true }));
    try {
      // Save feedback for AI learning via shared helper (voice path uses same helper)
      await logEmailFeedback(user, action, reason);
      await fetch("/api/email/actions/reject", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actionId: action.id }) });
      setPendingActions(prev => prev.filter(a => a.id !== action.id));
      // Notify other surfaces that pending list changed
      window.dispatchEvent(new CustomEvent("trade-pa-inbox-refreshed"));
    } catch (e) { console.error(e); }
    setProcessing(p => ({ ...p, [action.id]: false }));
  }


  function actionIcon(type) { return { create_job: "📅", create_enquiry: "📩", mark_invoice_paid: "✅", update_job: "🔧", add_materials: "🔧", save_customer: "👤", accept_quote: "🤝", add_cis_statement: "🏗", reschedule_job: "🔄", cancel_job: "❌" }[type] || "⚡"; }
  function actionColor(type) { return { create_job: IC.green, create_enquiry: IC.blue, mark_invoice_paid: IC.green, update_job: IC.amber, add_materials: IC.amber, save_customer: "#8b5cf6", accept_quote: IC.green, add_cis_statement: IC.blue, reschedule_job: IC.blue, cancel_job: IC.red }[type] || IC.amber; }
  function formatTime(ts) { if (!ts) return ""; const d = new Date(ts), diff = Date.now() - d; if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`; if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`; return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }); }
  function fromName(from) { if (!from) return "Unknown"; const m = from.match(/^(.+?)\s*</); return m ? m[1].replace(/"/g, "") : from.split("@")[0]; }

  const IS = {
    card: { background: IC.bg2, border: `1px solid ${IC.border}`, borderRadius: 12, padding: 16, marginBottom: 12 },
    btn: (v) => ({ padding: "7px 14px", borderRadius: 10, fontSize: 11, fontWeight: 600, cursor: "pointer", border: v === "ghost" ? `1px solid ${IC.border}` : "none", fontFamily: "'DM Mono',monospace", background: v === "approve" ? IC.green : v === "amber" ? IC.amber : v === "red" ? "#7f1d1d" : v === "ghost" ? "transparent" : IC.bg3, color: v === "approve" ? "#fff" : v === "amber" ? "#000" : v === "red" ? IC.red : IC.text }),
    tab: (a) => ({ padding: "6px 14px", borderRadius: 10, border: "none", cursor: "pointer", fontSize: 11, fontWeight: a ? 700 : 400, fontFamily: "'DM Mono',monospace", background: a ? IC.amber : "transparent", color: a ? "#000" : IC.muted }),
    input: { width: "100%", padding: "7px 10px", borderRadius: 10, border: `1px solid ${IC.border}`, background: IC.bg3, color: IC.text, fontSize: 12, marginBottom: 8, boxSizing: "border-box", fontFamily: "'DM Mono',monospace" },
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: IC.muted, fontFamily: "'DM Mono',monospace" }}>Loading...</div>;

  // Show error from OAuth callback
  if (urlError) {
    return (
      <div style={{ fontFamily: "'DM Mono',monospace", display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ background: "#7f1d1d", border: "1px solid #ef4444", borderRadius: 10, padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#ef4444", marginBottom: 8 }}>⚠ Email connection failed</div>
          <div style={{ fontSize: 12, color: "#fca5a5", marginBottom: 16, lineHeight: 1.6, wordBreak: "break-all" }}>{urlError}</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={IS.btn("amber")} onClick={() => { window.location.href = `/api/auth/gmail/connect?userId=${user.id}`; }}>Try Gmail instead</button>
            <button style={IS.btn("default")} onClick={() => { window.location.href = `/api/auth/outlook/connect?userId=${user.id}`; }}>Retry Outlook</button>
            <button style={IS.btn("ghost")} onClick={() => setUrlError(null)}>Dismiss</button>
          </div>
        </div>
      </div>
    );
  }

  if (!connection) {
    return (
      <div style={{ padding: 48, textAlign: "center", fontFamily: "'DM Mono',monospace" }}>
        <div style={{ fontSize: 36, marginBottom: 16 }}>✉</div>
        <div style={{ fontSize: 17, fontWeight: 700, color: IC.text, marginBottom: 8 }}>Connect your inbox</div>
        <div style={{ fontSize: 13, color: IC.muted, maxWidth: 380, margin: "0 auto 28px", lineHeight: 1.6 }}>Link your email and Claude will automatically review incoming emails every hour — suggesting jobs, enquiries, material orders and more for your approval.</div>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 12 }}>
          <button style={{ ...IS.btn("default"), padding: "10px 20px", fontSize: 13 }} onClick={() => { window.location.href = `/api/auth/gmail/connect?userId=${user.id}`; }}>
            <span style={{ color: "#ef4444", fontWeight: 700 }}>G</span> Connect Gmail
          </button>
          <button style={{ ...IS.btn("default"), padding: "10px 20px", fontSize: 13 }} onClick={() => { window.location.href = `/api/auth/outlook/connect?userId=${user.id}`; }}>
            <span style={{ color: "#3b82f6", fontWeight: 700 }}>✉</span> Connect Outlook
          </button>
        </div>
        <div style={{ fontSize: 11, color: IC.muted }}>Works with Gmail, Google Workspace, Outlook and Microsoft 365</div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "'DM Mono',monospace", display: "flex", flexDirection: "column", gap: 12 }}>

      {/* Status bar */}
      <div style={{ ...IS.card, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: IC.green, flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: IC.text }}>{connection.email}</div>
            <div style={{ fontSize: 11, color: IC.muted }}>{connection.provider} · AI checks every hour · {connection.last_checked ? `Last checked ${formatTime(connection.last_checked)}` : "Not checked yet"}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {pendingActions.length > 0 && <div style={{ background: IC.red, color: "#fff", borderRadius: 10, padding: "2px 8px", fontSize: 10, fontWeight: 700 }}>{pendingActions.length} pending</div>}
          <button style={IS.btn("ghost")} onClick={() => { setConnection(null); window.location.href = `/api/auth/gmail/connect?userId=${user.id}`; }} title="Switch to Gmail">
            <span style={{ color: "#ef4444", fontWeight: 700, fontSize: 12 }}>G</span>
          </button>
          <button style={IS.btn("ghost")} onClick={() => { setConnection(null); window.location.href = `/api/auth/outlook/connect?userId=${user.id}`; }} title="Switch to Outlook">
            <span style={{ color: "#3b82f6", fontWeight: 700, fontSize: 12 }}>✉</span>
          </button>
          <button style={{ ...IS.btn("red"), fontSize: 10, padding: "5px 10px" }} onClick={disconnect} disabled={disconnecting}>
            {disconnecting ? "..." : "Disconnect"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4 }}>
        <button style={IS.tab(tab === "pending")} onClick={() => setTab("pending")}>AI Actions {pendingActions.length > 0 && `(${pendingActions.length})`}</button>
        <button style={IS.tab(tab === "inbox")} onClick={() => setTab("inbox")}>Inbox</button>
        <button style={IS.tab(tab === "recent")} onClick={() => setTab("recent")}>History</button>
      </div>

      {/* Check result banner */}
      {checkResult && (
        <div style={{ padding: "10px 14px", borderRadius: 8, fontSize: 12,
          background: checkResult.error ? "#7f1d1d" : checkResult.actions > 0 ? "#064e3b" : "#1a1a1a",
          border: `1px solid ${checkResult.error ? "#ef4444" : checkResult.actions > 0 ? "#10b981" : "#2a2a2a"}`,
          color: checkResult.error ? "#fca5a5" : checkResult.actions > 0 ? "#6ee7b7" : "#6b7280" }}>
          <div style={{ fontWeight: 600, marginBottom: checkResult.debug?.length ? 8 : 0 }}>
            {checkResult.error
              ? `⚠ Check failed: ${checkResult.error}`
              : checkResult.actions > 0
                ? `✓ Checked ${checkResult.emails} emails — found ${checkResult.actions} new action${checkResult.actions !== 1 ? "s" : ""}`
                : `✓ Checked ${checkResult.emails} emails — no new actions`
            }
          </div>
          {checkResult.debug?.map((line, i) => (
            <div key={i} style={{ fontSize: 11, opacity: 0.8, marginTop: 3 }}>{line}</div>
          ))}
        </div>
      )}

      {/* ── AI Actions tab ── */}
      {tab === "pending" && (() => {
        // Filter + search + urgency sort (in render scope so it recomputes on each render)
        const aLower = actionSearch.trim().toLowerCase();
        const visibleActions = pendingActions.filter(a => {
          if (actionFilter !== "all" && categoryOf(a) !== actionFilter) return false;
          if (!aLower) return true;
          return (a.action_description || "").toLowerCase().includes(aLower)
              || (a.email_from || "").toLowerCase().includes(aLower)
              || (a.email_subject || "").toLowerCase().includes(aLower)
              || (a.email_snippet || "").toLowerCase().includes(aLower);
        }).sort((a, b) => {
          const u = urgencyOf(b) - urgencyOf(a);
          if (u !== 0) return u;
          return new Date(b.created_at || 0) - new Date(a.created_at || 0);
        });
        const custCount = pendingActions.filter(a => categoryOf(a) === "customer").length;
        const moneyCount = pendingActions.filter(a => categoryOf(a) === "money").length;
        const adminCount = pendingActions.filter(a => categoryOf(a) === "admin").length;

        const chipStyle = (active, tint) => ({
          padding: "5px 11px", borderRadius: 14, fontSize: 10, fontWeight: 700,
          background: active ? (tint || IC.text) : "transparent",
          color: active ? "#000" : IC.muted,
          border: `1px solid ${active ? (tint || IC.text) : IC.border}`,
          cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
          fontFamily: "'DM Mono',monospace", letterSpacing: "0.04em",
        });

        return (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 8, flexWrap: "wrap" }}>
            <div style={{ fontSize: 11, color: IC.muted }}>Claude reviews your inbox every hour and suggests actions for your approval.</div>
            <button style={IS.btn("amber")} onClick={runEmailCheck} disabled={checking}>
              {checking ? "⏳ Checking..." : "↻ Check Now"}
            </button>
          </div>

          {/* Search + filter chips — visible only when there are pending actions */}
          {pendingActions.length > 0 && (
            <>
              <input
                type="text"
                value={actionSearch}
                onChange={e => setActionSearch(e.target.value)}
                placeholder="Search actions, senders, subjects…"
                style={IS.input}
              />
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                <button onClick={() => setActionFilter("all")} style={chipStyle(actionFilter === "all")}>All {pendingActions.length}</button>
                <button onClick={() => setActionFilter("customer")} style={chipStyle(actionFilter === "customer", IC.green)}>Customer {custCount}</button>
                <button onClick={() => setActionFilter("money")} style={chipStyle(actionFilter === "money", IC.blue)}>Money {moneyCount}</button>
                <button onClick={() => setActionFilter("admin")} style={chipStyle(actionFilter === "admin", IC.muted)}>Admin {adminCount}</button>
              </div>
            </>
          )}

          {pendingActions.length === 0 ? (
            <div style={{ ...IS.card, textAlign: "center", padding: 40 }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>✓</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: IC.text, marginBottom: 6 }}>All caught up</div>
              <div style={{ fontSize: 12, color: IC.muted, lineHeight: 1.6 }}>No pending actions. Claude will check your inbox again on the next hour and suggest actions for any new emails.</div>
            </div>
          ) : visibleActions.length === 0 ? (
            <div style={{ ...IS.card, textAlign: "center", padding: 24, color: IC.muted, fontSize: 12 }}>
              {actionSearch ? `No actions match "${actionSearch}".` : `No ${actionFilter} actions right now.`}
            </div>
          ) : visibleActions.map(action => (
            <div key={action.id} style={{ ...IS.card, borderLeft: `3px solid ${actionColor(action.action_type)}` }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
                <div style={{ fontSize: 22, flexShrink: 0 }}>{actionIcon(action.action_type)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: IC.text, marginBottom: 4 }}>{action.action_description}</div>
                  <div style={{ fontSize: 11, color: IC.muted, marginBottom: 2 }}>From: {action.email_from}</div>
                  <div style={{ fontSize: 11, color: IC.muted, marginBottom: 6 }}>Re: {action.email_subject}</div>
                  <div style={{ fontSize: 11, color: IC.muted, background: IC.bg3, padding: "6px 10px", borderRadius: 10, fontStyle: "italic", lineHeight: 1.5 }}>"{action.email_snippet?.slice(0, 120)}..."</div>
                </div>
                <div style={{ fontSize: 10, color: IC.muted, flexShrink: 0 }}>{formatTime(action.created_at)}</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button style={IS.btn("approve")} disabled={processing[action.id]} onClick={() => approve(action)}>{processing[action.id] ? "..." : "✓ Approve"}</button>
                <button style={IS.btn("default")} disabled={processing[action.id]} onClick={() => startReject(action)}>Dismiss</button>
              </div>
            </div>
          ))}
        </div>
        );
      })()}

      {/* ── Inbox tab ── */}
      {tab === "inbox" && (
        <div>
          {/* Thread list - full width on mobile */}
          <div style={{ background: IC.bg2, border: `1px solid ${IC.border}`, borderRadius: 10, overflow: "hidden" }}>
            <div style={{ padding: "10px 14px", borderBottom: `1px solid ${IC.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: IC.muted, letterSpacing: "0.08em", textTransform: "uppercase" }}>Inbox</div>
              <div style={{ display: "flex", gap: 6 }}>
                <button style={IS.btn("default")} onClick={() => loadInbox()} title="Refresh">↻</button>
                <button style={IS.btn("amber")} onClick={() => setComposing(true)}>+ New</button>
              </div>
            </div>
            {inboxLoading && <div style={{ padding: 20, textAlign: "center", color: IC.muted, fontSize: 12 }}>Loading...</div>}
            {!inboxLoading && threads.length === 0 && <div style={{ padding: 20, textAlign: "center", color: IC.muted, fontSize: 12 }}>No emails found</div>}
            {threads.map(t => (
              <div key={t.id + (t.messageId || "")} onClick={() => openThread(t)}
                style={{ padding: "12px 14px", cursor: "pointer", borderBottom: `1px solid ${IC.border}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                  <div style={{ fontSize: 13, fontWeight: t.unread ? 700 : 500, color: IC.text }}>{fromName(t.from)}</div>
                  <div style={{ fontSize: 10, color: IC.muted, flexShrink: 0, marginLeft: 8 }}>{formatTime(t.date)}</div>
                </div>
                <div style={{ fontSize: 12, color: t.unread ? IC.amber : IC.textDim, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 2 }}>
                  {t.unread && <span style={{ display: "inline-block", width: 5, height: 5, borderRadius: "50%", background: IC.amber, marginRight: 5, verticalAlign: "middle" }} />}
                  {t.subject}{t.hasAttachment && " 📎"}
                </div>
                <div style={{ fontSize: 11, color: IC.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.snippet}</div>
              </div>
            ))}
          </div>

          {/* ── Email read modal ── */}
          {selectedThread && (
            <div style={{ position: "fixed", inset: 0, background: "#000c", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 300, padding: 0, paddingTop: "env(safe-area-inset-top, 0px)" }}
              onClick={() => setSelectedThread(null)}>
              <div onClick={e => e.stopPropagation()}
                style={{ background: IC.bg2, width: "100%", maxWidth: 600, height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                {/* Modal header */}
                <div style={{ padding: "14px 16px", borderBottom: `1px solid ${IC.border}`, background: IC.bg2, flexShrink: 0 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", paddingBottom: 10, borderBottom: `1px solid ${C.border}`, marginBottom: 10 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: IC.text, flex: 1, marginRight: 12, lineHeight: 1.3 }}>{selectedThread.subject}</div>
                    <button aria-label="Close" onClick={() => setSelectedThread(null)} style={{ background: "none", border: "none", color: IC.muted, cursor: "pointer", padding: 0, flexShrink: 0 }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button style={IS.btn("amber")} onClick={() => {
                      const last = messages[messages.length - 1];
                      setSelectedThread(null);
                      setComposing(true);
                      setComposeData({ to: last?.from?.match(/<(.+)>/)?.[1] || last?.from || "", subject: `Re: ${selectedThread.subject}`, body: "" });
                    }}>↩ Reply</button>
                    <button style={IS.btn("default")} onClick={() => {
                      setSelectedThread(null);
                      setComposing(true);
                      setComposeData({ to: "", subject: `Fwd: ${selectedThread.subject}`, body: "" });
                    }}>→ Forward</button>
                  </div>
                </div>
                {/* Messages */}
                <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
                  {threadLoading && <div style={{ color: IC.muted, fontSize: 12, textAlign: "center", padding: 20 }}>Loading...</div>}
                  {messages.map(msg => (
                    <div key={msg.id} style={{ background: IC.bg3, borderRadius: 10, padding: 16, marginBottom: 12, border: `1px solid ${IC.border}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: IC.text }}>{fromName(msg.from)}</div>
                          <div style={{ fontSize: 11, color: IC.muted }}>to {msg.to}</div>
                        </div>
                        <div style={{ fontSize: 11, color: IC.muted, flexShrink: 0, marginLeft: 8 }}>{formatTime(msg.date)}</div>
                      </div>
                      <div style={{ borderTop: `1px solid ${IC.border}`, paddingTop: 12, fontSize: 14, color: IC.text, lineHeight: 1.7 }}>
                        {msg.isHtml
                          ? <div style={{ color: IC.text }} dangerouslySetInnerHTML={{ __html: msg.body }} />
                          : <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", margin: 0, fontSize: 14 }}>{msg.body}</pre>
                        }
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Compose modal ── */}
          {composing && (
            <div style={{ position: "fixed", inset: 0, background: "#000c", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 300, paddingTop: "env(safe-area-inset-top, 0px)" }}>
              <div style={{ background: IC.bg2, width: "100%", maxWidth: 600, height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                {/* Compose header */}
                <div style={{ padding: "14px 16px", borderBottom: `1px solid ${IC.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: IC.text }}>New Email</div>
                  <button aria-label="Close" onClick={() => { setComposing(false); setComposeData({ to: "", subject: "", body: "" }); }} style={{ background: "none", border: "none", color: IC.muted, cursor: "pointer" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
                </div>
                {/* Compose body */}
                <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 11, color: IC.muted, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>To</label>
                    <input style={IS.input} placeholder="customer@email.com" value={composeData.to} onChange={e => setComposeData(p => ({ ...p, to: e.target.value }))} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: IC.muted, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Subject</label>
                    <input style={IS.input} placeholder="Invoice #INV-042 from Dave's Plumbing" value={composeData.subject} onChange={e => setComposeData(p => ({ ...p, subject: e.target.value }))} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                      <label style={{ fontSize: 11, color: IC.muted, letterSpacing: "0.06em", textTransform: "uppercase" }}>Message</label>
                      <button
                        onClick={() => { abortSpeech(); recording ? stopRecording() : startRecording(true); }}
                        style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 20, border: "none", cursor: "pointer", fontFamily: "'DM Mono',monospace", fontSize: 11, fontWeight: 700, background: recording ? IC.red : IC.amber, color: recording ? "#fff" : "#000" }}>
                        {transcribing ? "⏳ Transcribing..." : recording ? "⏹ Stop" : "🎙 Dictate"}
                      </button>
                    </div>
                    <textarea
                      style={{ ...IS.input, minHeight: 200, resize: "none", flex: 1 }}
                      placeholder="Type your message here, or tap Dictate to speak it..."
                      value={composeData.body}
                      onChange={e => setComposeData(p => ({ ...p, body: e.target.value }))}
                    />
                    {recording && <div style={{ fontSize: 11, color: IC.red, marginTop: 6, textAlign: "center" }}>🔴 Recording... tap Stop when done</div>}
                  </div>
                </div>
                {/* Compose footer */}
                <div style={{ padding: "12px 16px", borderTop: `1px solid ${IC.border}`, flexShrink: 0 }}>
                  <button style={{ ...IS.btn("amber"), width: "100%", justifyContent: "center", padding: "12px", fontSize: 13 }} disabled={sending || !composeData.to || !composeData.subject} onClick={sendEmail}>
                    {sending ? "Sending..." : "Send Email →"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── History tab ── */}
      {tab === "recent" && (
        <div>
          {recentActions.length === 0
            ? <div style={{ ...IS.card, textAlign: "center", padding: 32, color: IC.muted, fontSize: 13 }}>No history yet.</div>
            : recentActions.map(action => (
              <div key={action.id} style={{ ...IS.card, opacity: 0.8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ fontSize: 18 }}>{actionIcon(action.action_type)}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: IC.text }}>{action.action_description}</div>
                    <div style={{ fontSize: 11, color: IC.muted }}>{action.email_from} · {formatTime(action.processed_at)}</div>
                  </div>
                  <div style={{ fontSize: 10, color: IC.green, fontWeight: 700 }}>✓ Done</div>
                </div>
              </div>
            ))
          }
        </div>
      )}

      {/* ── Dismiss reason modal ── */}
      {feedbackAction && (
        <div style={{ position: "fixed", inset: 0, background: "#000d", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 400, padding: 24 }}>
          <div style={{ background: IC.bg2, border: `1px solid ${IC.border}`, borderRadius: 12, padding: 24, maxWidth: 340, width: "100%", fontFamily: "'DM Mono',monospace" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: IC.text, marginBottom: 6 }}>Why dismiss this?</div>
            <div style={{ fontSize: 12, color: IC.muted, marginBottom: 20, lineHeight: 1.5 }}>
              Your feedback helps the AI improve — it won't make this mistake again.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {DISMISS_REASONS.map(r => (
                <button key={r.id} onClick={() => confirmReject(feedbackAction, r.id)}
                  style={{ padding: "10px 14px", borderRadius: 8, border: `1px solid ${IC.border}`, background: IC.bg3, color: IC.text, cursor: "pointer", fontSize: 12, fontFamily: "'DM Mono',monospace", textAlign: "left", fontWeight: 500 }}>
                  {r.label}
                </button>
              ))}
            </div>
            <button onClick={() => setFeedbackAction(null)} style={{ marginTop: 12, width: "100%", padding: "8px", borderRadius: 8, border: "none", background: "transparent", color: IC.muted, cursor: "pointer", fontSize: 11, fontFamily: "'DM Mono',monospace" }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Enquiries Tab ────────────────────────────────────────────────────────────
