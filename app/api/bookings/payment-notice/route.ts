import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseAdmin";

const BUCKET = "payment-proofs";
const MAX_FILE_SIZE = 4 * 1024 * 1024;
const ALLOWED_FILES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "application/pdf": "pdf",
} as const;

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const bookingId = String(form.get("bookingId") || "").trim();
    const token = String(form.get("token") || "").trim();
    const choice = String(form.get("choice") || "");
    const proof = form.get("proof");

    if (!/^[0-9a-f-]{36}$/i.test(bookingId) || !/^[0-9a-f-]{36}$/i.test(token)) {
      return NextResponse.json({ error: "Ödeme bağlantısı geçersiz." }, { status: 400 });
    }
    if (choice !== "deposit" && choice !== "full") {
      return NextResponse.json({ error: "Geçersiz ödeme seçimi." }, { status: 400 });
    }
    if (!(proof instanceof File) || !Object.prototype.hasOwnProperty.call(ALLOWED_FILES, proof.type)) {
      return NextResponse.json({ error: "JPG, PNG veya PDF dekont ekleyin." }, { status: 400 });
    }
    if (proof.size === 0 || proof.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "Dekont boş olamaz ve 4 MB'dan küçük olmalıdır." }, { status: 400 });
    }
    const signature = new Uint8Array(await proof.slice(0, 8).arrayBuffer());
    const signaturesMatch = proof.type === "image/jpeg"
      ? signature[0] === 0xff && signature[1] === 0xd8 && signature[2] === 0xff
      : proof.type === "image/png"
        ? signature.join(",") === "137,80,78,71,13,10,26,10"
        : new TextDecoder().decode(signature.slice(0, 5)) === "%PDF-";
    if (!signaturesMatch) {
      return NextResponse.json({ error: "Dosya içeriği JPEG, PNG veya PDF olarak doğrulanamadı." }, { status: 400 });
    }

    const client = getSupabaseServerClient();
    const { data: booking, error: bookingError } = await client
      .from("booking_requests")
      .select("id, payment_token, payment_status, notes")
      .eq("id", bookingId)
      .eq("payment_token", token)
      .maybeSingle();
    if (bookingError) throw bookingError;
    if (!booking) return NextResponse.json({ error: "Rezervasyon bulunamadı." }, { status: 404 });
    if (booking.payment_status === "paid" || booking.payment_status === "approved") {
      return NextResponse.json({ error: "Bu rezervasyonun ödemesi zaten onaylanmış." }, { status: 409 });
    }

    const { data: buckets, error: bucketsError } = await client.storage.listBuckets();
    if (bucketsError) throw bucketsError;
    const bucketExists = buckets.some((bucket) => bucket.name === BUCKET);
    if (!bucketExists) {
      const { error: createError } = await client.storage.createBucket(BUCKET, {
        public: false,
        fileSizeLimit: MAX_FILE_SIZE,
        allowedMimeTypes: Object.keys(ALLOWED_FILES),
      });
      if (createError && !/already exists|duplicate/i.test(createError.message)) throw createError;
    }
    const { error: bucketConfigError } = await client.storage.updateBucket(BUCKET, {
      public: false,
      fileSizeLimit: MAX_FILE_SIZE,
      allowedMimeTypes: Object.keys(ALLOWED_FILES),
    });
    if (bucketConfigError) throw bucketConfigError;

    const extension = ALLOWED_FILES[proof.type as keyof typeof ALLOWED_FILES];
    const path = `${bookingId}/${randomUUID()}.${extension}`;
    const { error: uploadError } = await client.storage.from(BUCKET).upload(path, proof, {
      contentType: proof.type,
      cacheControl: "3600",
      upsert: false,
    });
    if (uploadError) throw uploadError;

    const marker = `[payment-proof:${path}]`;
    const previousPath = String(booking.notes || "").match(/\[payment-proof:([^\]]+)\]/)?.[1];
    const notes = String(booking.notes || "").replace(/\n?\[payment-proof:[^\]]+\]/g, "").trim();
    const updatedNotes = [notes, marker].filter(Boolean).join("\n");
    const { error: updateError } = await client
      .from("booking_requests")
      .update({ payment_choice: choice, payment_status: "proof_submitted", notes: updatedNotes })
      .eq("id", bookingId)
      .eq("payment_token", token);

    if (updateError) {
      await client.storage.from(BUCKET).remove([path]);
      throw updateError;
    }
    if (previousPath?.startsWith(`${bookingId}/`) && !previousPath.includes("..")) {
      await client.storage.from(BUCKET).remove([previousPath]);
    }

    return NextResponse.json({ success: true, message: "Dekont ve ödeme bildirimi admin'e iletildi." });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Dekont yüklenemedi." },
      { status: 500 },
    );
  }
}
