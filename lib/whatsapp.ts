/**
 * Meta WhatsApp Cloud API Helper
 */

const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const API_VERSION = process.env.WHATSAPP_API_VERSION || "v25.0";
const BOOKING_TEMPLATE_LANGUAGE =
  process.env.WHATSAPP_BOOKING_TEMPLATE_LANGUAGE ||
  process.env.WHATSAPP_TEMPLATE_LANGUAGE ||
  "tr";

export interface SendTemplateOptions {
  to: string; // Telefon numarası (örn: "905324341268")
  templateName?: string;
  languageCode?: string;
  components?: WhatsAppTemplateComponent[];
}

export interface SendTextMessageOptions {
  to: string;
  text: string;
}

export type WhatsAppTemplateComponent = {
  type: "body" | "button" | "header";
  sub_type?: string;
  index?: string;
  parameters: { type: "text"; text: string }[];
};

type WhatsAppResponseData = {
  error?: {
    message?: string;
    code?: number;
    error_subcode?: number;
    type?: string;
    fbtrace_id?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
} | null;

export type BookingConfirmation = {
  customer_name: string;
  phone: string;
  booking_date: string;
  booking_time: string;
  duration_hours?: number;
  total_amount?: number;
  paid_amount?: number;
  deposit_amount?: number;
  payment_status?: string;
};

const statusLabels: Record<string, string> = {
  paid: "Tamamı ödendi",
  approved: "Onaylandı",
  deposit: "Kapora alındı",
  proof_submitted: "Dekont alındı",
  unpaid: "Maç sonu ödeme",
  pending: "Onay bekliyor",
  rejected: "Reddedildi",
};

function missingConfigResult(): {
  ok: false;
  status: number;
  data: WhatsAppResponseData;
} {
  return {
    ok: false,
    status: 500,
    data: {
      error: {
        message:
          "WhatsApp ortam değişkenleri eksik: WHATSAPP_PHONE_NUMBER_ID ve WHATSAPP_ACCESS_TOKEN gerekli.",
      },
    },
  };
}

/**
 * WhatsApp Şablon Mesajı Gönder (Örn: Test şablonu veya Rezervasyon Onayı)
 */
export async function sendWhatsAppTemplateMessage({
  to,
  templateName = "3p_direct_integration_test_template",
  languageCode = "en_US",
  components,
}: SendTemplateOptions) {
  if (!WHATSAPP_PHONE_NUMBER_ID || !WHATSAPP_ACCESS_TOKEN) {
    return missingConfigResult();
  }

  const formattedPhone = formatPhoneNumber(to);
  const url = `https://graph.facebook.com/${API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: formattedPhone,
      type: "template",
      template: {
        name: templateName,
        language: {
          code: languageCode,
        },
        ...(components?.length ? { components } : {}),
      },
    }),
  });

  const responseText = await response.text();
  let data: WhatsAppResponseData;
  try {
    data = responseText ? JSON.parse(responseText) : null;
  } catch {
    data = { error: { message: responseText || "Meta boş yanıt döndürdü." } };
  }
  return { ok: response.ok, status: response.status, data };
}

/**
 * WhatsApp Serbest Metin Mesajı Gönder (Müşteri son 24 saatte mesaj yazdıysa geçerlidir)
 */
export async function sendWhatsAppTextMessage({ to, text }: SendTextMessageOptions) {
  if (!WHATSAPP_PHONE_NUMBER_ID || !WHATSAPP_ACCESS_TOKEN) {
    return missingConfigResult();
  }

  const formattedPhone = formatPhoneNumber(to);
  const url = `https://graph.facebook.com/${API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: formattedPhone,
      type: "text",
      text: {
        preview_url: false,
        body: text,
      },
    }),
  });

  const responseText = await response.text();
  let data: WhatsAppResponseData;
  try {
    data = responseText ? JSON.parse(responseText) : null;
  } catch {
    data = { error: { message: responseText || "Meta boş yanıt döndürdü." } };
  }
  return { ok: response.ok, status: response.status, data };
}

function getBookingTemplateParameters(
  booking: BookingConfirmation,
  reminder: boolean,
) {
  const duration = Number(booking.duration_hours || 1);
  const bookingDate = new Date(`${booking.booking_date}T12:00:00`);
  const formattedDate = new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(bookingDate);
  const weekday = new Intl.DateTimeFormat("tr-TR", {
    weekday: "long",
  }).format(bookingDate);
  const [startHour, startMinute] = booking.booking_time.split(":").map(Number);
  const endMinutes = startHour * 60 + startMinute + duration * 60;
  const endHour = Math.floor(endMinutes / 60) % 24;
  const endMinute = endMinutes % 60;
  const timeRange = `${booking.booking_time} - ${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`;
  const total = Math.max(0, Number(booking.total_amount || 0));
  const reportedPaid = Math.max(
    0,
    Number(booking.paid_amount || 0) ||
      (booking.payment_status === "paid" ? total : 0) ||
      (["deposit", "proof_submitted"].includes(booking.payment_status || "")
        ? Number(booking.deposit_amount || 0)
        : 0),
  );
  const paid = Math.min(total, reportedPaid);
  const remaining = Math.max(0, total - paid);
  const currency = (amount: number) =>
    `₺${new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 }).format(amount)}`;
  const paymentText = paid >= total && total > 0
    ? "Ödeme Durumu: Tamamı Ödendi (Borç Yoktur)"
    : paid > 0 || ["deposit", "proof_submitted"].includes(booking.payment_status || "")
      ? `Ödeme Durumu: Kapora Alındı (Kalan Bakiye: ${currency(remaining)})`
      : `Ödeme Durumu: Ödenmedi (Kalan Tutar: ${currency(remaining)} - Lütfen maçtan önce tamamlayınız)`;

  return reminder
    ? [booking.customer_name, formattedDate, timeRange, paymentText]
    : [booking.customer_name, formattedDate, weekday, timeRange, paymentText];
}

async function sendBookingTemplate(
  booking: BookingConfirmation,
  templateName: string,
  reminder: boolean,
) {
  const components = [{
    type: "body" as const,
    parameters: getBookingTemplateParameters(booking, reminder).map((text) => ({
      type: "text" as const,
      text,
    })),
  }];
  const languages = [
    BOOKING_TEMPLATE_LANGUAGE,
    "tr_TR",
    "tr",
    "en_US",
  ].filter((language, index, values) => values.indexOf(language) === index);
  let result = await sendWhatsAppTemplateMessage({
    to: booking.phone,
    templateName,
    languageCode: languages[0],
    components,
  });
  for (const languageCode of languages.slice(1)) {
    if (result.ok) break;
    result = await sendWhatsAppTemplateMessage({
      to: booking.phone,
      templateName,
      languageCode,
      components,
    });
  }
  return result;
}

export function sendBookingCreatedMessage(booking: BookingConfirmation) {
  return sendBookingTemplate(booking, "rezervasyon_onay", false);
}

export function sendBookingReminderMessage(booking: BookingConfirmation) {
  return sendBookingTemplate(booking, "rezervasyon_onay_hatirlatma", true);
}

export async function sendPhoneVerificationCode(to: string, code: string) {
  const templateName =
    process.env.WHATSAPP_OTP_TEMPLATE_NAME?.trim() || "telefon_dogrulama";
  const languages = [
    process.env.WHATSAPP_OTP_TEMPLATE_LANGUAGE ||
      process.env.WHATSAPP_TEMPLATE_LANGUAGE ||
      "tr",
    "tr_TR",
    "tr",
    "en_US",
  ].filter((language, index, values) => values.indexOf(language) === index);
  const components: WhatsAppTemplateComponent[] = [
    {
      type: "body",
      parameters: [{ type: "text", text: code }],
    },
    {
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [{ type: "text", text: code }],
    },
  ];
  let result = await sendWhatsAppTemplateMessage({
    to,
    templateName,
    languageCode: languages[0],
    components,
  });

  for (const languageCode of languages.slice(1)) {
    if (result.ok || result.data?.error?.code !== 132001) break;
    result = await sendWhatsAppTemplateMessage({
      to,
      templateName,
      languageCode,
      components,
    });
  }
  return result;
}

/**
 * Telefon numarasını uluslararası formata dönüştürür (905XXXXXXXXX)
 */
export function formatPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/\D/g, "");
  if (!cleaned) return "";
  if (cleaned.startsWith("0")) {
    cleaned = "9" + cleaned;
  } else if (!cleaned.startsWith("90")) {
    cleaned = "90" + cleaned;
  }
  return cleaned;
}
