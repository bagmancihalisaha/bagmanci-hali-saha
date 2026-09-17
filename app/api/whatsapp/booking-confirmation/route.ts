import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseAdmin";
import { sendBookingConfirmationMessage } from "@/lib/whatsapp";

export async function POST(req: Request) {
  try {
    const { bookingId } = await req.json();

    if (!bookingId) {
      return NextResponse.json({ error: "bookingId gerekli." }, { status: 400 });
    }

    const { data: booking, error } = await getSupabaseServerClient()
      .from("booking_requests")
      .select("customer_name, phone, booking_date, booking_time, duration_hours, total_amount, payment_status")
      .eq("id", bookingId)
      .maybeSingle();

    if (error) throw error;
    if (!booking) {
      return NextResponse.json({ error: "Rezervasyon bulunamadı." }, { status: 404 });
    }

    const result = await sendBookingConfirmationMessage(booking);
    if (!result.ok) {
      const metaError = result.data?.error;
      const errorMessage = metaError?.message || "WhatsApp rezervasyon mesajı gönderilemedi.";
      const templatePending =
        String(metaError?.code || "") === "132001" ||
        errorMessage.toLowerCase().includes("does not exist in the translation");
      return NextResponse.json(
        {
          error: templatePending
            ? "rezervasyon_onay şablonu Meta tarafından henüz onaylanmamış. WhatsApp Manager'da şablon onaylandıktan sonra tekrar deneyin."
            : errorMessage,
          details: result.data,
        },
        { status: result.status },
      );
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Rezervasyon mesajı gönderilemedi." },
      { status: 500 },
    );
  }
}
